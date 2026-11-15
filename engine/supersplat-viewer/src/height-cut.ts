import { WORKBUFFER_UPDATE_ONCE } from 'playcanvas';
import type { AppBase, GSplatComponent } from 'playcanvas';

// Tour fork: the plan view's wall slicer. Hides every splat whose centre is above a world-space
// height, so walls can be cut down to see into the rooms from above. While cutting it also crops
// to the floor plan: an outline drawn around the home (a polygon), or failing one a box around the
// floor, so the backdrop scans carry outside the rooms (needed for the view out of the windows
// when walking) doesn't clutter the plan; and, when set, trims everything below a height under
// the floor. Splats near any of these edges are shrunk to fit inside them, keeping the edges
// crisp, and the plan is cleaned of haze: faint splats and oversized blobs (invisible at eye
// height, fuzz from above), with a stricter opacity bar along the cuts, where a wall's insides show.
// Runs in the engine's work buffer copy (GSplatComponent.setWorkBufferModifier), where centres
// are in world space, so it follows the scene's placement and applies to streamed LOD chunks too.
// The work buffer is only re-copied when the cut changes; a resting cut costs nothing per frame.
//
// Not drawn by the experimental stochastic renderer with its default `direct` data path, which
// reads splat files in place rather than the work buffer.

const HEIGHT = 'uTourCutHeight';
const BOTTOM = 'uTourCutBottom';
const BOX = 'uTourCutBox';
const OUTLINE = 'uTourCutOutline';
const OUTLINE_COUNT = 'uTourCutOutlineCount';
const CLEAN = 'uTourCutClean';

/**
 * How hard the plan view cleans up haze. Walking is never affected.
 */
type PlanCleanup = {
    /** Splats fainter than this opacity (0-1) are hidden [0.1]. */
    haze: number;
    /** Splats thicker than this (their thinnest side), meters, are hidden; null keeps all [null]. */
    maxSize: number | null;
};

const DEFAULT_PLAN_CLEANUP: Readonly<PlanCleanup> = Object.freeze({ haze: 0.1, maxSize: null });

/** Along the cuts, within this distance (meters), splats must be at least EDGE_OPACITY_LIFT more opaque. */
const EDGE_BAND = 0.25;
const EDGE_OPACITY_LIFT = 0.3;

/** Shader values for no cleanup: nothing faint, nothing too large. */
const NO_CLEAN = [0, 1e6, 0, 0];

/** Most corners an outline can have. */
const MAX_OUTLINE_POINTS = 48;

/** A height far above any scene: no cut. */
const OFF = 1e6;

/** A box enclosing everything. */
const NO_BOX = [-OFF, -OFF, OFF, OFF];

/** Seconds for the cut to cover most of the way to a new height. */
const EASE_TIME = 0.18;

// A splat reaches about this many of its scales (standard deviations) from its centre. Splats
// closer than that to a cut are shrunk until they fit inside it, so the cut's edge is crisp
// rather than fringed by large splats spilling over it.
const EDGE_SIGMAS = '2.5';

// Outside test: above the cut, below the floor trim, outside the box, then outside the outline
// (even-odd rule) when it has corners. Each corner is one vec4 (x, z, unused, unused), the layout
// uniform arrays share on WebGL and WebGPU.
const GLSL = /* glsl */ `
    uniform float ${HEIGHT};
    uniform float ${BOTTOM};
    uniform vec4 ${BOX};
    uniform vec4 ${OUTLINE}[${MAX_OUTLINE_POINTS}];
    uniform float ${OUTLINE_COUNT};
    uniform vec4 ${CLEAN};

    // distance from c inward to the nearest cut: the top, the bottom, the box and the outline
    float tourCutInset(vec3 c) {
        float d = min(${HEIGHT} - c.y, c.y - ${BOTTOM});
        d = min(d, min(min(c.x - ${BOX}.x, ${BOX}.z - c.x), min(c.z - ${BOX}.y, ${BOX}.w - c.z)));
        int count = int(${OUTLINE_COUNT});
        if (count >= 3) {
            vec2 p = c.xz;
            vec2 b = ${OUTLINE}[count - 1].xy;
            for (int i = 0; i < ${MAX_OUTLINE_POINTS}; i++) {
                if (i >= count) break;
                vec2 a = ${OUTLINE}[i].xy;
                vec2 ab = b - a;
                float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
                d = min(d, length(p - (a + ab * t)));
                b = a;
            }
        }
        return d;
    }

    void modifySplatCenter(inout vec3 center) {}
    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
        if (${HEIGHT} > ${OFF / 10}.0) return;
        float reach = ${EDGE_SIGMAS} * max(max(scale.x, scale.y), scale.z);
        // thick blobs go (a floor or wall splat is flat: thin on one side however wide it is);
        // the rest shrink to fit inside the nearest cut
        if (${EDGE_SIGMAS} * min(min(scale.x, scale.y), scale.z) > ${CLEAN}.y) {
            scale = vec3(0.0);
        } else if (reach > 0.0) {
            scale *= clamp(tourCutInset(modifiedCenter) / reach, 0.0, 1.0);
        }
    }
    void modifySplatColor(vec3 center, inout vec4 color) {
        if (center.y > ${HEIGHT} || center.y < ${BOTTOM} ||
            center.x < ${BOX}.x || center.z < ${BOX}.y || center.x > ${BOX}.z || center.z > ${BOX}.w) {
            color.a = 0.0;
            return;
        }
        int count = int(${OUTLINE_COUNT});
        if (count >= 3) {
            bool inside = false;
            vec2 b = ${OUTLINE}[count - 1].xy;
            for (int i = 0; i < ${MAX_OUTLINE_POINTS}; i++) {
                if (i >= count) break;
                vec2 a = ${OUTLINE}[i].xy;
                if ((a.y > center.z) != (b.y > center.z) &&
                    center.x < (b.x - a.x) * (center.z - a.y) / (b.y - a.y) + a.x) {
                    inside = !inside;
                }
                b = a;
            }
            if (!inside) {
                color.a = 0.0;
                return;
            }
        }
        // haze: faint splats go, and along the cuts only solid ones stay
        if (color.a < ${CLEAN}.x ||
            (color.a < ${CLEAN}.w && tourCutInset(center) < ${CLEAN}.z)) {
            color.a = 0.0;
        }
    }
`;

const WGSL = /* wgsl */ `
    uniform ${HEIGHT}: f32;
    uniform ${BOTTOM}: f32;
    uniform ${BOX}: vec4f;
    uniform ${OUTLINE}: array<vec4f, ${MAX_OUTLINE_POINTS}>;
    uniform ${OUTLINE_COUNT}: f32;
    uniform ${CLEAN}: vec4f;

    // distance from c inward to the nearest cut: the top, the bottom, the box and the outline
    fn tourCutInset(c: vec3f) -> f32 {
        let box = uniform.${BOX};
        var d = min(uniform.${HEIGHT} - c.y, c.y - uniform.${BOTTOM});
        d = min(d, min(min(c.x - box.x, box.z - c.x), min(c.z - box.y, box.w - c.z)));
        let count = i32(uniform.${OUTLINE_COUNT});
        if (count >= 3) {
            let p = c.xz;
            var b = uniform.${OUTLINE}[count - 1].xy;
            for (var i = 0; i < ${MAX_OUTLINE_POINTS}; i++) {
                if (i >= count) {
                    break;
                }
                let a = uniform.${OUTLINE}[i].xy;
                let ab = b - a;
                let t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
                d = min(d, length(p - (a + ab * t)));
                b = a;
            }
        }
        return d;
    }

    fn modifySplatCenter(center: ptr<function, vec3f>) {}
    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
        if (uniform.${HEIGHT} > ${OFF / 10}.0) {
            return;
        }
        let s = *scale;
        let reach = ${EDGE_SIGMAS} * max(max(s.x, s.y), s.z);
        // thick blobs go (a floor or wall splat is flat: thin on one side however wide it is);
        // the rest shrink to fit inside the nearest cut
        if (${EDGE_SIGMAS} * min(min(s.x, s.y), s.z) > uniform.${CLEAN}.y) {
            *scale = vec3f(0.0);
        } else if (reach > 0.0) {
            *scale = s * clamp(tourCutInset(modifiedCenter) / reach, 0.0, 1.0);
        }
    }
    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
        let box = uniform.${BOX};
        if (center.y > uniform.${HEIGHT} || center.y < uniform.${BOTTOM} ||
            center.x < box.x || center.z < box.y || center.x > box.z || center.z > box.w) {
            (*color).a = 0.0;
            return;
        }
        let count = i32(uniform.${OUTLINE_COUNT});
        if (count >= 3) {
            var inside = false;
            var b = uniform.${OUTLINE}[count - 1].xy;
            for (var i = 0; i < ${MAX_OUTLINE_POINTS}; i++) {
                if (i >= count) {
                    break;
                }
                let a = uniform.${OUTLINE}[i].xy;
                if ((a.y > center.z) != (b.y > center.z) &&
                    center.x < (b.x - a.x) * (center.z - a.y) / (b.y - a.y) + a.x) {
                    inside = !inside;
                }
                b = a;
            }
            if (!inside) {
                (*color).a = 0.0;
                return;
            }
        }
        // haze: faint splats go, and along the cuts only solid ones stay
        let clean = uniform.${CLEAN};
        let alpha = (*color).a;
        if (alpha < clean.x || (alpha < clean.w && tourCutInset(center) < clean.z)) {
            (*color).a = 0.0;
        }
    }
`;

class HeightCut {
    private _app: AppBase;

    private _gsplat: GSplatComponent;

    private _installed = false;

    /** World height the cut is easing toward; OFF for no cut. */
    private _target = OFF;

    /** World height currently applied. */
    private _current = OFF;

    /** Where a cut eases in from and out to: high enough that nothing of the floor is hidden. */
    private _top = 0;

    /** [minX, minZ, maxX, maxZ] kept while cutting. */
    private _box: number[] = NO_BOX;

    /** World height below which splats are hidden while cutting; -OFF keeps everything. */
    private _bottom = -OFF;

    /** Outline corners kept while cutting, packed one vec4 per corner. */
    private _outline = new Float32Array(MAX_OUTLINE_POINTS * 4);

    private _outlineCount = 0;

    private _cleanup: PlanCleanup = { ...DEFAULT_PLAN_CLEANUP };

    constructor(app: AppBase, gsplat: GSplatComponent) {
        this._app = app;
        this._gsplat = gsplat;
        app.on('update', this._update, this);
    }

    /** The world height being eased toward, or null for no cut. */
    get height(): number | null {
        return this._target >= OFF ? null : this._target;
    }

    /**
     * Cut at a world height, easing there from the current cut; null removes the cut, easing up
     * to `top` first so walls grow back rather than pop in.
     */
    set height(value: number | null) {
        const next = value === null || !Number.isFinite(value) ? OFF : value;
        if (next === this._target) return;
        if (!this._installed && next >= OFF) return;
        this._install();
        // easing from "off" starts at the top, where nothing is hidden yet
        if (this._current >= OFF) this._current = Math.max(this._top, next);
        this._target = next;
        this._app.renderNextFrame = true;
    }

    /** World height cuts ease in from and back out to. */
    set top(value: number) {
        this._top = value;
    }

    /** While cutting, hide splats below this world height (under the floor); null keeps all. */
    set bottom(value: number | null) {
        this._bottom = value === null || !Number.isFinite(value) ? -OFF : value;
        if (this._installed) this._apply(this._current);
    }

    /** The area kept while cutting, [minX, minZ, maxX, maxZ] in world space, or null for all. */
    set box(value: number[] | null) {
        this._box = value ?? NO_BOX;
        if (this._installed) this._apply(this._current);
    }

    /**
     * The outline kept while cutting, corners as [x, z] in world space (at most
     * MAX_OUTLINE_POINTS); fewer than three corners keeps everything the box does.
     */
    set outline(points: readonly (readonly [number, number])[]) {
        const count = Math.min(points.length, MAX_OUTLINE_POINTS);
        this._outline.fill(0);
        for (let i = 0; i < count; i++) {
            this._outline[i * 4] = points[i][0];
            this._outline[i * 4 + 1] = points[i][1];
        }
        this._outlineCount = count >= 3 ? count : 0;
        if (this._installed) this._apply(this._current);
    }

    /** How hard to clean haze while cutting. */
    get cleanup(): PlanCleanup {
        return { ...this._cleanup };
    }

    set cleanup(value: PlanCleanup) {
        this._cleanup = { ...value };
        if (this._installed) this._apply(this._current);
    }

    destroy() {
        this._app.off('update', this._update, this);
    }

    private _install() {
        if (this._installed) return;
        this._installed = true;
        this._gsplat.setWorkBufferModifier({ glsl: GLSL, wgsl: WGSL });
        this._apply(this._current);
    }

    private _update(dt: number) {
        if (!this._installed || this._current === this._target) return;

        const goal = this._target >= OFF ? this._top : this._target;
        const k = 1 - Math.exp(-dt / EASE_TIME);
        let next = this._current + (goal - this._current) * k;
        if (Math.abs(goal - next) < 0.002) next = goal;

        // reached the top on the way to "off": switch the cut, and the crop with it, off
        this._current = next === goal && this._target >= OFF ? OFF : next;
        this._apply(this._current);
    }

    private _apply(height: number) {
        const off = height >= OFF;
        this._gsplat.setParameter(HEIGHT, height);
        this._gsplat.setParameter(BOTTOM, off ? -OFF : this._bottom);
        this._gsplat.setParameter(BOX, off ? NO_BOX : this._box);
        this._gsplat.setParameter(`${OUTLINE}[0]`, this._outline);
        this._gsplat.setParameter(OUTLINE_COUNT, off ? 0 : this._outlineCount);
        const { haze, maxSize } = this._cleanup;
        this._gsplat.setParameter(
            CLEAN,
            off ? NO_CLEAN : [haze, maxSize ?? OFF, EDGE_BAND, Math.min(0.95, haze + EDGE_OPACITY_LIFT)]
        );
        this._gsplat.workBufferUpdate = WORKBUFFER_UPDATE_ONCE;
        this._app.renderNextFrame = true;
    }
}

export { DEFAULT_PLAN_CLEANUP, HeightCut, MAX_OUTLINE_POINTS };
export type { PlanCleanup };
