import { Vec2, Vec3 } from 'playcanvas';
import type { BoundingBox } from 'playcanvas';

import { createFigure8Track } from './animation/create-figure8-track';
import { createRotateTrack } from './animation/create-rotate-track';
import { AnimController } from './cameras/anim-controller';
import { Camera } from './cameras/camera';
import type { CameraFrame, CameraController } from './cameras/camera';
import { FlyController } from './cameras/fly-controller';
import { FlySource } from './cameras/fly-source';
import { OrbitController } from './cameras/orbit-controller';
import type { TargetSource } from './cameras/target-navigation';
import { TourWalkController } from './cameras/tour-walk-controller';
import { WalkSource } from './cameras/walk-source';
import type { Collision } from './collision';
import { easeOut } from './core/math';
import type { WalkSettings } from './options';
import { DEFAULT_CAMERA_FOV } from './schemas/defaults';
import type { Annotation } from './settings';
import type { CameraMode, Global } from './types';

const tmpCamera = new Camera();
const tmpv = new Vec3();
const tmpv2 = new Vec3();

// Annotation moves ease in and out, lasting longer the farther the camera travels and turns,
// between these bounds in seconds. Every other transition keeps the quick-start easeOut.
// The curve does most of its travel in the first half and settles through the second, so
// these allow for the settle.
const ANNOTATION_MIN_DURATION = 1.2;
const ANNOTATION_MAX_DURATION = 2.4;

// How hard the annotation move's curve settles: higher gets going sooner and settles longer.
const SETTLE_POWER = 5;

// The highest starting slope carried into a move. The curve stays monotonic up to
// SETTLE_POWER, so this is well inside it.
const MAX_START_SLOPE = 3;

// The view turns a little ahead of the travel, finishing at this share of the move, the way
// a camera operator looks toward where they are going before they arrive.
const TURN_LEAD = 0.8;

// A curve from 0 to 1 over the move that starts at `slope` (progress per unit time: 0 starts
// from rest, 1 at the move's average speed), gets going quickly and settles slowly, like a
// hand-held move rather than an even symmetric ramp. It shapes like a critically damped spring,
// but it arrives at exactly zero speed with no deceleration left, where a spring scaled to land
// in a fixed time still has speed to lose and stops abruptly on a long move.
const settleFrom = (slope: number) => (x: number) =>
    1 - Math.pow(1 - x, SETTLE_POWER) * (1 + (SETTLE_POWER - slope) * x);

// Tour fork plan view: field of view, room around the scene, how far the view leans so the walker's
// heading stays up the screen, and the flight time between walking and the plan.
const PLAN_FOV = 30;
const PLAN_MARGIN = 1.2;
const PLAN_TILT = 0.02;
const PLAN_DURATION = 1.6;

// Orbit pitch limits, degrees (negative looks down): the stock range, and the plan view's, which
// stops a little above the horizon so the camera can't swing under the floor.
const ORBIT_PITCH_RANGE = new Vec2(-90, 90);
const PLAN_PITCH_RANGE = new Vec2(-90, -10);

// The plan view frames the floor the walker is on, found by casting a grid of rays down through
// the collision: hits this close to the floor's height count as that floor (a step down to a
// terrace still does; the storey below does not).
const FOOTPRINT_GRID = 64;
const FOOTPRINT_LEVEL = 0.9;

/** Centre and half size, horizontally, of a floor plan in world space. */
type Footprint = { x: number; z: number; halfX: number; halfZ: number };

// The horizontal extent of the floor at `floorY`, or the scene's bounds without collision (or when
// too little of the floor is found to trust). Scans usually carry a backdrop of large splats far
// outside the rooms, so the scene's own bounds frame the rooms small.
const findFloorFootprint = (collision: Collision | null, bbox: BoundingBox, floorY: number): Footprint => {
    const fallback = { x: bbox.center.x, z: bbox.center.z, halfX: bbox.halfExtents.x, halfZ: bbox.halfExtents.z };
    if (!collision) return fallback;

    const minX = bbox.center.x - bbox.halfExtents.x;
    const minZ = bbox.center.z - bbox.halfExtents.z;
    const stepX = (bbox.halfExtents.x * 2) / FOOTPRINT_GRID;
    const stepZ = (bbox.halfExtents.z * 2) / FOOTPRINT_GRID;
    const fromY = floorY + 1.5;

    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    let hits = 0;
    for (let i = 0; i <= FOOTPRINT_GRID; i++) {
        const x = minX + i * stepX;
        for (let j = 0; j <= FOOTPRINT_GRID; j++) {
            const z = minZ + j * stepZ;
            const hit = collision.queryRay(x, fromY, z, 0, -1, 0, 1.5 + FOOTPRINT_LEVEL);
            if (!hit || Math.abs(hit.y - floorY) > FOOTPRINT_LEVEL) continue;
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            z0 = Math.min(z0, z);
            z1 = Math.max(z1, z);
            hits++;
        }
    }
    if (hits < 8) return fallback;
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, halfX: (x1 - x0) / 2 + stepX, halfZ: (z1 - z0) / 2 + stepZ };
};

// Walk mode is only enabled when the scene's horizontal footprint is large
// enough to walk around in. Vertical extent (Y) is irrelevant — a tall but
// narrow scene isn't walkable. Both X and Z ranges must exceed this
// minimum (in metres); below it walk mode is hidden and the viewer falls
// back to fly as the default first-person mode.
const WALK_MIN_HORIZONTAL_RANGE = 5;

// whether a scene is large enough to walk around in, taking its content as real-world scale; XR
// grabbing also tells a scene from an object by it
const isWalkableSize = (bbox: BoundingBox): boolean => {
    const { x, z } = bbox.halfExtents;
    return x * 2 >= WALK_MIN_HORIZONTAL_RANGE && z * 2 >= WALK_MIN_HORIZONTAL_RANGE;
};

const isWalkAllowed = (bbox: BoundingBox, collision: Collision | null): boolean => {
    return !!collision && isWalkableSize(bbox);
};

const createCamera = (position: Vec3, target: Vec3, fov: number) => {
    const result = new Camera();
    result.look(position, target);
    result.fov = fov;
    return result;
};

const createFrameCamera = (bbox: BoundingBox, fov: number) => {
    const sceneSize = bbox.halfExtents.length();
    const distance = sceneSize / Math.sin((fov / 180) * Math.PI * 0.5);
    return createCamera(new Vec3(2, 1, 2).normalize().mulScalar(distance).add(bbox.center), bbox.center, fov);
};

class CameraManager {
    update: (deltaTime: number, cameraFrame: CameraFrame) => void;

    seek: (time: number) => void;

    selectAnnotation: (annotation: Annotation) => void;

    // Re-seed the active controller from the current camera pose and
    // cancel any in-progress transition lerp. Use after externally
    // mutating `camera` and/or `state.cameraMode` to make the change
    // visible instantly.
    snap: () => void;

    // How far the current transition has eased toward its destination, from 0 to 1; 1 when
    // there is none. The annotations time their tooltip to the camera's arrival with it.
    transitionProgress: () => number;

    // Tour fork: change how walking feels, immediately.
    setWalkSettings: (settings: Partial<WalkSettings>) => void;

    // Tour fork: fly up to a top-down view of `footprint` on the floor at `floorY` (orbit
    // controls: drag to tilt and turn, wheel or pinch to zoom), or back down to where the camera
    // left from. Allowed in walk-only mode, which otherwise keeps the camera walking.
    setPlanView: (on: boolean, floorY: number, footprint: Footprint) => void;

    // Tour fork: the floor plan around the floor at `floorY`.
    findFootprint: (floorY: number) => Footprint;

    // Tour fork: in the plan view, fly to frame a new footprint (the plan's outline changed).
    reframePlan: (floorY: number, footprint: Footprint) => void;

    // Attach (or clear) collision after construction. The viewer reveals the scene without
    // waiting for collision data, which can be larger than the splats themselves, so this
    // arrives late. It re-tests whether walk mode is allowed, which gates the walk toggle
    // and the mode the camera falls back to when an animation is interrupted.
    setCollision: (collision: Collision | null) => void;

    // Whether the start camera is outside the scene bounds: an object to orbit rather than a
    // scene to be in. XR holds and grabs the splat by the same test
    readonly isObjectExperience: boolean;

    // holds the camera state
    camera = new Camera();

    /**
     * @param global - The viewer's globals.
     * @param bbox - The scene bounds.
     * @param collision - Collision data, if it has already loaded.
     * @param cameraAnimation - Whether the camera has an animation. Off for an animated splat
     * sequence, whose frames the timeline plays instead; the timeline state is then the viewer's.
     */
    constructor(global: Global, bbox: BoundingBox, collision: Collision | null = null, cameraAnimation = true) {
        const { events, settings, state } = global;

        // tour fork: walk is the only camera mode (no fly, orbit or intro animation)
        const walkOnly = global.config.walkOnly;
        if (walkOnly) cameraAnimation = false;

        let walkAllowed = isWalkAllowed(bbox, collision);

        const camera0 = settings.cameras[0]?.initial;
        const defaultFov = camera0?.fov ?? DEFAULT_CAMERA_FOV;
        const frameCamera = createFrameCamera(bbox, defaultFov);
        const resetCamera = camera0
            ? createCamera(new Vec3(camera0.position), new Vec3(camera0.target), camera0.fov)
            : frameCamera;

        const getAnimTrack = (initial: Camera, isObjectExperience: boolean) => {
            const { animTracks } = settings;

            // extract the camera animation track from settings
            if (animTracks?.length > 0 && settings.startMode === 'animTrack') {
                // use the first animTrack
                return animTracks[0];
            } else if (isObjectExperience) {
                // create basic rotation animation if no anim track is specified
                initial.calcFocusPoint(tmpv);
                return createRotateTrack(initial.position, tmpv, initial.fov);
            }
            // non-object experience: gentle figure-8 motion from inside the scene
            initial.calcFocusPoint(tmpv);
            return createFigure8Track(initial.position, tmpv, initial.fov);
        };

        // object experience starts outside the bounding box
        const isObjectExperience = !bbox.containsPoint(resetCamera.position);
        this.isObjectExperience = isObjectExperience;
        const animTrack = cameraAnimation ? getAnimTrack(resetCamera, isObjectExperience) : null;

        const controllers = {
            orbit: new OrbitController(),
            fly: new FlyController(),
            walk: new TourWalkController(),
            anim: animTrack ? new AnimController(animTrack) : null
        };

        controllers.orbit.fov = resetCamera.fov;
        controllers.fly.fov = resetCamera.fov;
        controllers.fly.collision = collision;
        controllers.walk.collision = collision;

        const walkSource = new WalkSource();
        const flySource = new FlySource();
        const sourcesByMode: Partial<Record<CameraMode, TargetSource>> = {
            walk: walkSource,
            fly: flySource
        };
        walkSource.onComplete = flySource.onComplete = () => {
            events.fire('navigateComplete');
        };

        const getController = (cameraMode: CameraMode): CameraController => {
            return controllers[cameraMode] as CameraController;
        };

        // set the global animation flag
        if (cameraAnimation) {
            state.hasAnimation = !!controllers.anim;
            state.animationDuration = controllers.anim ? controllers.anim.animState.cursor.duration : 0;
        }

        // initialize camera mode and initial camera position
        // walk-only enters walk even before collision arrives: WalkController stands on the entry
        // level until it does
        state.cameraMode = walkOnly
            ? 'walk'
            : controllers.anim
              ? 'anim'
              : isObjectExperience
                ? 'orbit'
                : walkAllowed
                  ? 'walk'
                  : 'fly';
        this.camera.copy(resetCamera);

        const target = new Camera(this.camera); // the active controller updates this
        const from = new Camera(this.camera); // stores the previous camera state during transition
        const defaultMode = (): CameraMode => (isObjectExperience ? 'orbit' : walkAllowed ? 'walk' : 'fly');

        // null until the first mode change, so the fallback tracks `walkAllowed` if collision
        // attaches before the user has moved
        let fromMode: CameraMode | null = null;

        // tracks the mode to restore when exiting walk
        let preWalkMode: CameraMode = isObjectExperience ? 'orbit' : 'fly';

        // enter the initial controller
        getController(state.cameraMode).onEnter(this.camera);

        // transition state
        let transitionTimer = 1;
        let transitionDuration = 1;
        let transitionEase = easeOut;
        // annotation moves blend the view angles directly, on their own curve so the turn can
        // lead the travel; the rest blend through the look-at point
        let transitionTurnEase: ((x: number) => number) | null = null;
        let clearOrbitTargetOnTransitionEnd = false;

        // the camera's speed over the last frame, so a new annotation move can carry on from
        // the motion it interrupts rather than restart from rest
        let cameraSpeed = 0;
        const lastPosition = this.camera.position.clone();

        // start a new camera transition from the current pose, over `duration` seconds
        const startTransition = (duration = 1, ease = easeOut, turnEase: ((x: number) => number) | null = null) => {
            from.copy(this.camera);
            transitionTimer = 0;
            transitionDuration = duration;
            transitionEase = ease;
            transitionTurnEase = turnEase;
        };

        this.transitionProgress = () => (transitionTimer < 1 ? transitionEase(transitionTimer) : 1);

        this.setCollision = (value: Collision | null) => {
            controllers.fly.collision = value;
            controllers.walk.collision = value;
            walkAllowed = isWalkAllowed(bbox, value);

            // walk-only entered walk before collision arrived, on the starting camera's level,
            // which may sit inside the real floor where collision can never engage. Re-enter now
            // so the camera stands on the floor, easing there rather than popping
            if (walkOnly && value && state.cameraMode === 'walk') {
                startTransition(0.5);
                controllers.walk.onEnter(this.camera);
            }
        };

        this.setWalkSettings = (value: Partial<WalkSettings>) => {
            controllers.walk.applySettings(value);
            global.app.renderNextFrame = true;
        };

        // plan view (tour fork): the pose and mode to return to, and whether a plan switch is
        // under way, which lets walk-only's mode guard through
        let planActive = false;
        let planSwitching = false;
        let planReturnMode: CameraMode = 'walk';
        const planReturn = new Camera();

        this.findFootprint = (floorY: number) => findFloorFootprint(controllers.walk.collision, bbox, floorY);

        const planEase = settleFrom(0);
        const planTurnEase = (x: number) => planEase(Math.min(1, x / TURN_LEAD));

        // fly the orbit camera to straight down over `footprint`, high enough to see all of it,
        // with the top of the screen where the walker was facing
        const flyToPlan = (floorY: number, footprint: Footprint) => {
            const fov = PLAN_FOV;
            // fit the narrower of the screen's two directions: on a phone held upright, the width
            const reach = Math.max(footprint.halfX, footprint.halfZ, 2);
            const { width, height: screenHeight } = global.app.graphicsDevice;
            const aspect = width > 0 && screenHeight > 0 ? width / screenHeight : 1;
            const tanHalf = Math.tan((fov / 360) * Math.PI) * Math.min(1, aspect);
            const height = (reach * PLAN_MARGIN) / tanHalf;
            planReturn.calcFocusPoint(tmpv);
            tmpv.sub(planReturn.position);
            tmpv.y = 0;
            if (tmpv.lengthSq() < 1e-8) tmpv.set(0, 0, -1);
            tmpv.normalize();
            tmpv2.set(footprint.x, floorY, footprint.z);
            const eye = new Vec3().copy(tmpv2).add(tmpv.mulScalar(-height * PLAN_TILT));
            eye.y += height;
            tmpCamera.look(eye, tmpv2);
            tmpCamera.fov = fov;

            controllers.orbit.goto(tmpCamera);
            startTransition(PLAN_DURATION, planEase, planTurnEase);
            global.app.renderNextFrame = true;
        };

        this.reframePlan = (floorY: number, footprint: Footprint) => {
            if (planActive) flyToPlan(floorY, footprint);
        };

        this.setPlanView = (on: boolean, floorY: number, footprint: Footprint) => {
            if (on === planActive) return;
            const ease = planEase;
            const turnEase = planTurnEase;

            if (on) {
                planReturn.copy(this.camera);
                planReturnMode = state.cameraMode === 'anim' ? defaultMode() : state.cameraMode;
                planActive = true;
                planSwitching = true;
                state.cameraMode = 'orbit';
                planSwitching = false;
                // the plan is seen from above: tilt down to the horizon's edge, never under the floor
                controllers.orbit.controller.pitchRange = PLAN_PITCH_RANGE;
                flyToPlan(floorY, footprint);
            } else {
                controllers.orbit.controller.pitchRange = ORBIT_PITCH_RANGE;
                planActive = false;
                planSwitching = true;
                if (planReturnMode === 'orbit') {
                    controllers.orbit.goto(planReturn);
                } else {
                    state.cameraMode = planReturnMode;
                }
                planSwitching = false;
                startTransition(PLAN_DURATION, ease, turnEase);
            }
            global.app.renderNextFrame = true;
        };

        this.snap = () => {
            getController(state.cameraMode).onEnter(this.camera);
            target.copy(this.camera);
            transitionTimer = 1;
            global.app.renderNextFrame = true;
        };

        // application update
        this.update = (deltaTime: number, frame: CameraFrame) => {
            // use dt of 0 if animation is paused
            const dt = state.cameraMode === 'anim' && state.animationPaused ? 0 : deltaTime;

            // update transition timer
            const prevTransitionTimer = transitionTimer;
            transitionTimer = Math.min(1, transitionTimer + deltaTime / transitionDuration);

            const controller = getController(state.cameraMode);

            sourcesByMode[state.cameraMode]?.update(dt, this.camera, frame);

            controller.update(dt, frame, target);

            if (transitionTimer < 1) {
                // lerp away from previous camera during transition
                const t = transitionEase(transitionTimer);
                if (transitionTurnEase) {
                    this.camera.lerpAngles(from, target, t, transitionTurnEase(transitionTimer));
                } else {
                    this.camera.lerp(from, target, t);
                }
            } else {
                this.camera.copy(target);
            }

            if (deltaTime > 0) {
                cameraSpeed = this.camera.position.distance(lastPosition) / deltaTime;
            }
            lastPosition.copy(this.camera.position);

            // update animation timeline
            if (state.cameraMode === 'anim') {
                state.animationTime = controllers.anim.animState.cursor.value;

                // a play-once animation pauses once it reaches the end of the track
                if (!state.animationPaused && controllers.anim.animState.cursor.ended) {
                    state.animationPaused = true;
                }
            }

            if (clearOrbitTargetOnTransitionEnd && prevTransitionTimer < 1 && transitionTimer === 1) {
                clearOrbitTargetOnTransitionEnd = false;
                events.fire('orbitTarget:clear');
            }
        };

        // handle input events
        events.on('inputEvent', (eventName) => {
            switch (eventName) {
                case 'frame':
                    events.fire('orbitTarget:clear');
                    state.cameraMode = 'orbit';
                    controllers.orbit.goto(frameCamera);
                    startTransition();
                    break;
                case 'reset':
                    if (state.cameraMode === 'walk') {
                        walkSource.cancel();
                        events.fire('navTarget:clear');
                        startTransition();
                        controllers.walk.resetToSpawn(target);
                    } else if (state.cameraMode === 'fly') {
                        flySource.cancel();
                        startTransition();
                        controllers.fly.resetToSpawn(target);
                    } else {
                        events.fire('orbitTarget:clear');
                        state.cameraMode = 'orbit';
                        controllers.orbit.goto(resetCamera);
                        startTransition();
                    }
                    break;
                case 'playPause':
                    if (!controllers.anim) {
                        // a sequence plays in every camera mode
                        if (state.hasAnimation) state.animationPaused = !state.animationPaused;
                    } else if (state.hasAnimation) {
                        if (state.cameraMode === 'anim') {
                            state.animationPaused = !state.animationPaused;
                        } else {
                            state.cameraMode = 'anim';
                            state.animationPaused = false;
                        }
                    }
                    break;
                case 'requestFirstPerson':
                    // movement input from a non-first-person mode: walk where the scene allows
                    // it, fly otherwise, the same preference as the animation fallback
                    state.cameraMode = walkAllowed ? 'walk' : 'fly';
                    break;
                case 'toggleWalk':
                    if (walkAllowed) {
                        if (state.cameraMode === 'walk') {
                            state.cameraMode = preWalkMode;
                        } else {
                            state.cameraMode = 'walk';
                        }
                    }
                    break;
                case 'exitWalk':
                    if (state.cameraMode === 'walk') {
                        state.cameraMode = preWalkMode;
                    }
                    break;
                case 'cancel':
                    if (state.cameraMode === 'anim') {
                        state.cameraMode = fromMode ?? defaultMode();
                    }
                    break;
                case 'interrupt':
                    if (state.cameraMode === 'anim') {
                        state.cameraMode = fromMode ?? defaultMode();
                    }
                    break;
            }
        });

        // handle camera mode switching
        events.on('cameraMode:changed', (value: CameraMode, prev: CameraMode) => {
            // walk-only: undo any switch away from walk (shortcuts, picking, framing). The undo
            // fires this handler again with walk as the value; walk was never left, so there is
            // nothing to exit or enter
            // The plan view holds orbit the same way; only setPlanView's own switches get through
            if (walkOnly && !planSwitching) {
                const held = planActive ? 'orbit' : 'walk';
                if (value !== held) state.cameraMode = held;
                return;
            }
            if (planActive && !planSwitching && value !== 'orbit') {
                state.cameraMode = 'orbit';
                return;
            }

            // no animation to enter: a host's write is undone, and the undo has nothing to exit
            if (!getController(value)) {
                state.cameraMode = prev;
                return;
            }
            if (!getController(prev)) return;

            // Host state writes and the walk toggle must remember the same return mode.
            if (value === 'walk') {
                preWalkMode = prev;
            }
            sourcesByMode[prev]?.cancel();

            // snapshot the current pose before any controller mutation
            startTransition();

            target.copy(this.camera);
            fromMode = prev;

            // exit the old controller
            const prevController = getController(prev);
            prevController.onExit(this.camera);

            // enter new controller; leaving the plan view returns to the pose it was entered from
            const newController = getController(value);
            newController.onEnter(planSwitching && !planActive ? planReturn : this.camera);
        });

        // pressing play at (or within a frame of) the end of a play-once animation
        // restarts it from the beginning (a scrub can park just short of the end)
        events.on('animationPaused:changed', (paused: boolean) => {
            const animState = controllers.anim?.animState;
            if (!paused && animState) {
                const { cursor } = animState;
                if (cursor.loopMode === 'none' && cursor.duration - cursor.value < 1 / animState.frameRate) {
                    cursor.value = 0;
                }
            }
        });

        this.seek = (time) => {
            if (!controllers.anim) return;

            // switch to animation camera if we're not already there
            state.cameraMode = 'anim';

            // set time
            controllers.anim.animState.cursor.value = time;
            state.animationTime = controllers.anim.animState.cursor.value;
        };

        // handle user picking in the scene
        events.on('pick', (position: Vec3) => {
            // switch to orbit camera on pick
            state.cameraMode = 'orbit';

            // construct camera
            tmpCamera.copy(this.camera);
            tmpCamera.look(this.camera.position, position);

            controllers.orbit.goto(tmpCamera);
            startTransition();
            clearOrbitTargetOnTransitionEnd = true;
        });

        this.selectAnnotation = (annotation: Annotation) => {
            events.fire('orbitTarget:clear');

            // switch to orbit camera on pick
            state.cameraMode = 'orbit';

            const { initial } = annotation.camera;

            // construct camera
            tmpCamera.fov = initial.fov;
            tmpCamera.look(new Vec3(initial.position), new Vec3(initial.target));

            // orbit at the annotation's depth along the view rather than about the authored
            // target, which is often a hair in front of the lens or far past the subject. The
            // new focus lies on the same view ray, so the pose is unchanged. An annotation
            // behind the camera keeps the authored target
            tmpCamera.calcFocusPoint(tmpv);
            tmpv.sub(tmpCamera.position).normalize();
            const depth = tmpv2
                .set(...annotation.position)
                .sub(tmpCamera.position)
                .dot(tmpv);
            if (depth > 1e-3) {
                tmpCamera.distance = depth;
            }

            // longer for a longer move: travel relative to the scene's size, plus how far the
            // view turns
            const travel = this.camera.position.distance(tmpCamera.position);
            const sceneSize = Math.max(bbox.halfExtents.length(), 1e-3);
            this.camera.calcFocusPoint(tmpv);
            tmpv.sub(this.camera.position).normalize();
            tmpCamera.calcFocusPoint(tmpv2);
            tmpv2.sub(tmpCamera.position).normalize();
            const turn = Math.acos(Math.max(-1, Math.min(1, tmpv.dot(tmpv2)))) / Math.PI;
            const duration = Math.max(
                ANNOTATION_MIN_DURATION,
                Math.min(ANNOTATION_MAX_DURATION, ANNOTATION_MIN_DURATION + (0.8 * travel) / sceneSize + 0.6 * turn)
            );

            // start at the camera's current speed, as a share of this move's average speed
            const slope = travel > 1e-6 ? Math.min(MAX_START_SLOPE, (cameraSpeed * duration) / travel) : 0;

            const travelEase = settleFrom(slope);
            const turnEase = settleFrom(slope * TURN_LEAD);
            controllers.orbit.goto(tmpCamera);
            startTransition(duration, travelEase, (x) => turnEase(Math.min(1, x / TURN_LEAD)));
        };

        // tap-to-navigate: start auto-driving the active mode toward a picked position
        events.on('navigateTo', (position: Vec3, normal: Vec3, speedMul = 1) => {
            const source = sourcesByMode[state.cameraMode];
            if (source) {
                source.navigateTo(position, speedMul);
                events.fire('navTarget:set', position, normal);
            }
        });

        // cancel any active auto-navigation in the current mode
        events.on('navigateCancel', () => {
            sourcesByMode[state.cameraMode]?.cancel();
            events.fire('navTarget:clear');
        });

        events.on('navigateComplete', () => {
            events.fire('navTarget:clear');
        });
    }
}

export { CameraManager, isWalkAllowed };
export type { Footprint };
