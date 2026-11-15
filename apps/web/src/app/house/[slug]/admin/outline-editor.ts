import type { ViewerHandle } from '@playcanvas/supersplat-viewer/viewer';

/** The Walk / Floor plan switch, as the settings page needs it (backed by usePlanView). */
type PlanSwitch = {
    /** Open or close the floor plan, as the switch does. */
    setPlan(on: boolean): void;
    readonly plan: boolean;
};

// Settings-page tool for the floor plan outline (ported from the tours app): drawn on the top-down view around the home.
// The floor plan then hides everything outside it (the backdrop the walk needs for the view out of
// the windows, which looks broken from above) and centers on it.
//
// While drawing, the floor plan shows everything, and the outline is an overlay:
//   click        add a corner
//   drag         move a corner
//   double-click remove a corner (right-click too)
//   scroll       zoom

type Point = [number, number];

/** Most corners an outline can have (the viewer's limit). */
const MAX_POINTS = 48;

/** Pointer travel, in pixels, under which a press on the map counts as a click. */
const CLICK_SLOP = 5;

const SVG = 'http://www.w3.org/2000/svg';

type OutlineEditorOptions = {
    stage: HTMLElement;
    viewer: ViewerHandle;
    planControls: PlanSwitch;
    /** The outline in the draft (null: none, the floor is found automatically). */
    get: () => Point[] | null;
    /** Store a new outline in the draft. */
    set: (outline: Point[] | null) => void;
    /** The below-floor trim in the draft: a world height, or null for none. */
    getBottom: () => number | null;
    /** Store a new below-floor trim in the draft. */
    setBottom: (y: number | null) => void;
    /** The haze cleanup in the draft (unset fields use the viewer's defaults). */
    getCleanup: () => { haze?: number; maxSize?: number | null } | undefined;
    /** Store a new haze cleanup in the draft. */
    setCleanup: (cleanup: { haze: number; maxSize: number | null }) => void;
};

/** Haze slider: opacity bar, 0 to this. */
const MAX_HAZE = 0.8;

/** Large-splat slider: sizes in meters from smallest to largest; past the largest is "Off". */
const MIN_SIZE = 0.03;
const MAX_SIZE = 1;

/** Deepest trim the slider offers below the floor, meters; past it is "Off". */
const MAX_TRIM_DEPTH = 1.5;
const TRIM_STEP = 0.05;

const mountOutlineEditor = ({
    stage,
    viewer,
    planControls,
    get,
    set,
    getBottom,
    setBottom,
    getCleanup,
    setCleanup
}: OutlineEditorOptions) => {
    const section = document.createElement('section');
    section.innerHTML = `
        <h2>Floor plan cleanup</h2>
        <p class="hint">
            Outline the home on the floor plan. Everything outside it is hidden in the floor plan
            only (walking still shows it, like the view out of the windows), and the floor plan
            centers on it.
        </p>
        <p class="outline-status"></p>
        <div class="buttons outline-idle">
            <button type="button" class="primary" data-action="draw"></button>
            <button type="button" data-action="remove">Remove</button>
        </div>
        <div class="outline-drawing" hidden>
            <p class="hint">
                Click the floor plan to add corners around the home. Drag a corner to move it;
                double-click it to remove it. Scroll to zoom.
            </p>
            <div class="buttons">
                <button type="button" data-action="undo">Undo corner</button>
                <button type="button" data-action="clear">Clear</button>
            </div>
            <button type="button" class="primary wide" data-action="done">Done</button>
        </div>
        <label class="row trim">
            <span class="row-head"><span class="name">Trim below floor</span><output class="value"></output></span>
            <input type="range" min="0" max="${MAX_TRIM_DEPTH + TRIM_STEP}" step="${TRIM_STEP}">
            <span class="hint">
                Hides what's under the floor in the floor plan (seen when it's tilted). Move left
                until the mess underneath is gone but the floor still shows. Right end is off.
            </span>
        </label>
        <label class="row haze">
            <span class="row-head"><span class="name">Remove haze</span><output class="value"></output></span>
            <input type="range" min="0" max="${MAX_HAZE}" step="0.01">
            <span class="hint">
                Hides faint, see-through splats (smoke, fuzz) in the floor plan, extra hard along
                the cut walls and the outline. Too far and walls get holes.
            </span>
        </label>
        <label class="row blobs">
            <span class="row-head"><span class="name">Remove large blobs</span><output class="value"></output></span>
            <input type="range" min="0" max="1.02" step="0.01">
            <span class="hint">
                Hides splats bigger than the size shown (soft blobs and smears). Move left from
                Off until the blobs go but floors and walls stay solid.
            </span>
        </label>
    `;
    const status = section.querySelector<HTMLElement>('.outline-status')!;
    const idle = section.querySelector<HTMLElement>('.outline-idle')!;
    const drawing = section.querySelector<HTMLElement>('.outline-drawing')!;
    const button = (action: string) => section.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
    const drawButton = button('draw');
    const removeButton = button('remove');
    const undoButton = button('undo');
    const clearButton = button('clear');

    // --- overlay

    const overlay = document.createElementNS(SVG, 'svg');
    overlay.classList.add('outline-overlay');
    overlay.style.display = 'none';
    const shape = document.createElementNS(SVG, 'polygon');
    shape.classList.add('outline-shape');
    const handles = document.createElementNS(SVG, 'g');
    overlay.append(shape, handles);
    stage.append(overlay);

    const canvas = () => stage.querySelector('canvas');

    let editing = false;
    let points: Point[] = [];
    let frame = 0;

    // canvas-relative pixels <-> overlay pixels (the canvas may not sit exactly at the stage's corner)
    const offset = () => {
        const c = canvas()?.getBoundingClientRect();
        const s = overlay.getBoundingClientRect();
        return c ? [c.left - s.left, c.top - s.top] : [0, 0];
    };

    const draw = () => {
        const [ox, oy] = offset();
        const screen = points.map(([x, z]) => viewer.floorToScreen(x, z));
        shape.setAttribute(
            'points',
            screen
                .filter((p): p is Point => p !== null)
                .map(([x, y]) => `${x + ox},${y + oy}`)
                .join(' ')
        );
        shape.classList.toggle('open', points.length < 3);
        while (handles.childElementCount > points.length) handles.lastChild!.remove();
        while (handles.childElementCount < points.length) {
            const handle = document.createElementNS(SVG, 'circle');
            handle.classList.add('outline-handle');
            handle.setAttribute('r', '7');
            handles.append(handle);
        }
        screen.forEach((p, i) => {
            const handle = handles.children[i] as SVGCircleElement;
            handle.dataset.index = String(i);
            handle.style.display = p ? '' : 'none';
            if (p) {
                handle.setAttribute('cx', String(p[0] + ox));
                handle.setAttribute('cy', String(p[1] + oy));
            }
        });
    };

    // the camera keeps moving (zoom, the flight up), so follow it every frame while drawing
    const loop = () => {
        if (!editing) return;
        draw();
        frame = requestAnimationFrame(loop);
    };

    const toFloor = (event: PointerEvent | MouseEvent): Point | null => {
        const c = canvas()?.getBoundingClientRect();
        if (!c) return null;
        return viewer.screenToFloor(event.clientX - c.left, event.clientY - c.top);
    };

    // --- state

    const describe = () => {
        const outline = get();
        status.textContent = editing
            ? `${points.length} corner${points.length === 1 ? '' : 's'}${points.length > 0 && points.length < 3 ? ' (needs at least 3)' : ''}`
            : outline
              ? `Outline with ${outline.length} corners.`
              : 'No outline: the floor plan finds the floor automatically.';
        drawButton.textContent = get() ? 'Edit outline' : 'Draw outline';
        removeButton.disabled = !get();
        undoButton.disabled = points.length === 0;
        clearButton.disabled = points.length === 0;
    };

    const commit = () => {
        set(points.length >= 3 ? points.map(([x, z]) => [x, z]) : null);
    };

    const start = () => {
        if (editing || !viewer.state.loaded) return;
        editing = true;
        points = (get() ?? []).map(([x, z]) => [x, z]);
        planControls.setPlan(true);
        viewer.setPlanOutline([], false); // show everything while drawing
        overlay.style.display = '';
        idle.hidden = true;
        drawing.hidden = false;
        describe();
        loop();
    };

    const finish = () => {
        if (!editing) return;
        editing = false;
        cancelAnimationFrame(frame);
        overlay.style.display = 'none';
        idle.hidden = false;
        drawing.hidden = true;
        commit();
        viewer.setPlanOutline(get());
        describe();
    };

    const changed = () => {
        draw();
        describe();
    };

    // --- pointer: click to add, drag to move, double-click to remove

    let press: { x: number; y: number; index: number; moved: boolean; id: number } | null = null;

    overlay.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const target = event.target as Element;
        const index = target.classList.contains('outline-handle') ? Number((target as SVGElement).dataset.index) : -1;
        press = { x: event.clientX, y: event.clientY, index, moved: false, id: event.pointerId };
        try {
            overlay.setPointerCapture(event.pointerId);
        } catch {
            // a synthetic or already-ended pointer: dragging just won't follow outside the overlay
        }
        event.preventDefault();
    });

    overlay.addEventListener('pointermove', (event) => {
        if (!press || event.pointerId !== press.id) return;
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP) press.moved = true;
        if (press.index >= 0 && press.moved) {
            const p = toFloor(event);
            if (p) {
                points[press.index] = p;
                changed();
            }
        }
    });

    overlay.addEventListener('pointerup', (event) => {
        if (!press || event.pointerId !== press.id) return;
        const { index, moved } = press;
        press = null;
        if (index < 0 && !moved && points.length < MAX_POINTS) {
            const p = toFloor(event);
            if (p) {
                points.push(p);
                changed();
            }
        }
    });

    overlay.addEventListener('pointercancel', () => (press = null));

    const removeAt = (event: MouseEvent) => {
        const target = event.target as Element;
        if (!target.classList.contains('outline-handle')) return;
        event.preventDefault();
        points.splice(Number((target as SVGElement).dataset.index), 1);
        changed();
    };
    overlay.addEventListener('dblclick', removeAt);
    overlay.addEventListener('contextmenu', removeAt);

    // scroll zooms the floor plan underneath
    overlay.addEventListener(
        'wheel',
        (event) => {
            event.preventDefault();
            canvas()?.dispatchEvent(new WheelEvent('wheel', event));
        },
        { passive: false }
    );

    // --- buttons

    drawButton.addEventListener('click', start);
    removeButton.addEventListener('click', () => {
        set(null);
        viewer.setPlanOutline(null);
        describe();
    });
    undoButton.addEventListener('click', () => {
        points.pop();
        changed();
    });
    clearButton.addEventListener('click', () => {
        points = [];
        changed();
    });
    button('done').addEventListener('click', finish);

    // leaving the floor plan (the Walk switch) ends drawing, keeping the corners
    const planChanged = viewer.events.on('planView:changed', (on: boolean) => {
        if (!on) finish();
        showTrim();
    });

    // --- trim below the floor: stored as a world height, shown as a depth under the floor the
    // floor plan was opened on (or the walker stands on)

    const trim = section.querySelector<HTMLInputElement>('.trim input')!;
    const trimValue = section.querySelector<HTMLOutputElement>('.trim output')!;
    const floor = () => viewer.getPlanInfo().floor;

    const showTrim = () => {
        if (!viewer.state.loaded) {
            trimValue.textContent = '…';
            return;
        }
        const bottom = getBottom();
        const depth = bottom === null ? null : Math.max(0, floor() - bottom);
        trim.value = String(depth === null ? MAX_TRIM_DEPTH + TRIM_STEP : Math.min(depth, MAX_TRIM_DEPTH));
        trimValue.textContent = depth === null ? 'Off' : `${depth.toFixed(2)} m`;
    };

    trim.addEventListener('input', () => {
        if (!viewer.state.loaded) return;
        // the trim only shows in the floor plan
        if (!planControls.plan) planControls.setPlan(true);
        const depth = Number(trim.value);
        const bottom = depth > MAX_TRIM_DEPTH ? null : floor() - depth;
        setBottom(bottom);
        viewer.setPlanBottom(bottom);
        trimValue.textContent = bottom === null ? 'Off' : `${depth.toFixed(2)} m`;
    });

    if (viewer.state.loaded) showTrim();
    else viewer.events.once('loaded:changed', showTrim);

    // --- haze and large blobs: the viewer's defaults until the tour sets its own

    const haze = section.querySelector<HTMLInputElement>('.haze input')!;
    const hazeValue = section.querySelector<HTMLOutputElement>('.haze output')!;
    const blobs = section.querySelector<HTMLInputElement>('.blobs input')!;
    const blobsValue = section.querySelector<HTMLOutputElement>('.blobs output')!;

    // the size slider is logarithmic: fine steps at small sizes; past 1 is off
    const sizeAt = (t: number) => (t > 1 ? null : MIN_SIZE * Math.pow(MAX_SIZE / MIN_SIZE, t));
    const tAt = (size: number | null) => (size === null ? 1.02 : Math.log(size / MIN_SIZE) / Math.log(MAX_SIZE / MIN_SIZE));

    const cleanup = () => ({ ...viewer.getPlanInfo().cleanup, ...getCleanup() });

    const showCleanup = () => {
        if (!viewer.state.loaded) return;
        const { haze: h, maxSize } = cleanup();
        haze.value = String(h);
        hazeValue.textContent = `${Math.round(h * 100)}%`;
        blobs.value = String(tAt(maxSize ?? null));
        blobsValue.textContent = maxSize === null || maxSize === undefined ? 'Off' : `${Math.round(maxSize * 100)} cm`;
    };

    const cleanupChanged = () => {
        if (!viewer.state.loaded) return;
        if (!planControls.plan) planControls.setPlan(true);
        const next = { haze: Number(haze.value), maxSize: sizeAt(Number(blobs.value)) };
        setCleanup(next);
        viewer.setPlanCleanup(next);
        showCleanup();
    };
    haze.addEventListener('input', cleanupChanged);
    blobs.addEventListener('input', cleanupChanged);

    if (viewer.state.loaded) showCleanup();
    else viewer.events.once('loaded:changed', showCleanup);

    describe();

    return {
        section,
        /** Take the overlay off the stage and stop listening (the page is unmounting). */
        destroy: () => {
            editing = false;
            cancelAnimationFrame(frame);
            planChanged.off();
            overlay.remove();
        },
        /** Show the draft's outline again (after Revert). */
        refresh: () => {
            if (editing) {
                points = (get() ?? []).map(([x, z]) => [x, z]);
                viewer.setPlanOutline([], false); // still drawing: keep showing everything
                changed();
            } else {
                describe();
            }
            showTrim();
            showCleanup();
        }
    };
};

export { mountOutlineEditor };
export type { PlanSwitch };
