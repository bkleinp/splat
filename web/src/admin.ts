import { defaultSettings, POST_EFFECT_RANGES } from '@playcanvas/supersplat-viewer/settings';
import { DEFAULT_WALK_SETTINGS } from '@playcanvas/supersplat-viewer/viewer';
import type { ViewerHandle, WalkSettings } from '@playcanvas/supersplat-viewer/viewer';

import { applyToAllTours, listTours, saveTour } from './tours';
import type { Tour } from './tours';

// Settings panel for /<tour>/admin: every change previews live in the viewer beside it; Save
// writes web/tours/<tour>.json, and "Apply to all tours" copies the walk + look settings to every
// tour file (start position and background stay per tour).

type Slider = { label: string; unit: string; min: number; max: number; step: number; hint?: string };

const WALK_SLIDERS: Record<keyof WalkSettings, Slider> = {
    speed: { label: 'Walking speed', unit: 'm/s', min: 0.5, max: 3, step: 0.05, hint: 'People walk at about 1.4. Shift doubles it.' },
    responseTime: { label: 'Start / stop smoothness', unit: 's', min: 0.05, max: 1, step: 0.01, hint: 'Higher feels heavier, lower snappier.' },
    headBob: { label: 'Head bob', unit: '×', min: 0, max: 3, step: 0.05, hint: '0 off, 1 subtle. Off for viewers with reduced motion on.' },
    stepLength: { label: 'Step length', unit: 'm', min: 0.4, max: 1.2, step: 0.01, hint: 'The bob rhythm. Shorter is quicker steps.' },
    eyeHeight: { label: 'Eye height', unit: 'm', min: 1.2, max: 2, step: 0.01, hint: 'Above the floor.' },
    fov: { label: 'Field of view', unit: '°', min: 50, max: 110, step: 1, hint: 'Lower looks more natural, higher shows more of the room.' }
};

const clone = <T>(value: T): T => structuredClone(value);

const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
    ...children: (Node | string)[]
) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
};

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length;

const sliderRow = (
    slider: Slider,
    get: () => number,
    set: (value: number) => void
): { row: HTMLElement; refresh: () => void } => {
    const input = el('input', { type: 'range', min: String(slider.min), max: String(slider.max), step: String(slider.step) });
    const value = el('output', { className: 'value' });
    const refresh = () => {
        input.value = String(get());
        value.textContent = `${get().toFixed(decimals(slider.step))} ${slider.unit}`;
    };
    input.addEventListener('input', () => {
        set(Number(input.value));
        value.textContent = `${Number(input.value).toFixed(decimals(slider.step))} ${slider.unit}`;
    });
    const row = el(
        'label',
        { className: 'row' },
        el('span', { className: 'row-head' }, el('span', { className: 'name' }, slider.label), value),
        input,
        ...(slider.hint ? [el('span', { className: 'hint' }, slider.hint)] : [])
    );
    refresh();
    return { row, refresh };
};

const toggleRow = (label: string, get: () => boolean, set: (on: boolean) => void) => {
    const input = el('input', { type: 'checkbox' });
    const refresh = () => {
        input.checked = get();
    };
    input.addEventListener('change', () => set(input.checked));
    const row = el('label', { className: 'row toggle' }, input, el('span', { className: 'name' }, label));
    refresh();
    return { row, refresh };
};

const mountAdmin = (panel: HTMLElement, name: string, tour: Tour, viewer: ViewerHandle) => {
    let saved = clone(tour);
    let draft = clone(tour);
    draft.walk = { ...DEFAULT_WALK_SETTINGS, ...draft.walk };
    draft.viewer.postEffectSettings ??= defaultSettings().postEffectSettings;

    const refreshers: (() => void)[] = [];
    const status = el('p', { className: 'status' });
    const saveButton = el('button', { className: 'primary', type: 'button' }, 'Save');
    const revertButton = el('button', { type: 'button' }, 'Revert');

    const isDirty = () => JSON.stringify(draft) !== JSON.stringify(saved);
    const updateDirty = () => {
        const dirty = isDirty();
        saveButton.disabled = !dirty;
        revertButton.disabled = !dirty;
        if (dirty) status.textContent = 'Unsaved changes';
    };
    const say = (message: string, error = false) => {
        status.textContent = message;
        status.classList.toggle('error', error);
    };

    const applyAll = () => {
        viewer.setWalkSettings(draft.walk);
        viewer.setPostEffects(draft.viewer.postEffectSettings);
        refreshers.forEach((refresh) => refresh());
        updateDirty();
    };

    // --- walking
    const walkSection = el('section', {}, el('h2', {}, 'Walking'));
    for (const key of Object.keys(WALK_SLIDERS) as (keyof WalkSettings)[]) {
        const { row, refresh } = sliderRow(
            WALK_SLIDERS[key],
            () => draft.walk[key] ?? DEFAULT_WALK_SETTINGS[key],
            (value) => {
                draft.walk[key] = value;
                viewer.setWalkSettings({ [key]: value });
                updateDirty();
            }
        );
        refreshers.push(refresh);
        walkSection.append(row);
    }

    // --- look
    const fx = () => draft.viewer.postEffectSettings;
    const lookChanged = () => {
        viewer.setPostEffects(fx());
        updateDirty();
    };
    const lookSection = el('section', {}, el('h2', {}, 'Look'));
    const lookControls: [string, () => boolean, (on: boolean) => void, [string, Slider, () => number, (v: number) => void][]][] =
        [
            [
                'Sharpen',
                () => fx().sharpness.enabled,
                (on) => (fx().sharpness.enabled = on),
                [['amount', { label: 'Amount', unit: '', ...POST_EFFECT_RANGES.sharpness.amount }, () => fx().sharpness.amount, (v) => (fx().sharpness.amount = v)]]
            ],
            [
                'Color grading',
                () => fx().grading.enabled,
                (on) => (fx().grading.enabled = on),
                [
                    ['brightness', { label: 'Brightness', unit: '', ...POST_EFFECT_RANGES.grading.brightness, max: 2 }, () => fx().grading.brightness, (v) => (fx().grading.brightness = v)],
                    ['contrast', { label: 'Contrast', unit: '', ...POST_EFFECT_RANGES.grading.contrast }, () => fx().grading.contrast, (v) => (fx().grading.contrast = v)],
                    ['saturation', { label: 'Saturation', unit: '', ...POST_EFFECT_RANGES.grading.saturation }, () => fx().grading.saturation, (v) => (fx().grading.saturation = v)]
                ]
            ],
            [
                'Vignette',
                () => fx().vignette.enabled,
                (on) => (fx().vignette.enabled = on),
                [['intensity', { label: 'Intensity', unit: '', ...POST_EFFECT_RANGES.vignette.intensity }, () => fx().vignette.intensity, (v) => (fx().vignette.intensity = v)]]
            ]
        ];
    for (const [label, getOn, setOn, sliders] of lookControls) {
        const group = el('div', { className: 'group' });
        const rows = sliders.map(([, slider, get, set]) => {
            const result = sliderRow(slider, get, (v) => {
                set(v);
                lookChanged();
            });
            refreshers.push(result.refresh);
            return result.row;
        });
        const syncDisabled = () => group.classList.toggle('off', !getOn());
        const toggle = toggleRow(label, getOn, (on) => {
            setOn(on);
            syncDisabled();
            lookChanged();
        });
        refreshers.push(toggle.refresh, syncDisabled);
        group.append(toggle.row, ...rows);
        syncDisabled();
        lookSection.append(group);
    }
    lookSection.append(el('p', { className: 'hint' }, 'Keep it subtle: buyers should see the home as it is.'));

    // --- actions
    saveButton.addEventListener('click', async () => {
        try {
            await saveTour(name, draft);
            saved = clone(draft);
            updateDirty();
            say(`Saved to web/tours/${name}.json`);
        } catch (err) {
            say(`Save failed: ${(err as Error).message}`, true);
        }
    });

    revertButton.addEventListener('click', () => {
        draft = clone(saved);
        draft.walk = { ...DEFAULT_WALK_SETTINGS, ...draft.walk };
        applyAll();
        say('Reverted to the last save');
    });

    const defaultsButton = el('button', { type: 'button' }, 'Defaults');
    defaultsButton.addEventListener('click', () => {
        draft.walk = { ...DEFAULT_WALK_SETTINGS };
        draft.viewer.postEffectSettings = defaultSettings().postEffectSettings;
        applyAll();
        say('Defaults loaded. Save to keep them.');
    });

    const applyAllButton = el('button', { type: 'button', className: 'wide' }, 'Apply to all tours');
    applyAllButton.addEventListener('click', async () => {
        try {
            const tours = await listTours();
            const ok = window.confirm(
                `Copy this tour's walking and look settings to all ${tours.length} tours?` +
                    (isDirty() ? '\n\nThis tour is saved first.' : '') +
                    '\n\nStart position and background stay per tour.'
            );
            if (!ok) return;
            if (isDirty()) {
                await saveTour(name, draft);
                saved = clone(draft);
            }
            const { updated } = await applyToAllTours(name);
            updateDirty();
            say(`Applied to ${updated.length} tours: ${updated.join(', ')}`);
        } catch (err) {
            say(`Apply failed: ${(err as Error).message}`, true);
        }
    });

    const body = el(
        'div',
        { className: 'panel-body' },
        el(
            'header',
            {},
            el('p', { className: 'eyebrow' }, 'Tour settings'),
            el('h1', {}, tour.title),
            el('a', { href: `/${name}`, target: '_blank' }, 'Open tour ↗')
        ),
        walkSection,
        lookSection,
        el(
            'footer',
            {},
            el('div', { className: 'buttons' }, saveButton, revertButton, defaultsButton),
            applyAllButton,
            status
        )
    );

    const collapse = el('button', { type: 'button', className: 'collapse', title: 'Hide settings' }, '›');
    collapse.addEventListener('click', () => {
        const hidden = panel.classList.toggle('collapsed');
        collapse.textContent = hidden ? '‹' : '›';
        collapse.title = hidden ? 'Show settings' : 'Hide settings';
    });

    panel.append(collapse, body);

    // arrow keys and WASD belong to the slider being dragged, not the walk, while the panel has focus
    panel.addEventListener('focusin', () => (viewer.state.inputEnabled = false));
    panel.addEventListener('focusout', () => (viewer.state.inputEnabled = true));

    // settings from the file, applied on top of the viewer's defaults
    applyAll();
    say('Changes preview live. Save writes the tour file.');

    window.addEventListener('beforeunload', (event) => {
        if (isDirty()) event.preventDefault();
    });
};

export { mountAdmin };
