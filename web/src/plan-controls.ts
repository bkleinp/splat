import type { ViewerHandle } from '@playcanvas/supersplat-viewer/viewer';

// The bar at the top of a tour: a Walk / Floor plan switch, and in the floor plan a slider that
// cuts the walls down to see into the rooms from above.

/** Wall height shown when the floor plan opens, meters above the floor. */
const DEFAULT_CUT = 1.3;

/** Lowest cut the slider offers: below this the floor itself starts to disappear. */
const MIN_CUT = 0.2;

/** Highest cut the slider offers; at the top of its range nothing is cut. */
const MAX_CUT = 4;

const formatCut = (value: number, max: number) => (value >= max ? 'Full' : `${value.toFixed(1)} m`);

type PlanControls = {
    /** Open or close the floor plan, as the switch does. */
    setPlan(on: boolean): void;
    readonly plan: boolean;
};

const mountPlanControls = (host: HTMLElement, viewer: ViewerHandle): PlanControls => {
    const bar = document.createElement('div');
    bar.className = 'plan-bar';
    bar.hidden = true;
    bar.innerHTML = `
        <div class="view-switch" role="group" aria-label="View">
            <span class="thumb" aria-hidden="true"></span>
            <button type="button" data-view="walk" aria-pressed="true">Walk</button>
            <button type="button" data-view="plan" aria-pressed="false">Floor plan</button>
        </div>
        <label class="cut">
            <span class="cut-label">Walls</span>
            <input type="range" aria-label="Wall height">
            <output class="cut-value"></output>
        </label>
    `;
    host.append(bar);

    const switcher = bar.querySelector<HTMLElement>('.view-switch')!;
    const [walkButton, planButton] = switcher.querySelectorAll('button');
    const cut = bar.querySelector<HTMLElement>('.cut')!;
    const slider = cut.querySelector('input')!;
    const output = cut.querySelector('output')!;

    let plan = false;
    let cutValue = DEFAULT_CUT;
    let max = MAX_CUT;

    const render = () => {
        bar.classList.toggle('is-plan', plan);
        walkButton.setAttribute('aria-pressed', String(!plan));
        planButton.setAttribute('aria-pressed', String(plan));
        cut.hidden = !plan;
        slider.value = String(cutValue);
        output.textContent = formatCut(cutValue, max);
        slider.style.setProperty('--fill', `${((cutValue - MIN_CUT) / (max - MIN_CUT)) * 100}%`);
    };

    const applyCut = () => viewer.setCutHeight(plan && cutValue < max ? cutValue : null);

    const setPlan = (on: boolean) => {
        if (on === plan || !viewer.state.loaded) return;
        plan = on;
        viewer.setPlanView(on);
        if (on) {
            // the slider spans the height of the scene above this floor, up to MAX_CUT
            const info = viewer.getPlanInfo();
            max = Math.max(MIN_CUT + 0.5, Math.min(MAX_CUT, Math.round(info.height * 10) / 10));
            slider.min = String(MIN_CUT);
            slider.max = String(max);
            slider.step = '0.05';
            cutValue = Math.min(cutValue, max);
        }
        applyCut();
        render();
    };

    walkButton.addEventListener('click', () => setPlan(false));
    planButton.addEventListener('click', () => setPlan(true));
    slider.addEventListener('input', () => {
        cutValue = Number(slider.value);
        applyCut();
        render();
    });

    // keep the viewer's keyboard controls off while these controls have focus (arrow keys on
    // the slider would otherwise also move the camera)
    bar.addEventListener('focusin', () => (viewer.state.inputEnabled = false));
    bar.addEventListener('focusout', () => (viewer.state.inputEnabled = true));

    const show = () => {
        bar.hidden = false;
        render();
    };
    if (viewer.state.loaded) show();
    else viewer.events.once('loaded:changed', show);

    return {
        setPlan,
        get plan() {
            return plan;
        }
    };
};

export { mountPlanControls };
export type { PlanControls };
