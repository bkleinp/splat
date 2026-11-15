import { math, Vec3 } from 'playcanvas';

import type { WalkSettings } from '../options';

import type { Camera, CameraFrame } from './camera';
import { applyFrameRotation, dampAngles, setYawBasis } from './camera-utils';
import { WalkController } from './walk-controller';

// Home-tour walking, layered on WalkController without changing its physics: a human pace with
// gentle speed-up and slow-down, the stock jump at a set height, and a subtle head bob, all
// tunable through WalkSettings. Lives in its own file so upstream merges of walk-controller.ts
// stay conflict-free.

/** Fixed physics step of WalkController (1 / 60 s). */
const FIXED_DT = 1 / 60;

/**
 * Movement input speed every source uses for "full forward": keyboard (KeyboardMouseDevice.moveSpeed),
 * the host joystick (InputController.moveSpeed) and click-to-walk (WalkSource.walkSpeed).
 */
const INPUT_SPEED = 4;

/** Clearance between the top of the head and the top of the collision capsule, meters. */
const HEAD_CLEARANCE = 0.2;

const DEFAULT_WALK_SETTINGS: Readonly<WalkSettings> = Object.freeze({
    speed: 1.4,
    responseTime: 0.25,
    headBob: 1,
    stepLength: 0.7,
    eyeHeight: 1.5,
    fov: 90,
    // the stock jump: 4 m/s take-off under 9.8 m/s² gravity
    jumpHeight: 0.8
});

/** How far a seated walker can look up or down, degrees. */
const SEATED_PITCH_LIMIT = 80;

/** Vertical speed, m/s, above which the walker counts as airborne (jumping or falling). */
const AIRBORNE_SPEED = 1;

/** Seconds of near-level motion after which a landing counts, so the jump's apex doesn't. */
const LANDED_TIME = 0.15;

const forward = new Vec3();
const right = new Vec3();
const prevBase = new Vec3();

class TourWalkController extends WalkController {
    private _settings: WalkSettings = { ...DEFAULT_WALK_SETTINGS };

    private _speed = 0;

    private _intensity = 0;

    private _stepPhase = 0;

    private _base = new Vec3();

    private _hasBase = false;

    /** Seconds since the walker last moved vertically at airborne speed. */
    private _levelTime = LANDED_TIME;

    private _reducedMotion = false;

    private _seated = false;

    private _seatPosition = new Vec3();

    private _seatAngles = new Vec3();

    private _seatTarget = new Vec3();

    constructor() {
        super();
        this.applySettings(DEFAULT_WALK_SETTINGS);

        // respect the OS "reduce motion" setting: no bob for people prone to motion sickness
        const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (query) {
            this._reducedMotion = query.matches;
            query.addEventListener?.('change', (e) => (this._reducedMotion = e.matches));
        }
    }

    get settings(): Readonly<WalkSettings> {
        return this._settings;
    }

    /**
     * Apply walk settings. Takes effect immediately, also mid-walk.
     *
     * @param settings - The settings to change; others keep their current value.
     */
    applySettings(settings: Partial<WalkSettings>) {
        const s = { ...this._settings };
        for (const key of Object.keys(DEFAULT_WALK_SETTINGS) as (keyof WalkSettings)[]) {
            const value = settings[key];
            if (typeof value === 'number' && Number.isFinite(value)) s[key] = value;
        }
        s.speed = math.clamp(s.speed, 0.1, 10);
        s.responseTime = math.clamp(s.responseTime, 0.02, 3);
        s.headBob = math.clamp(s.headBob, 0, 5);
        s.stepLength = math.clamp(s.stepLength, 0.2, 2);
        s.eyeHeight = math.clamp(s.eyeHeight, 0.5, 3);
        s.fov = math.clamp(s.fov, 30, 120);
        s.jumpHeight = math.clamp(s.jumpHeight, 0, 3);
        this._settings = s;

        // take-off speed that peaks at jumpHeight: h = v² / 2g
        this.jumpSpeed = Math.sqrt(2 * this.gravity * s.jumpHeight);

        // WalkController adds input * moveGroundSpeed to the velocity each step, then keeps
        // `keep` of it (velocityDampingGround). Choose both so velocity settles at `speed` with
        // time constant `responseTime`: speed = input * moveGroundSpeed * keep / (1 - keep).
        const keep = Math.exp(-FIXED_DT / s.responseTime);
        this.velocityDampingGround = Math.exp(-1 / (1000 * s.responseTime));
        this.moveGroundSpeed = (s.speed * (1 - keep)) / (INPUT_SPEED * FIXED_DT * keep);

        // WalkController measures eye height from the capsule's foot, which hovers above the floor
        this.eyeHeight = s.eyeHeight - this.hoverHeight;
        this.capsuleHeight = this.eyeHeight + HEAD_CLEARANCE;
        this.fov = s.fov;
    }

    onEnter(camera: Camera): void {
        super.onEnter(camera);
        this._resetBob();
    }

    goto(camera: Camera): void {
        super.goto(camera);
        this._resetBob();
    }

    /** Sitting: the walker is parked at a seat, can look around, and doesn't walk. */
    get seated(): boolean {
        return this._seated;
    }

    /** Set while seated when movement input arrives: the camera manager stands the walker up. */
    standRequested = false;

    /**
     * Sit at a seat: hold the eye at `position`, facing `yaw` (degrees) and looking down by
     * `pitch`. Looking around still works; walking doesn't (it asks to stand instead).
     *
     * @param position - Seated eye position in world space.
     * @param yaw - Facing direction, degrees.
     * @param pitch - Look angle, degrees (negative looks down).
     */
    sit(position: Vec3, yaw: number, pitch: number) {
        this._seated = true;
        this.standRequested = false;
        this._seatPosition.copy(position);
        this._seatTarget.set(pitch, yaw, 0);
        this._seatAngles.copy(this._seatTarget);
        this._resetBob();
    }

    /**
     * Stand up at `camera`'s pose (where the walker stood before sitting), walking again from there.
     *
     * @param camera - The pose to stand at.
     */
    stand(camera: Camera) {
        this._seated = false;
        this.standRequested = false;
        this.goto(camera);
    }

    update(deltaTime: number, inputFrame: CameraFrame, camera: Camera): void {
        if (this._seated) {
            const { move, rotate } = inputFrame.read();
            if (move[0] !== 0 || move[1] !== 0 || move[2] !== 0) this.standRequested = true;
            applyFrameRotation(this._seatTarget, rotate, -SEATED_PITCH_LIMIT, SEATED_PITCH_LIMIT);
            dampAngles(this._seatAngles, this._seatTarget, this.rotateDamping, deltaTime);
            camera.position.copy(this._seatPosition);
            camera.angles.set(this._seatAngles.x, this._seatAngles.y, 0);
            camera.distance = 1;
            camera.fov = this.fov;
            return;
        }

        // jump height 0 turns jumping off: drop the jump signal before the walk physics sees it
        if (this._settings.jumpHeight <= 0) {
            const move = inputFrame.deltas.move.read();
            inputFrame.deltas.move.append([move[0], 0, move[2]]);
        }

        super.update(deltaTime, inputFrame, camera);

        // the controller wrote the un-bobbed pose; keep it to measure walking speed from
        prevBase.copy(this._base);
        this._base.copy(camera.position);
        if (!this._hasBase || deltaTime <= 0) {
            this._hasBase = true;
            return;
        }

        const dx = this._base.x - prevBase.x;
        const dz = this._base.z - prevBase.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // no steps in mid-air: pause the bob from take-off until shortly after landing
        const verticalSpeed = Math.abs(this._base.y - prevBase.y) / deltaTime;
        this._levelTime = verticalSpeed > AIRBORNE_SPEED ? 0 : this._levelTime + deltaTime;
        const airborne = this._levelTime < LANDED_TIME;

        // smooth the measured speed so the bob fades in and out instead of popping
        const speed = Math.min(dist / deltaTime, 10);
        this._speed = math.lerp(this._speed, speed, 1 - Math.exp(-deltaTime / 0.1));

        const { headBob, stepLength } = this._settings;
        const amount = this._reducedMotion || airborne ? 0 : headBob;
        const target = amount * math.clamp(this._speed / (this._settings.speed * 0.85), 0, 1);
        this._intensity = math.lerp(this._intensity, target, 1 - Math.exp(-deltaTime / (airborne ? 0.06 : 0.2)));

        if (this._intensity < 1e-4) return;

        // phase follows distance walked, so the step rhythm matches the pace
        this._stepPhase = (this._stepPhase + dist / stepLength) % 2;

        // one dip per step, one side-to-side sway per stride (two steps)
        const vertical = Math.sin(this._stepPhase * Math.PI * 2) * 0.012 * this._intensity;
        const lateral = Math.sin(this._stepPhase * Math.PI) * 0.008 * this._intensity;

        setYawBasis(camera.angles.y, forward, right);
        camera.position.x += right.x * lateral;
        camera.position.y += vertical;
        camera.position.z += right.z * lateral;
    }

    private _resetBob() {
        this._speed = 0;
        this._intensity = 0;
        this._stepPhase = 0;
        this._hasBase = false;
        this._levelTime = LANDED_TIME;
    }
}

export { DEFAULT_WALK_SETTINGS, TourWalkController };
