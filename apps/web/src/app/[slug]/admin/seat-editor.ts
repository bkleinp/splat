import type { ViewerHandle } from '@playcanvas/supersplat-viewer/viewer';

import { readPose } from '@/components/tour/camera';
import { dirOf, yawOf, type Seat } from '@/lib/seats';

// Settings-page tool for seats (chairs, couches): add one in front of where you stand, then
// fine-tune it. Each seat shows as a marker in the walk view (click one to try it). Visitors who
// walk up to a seat see "Press F to sit".

/** How far in front of you "Add seat" places the seat, meters. */
const SEAT_AHEAD = 0.6;

/** Seated eye height above the floor, meters. */
const SEATED_EYE = 1.1;

/** Nudge steps: meters to move, degrees to turn. */
const STEP = 0.1;
const HEIGHT_STEP = 0.05;
const TURN = 15;

type SeatEditorOptions = {
    stage: HTMLElement;
    viewer: ViewerHandle;
    /** The seats in the draft. */
    get: () => Seat[];
    /** Store new seats in the draft. */
    set: (seats: Seat[]) => void;
};

const round = (v: number) => Math.round(v * 1000) / 1000;

const newId = () => `seat-${Math.random().toString(36).slice(2, 8)}`;

const mountSeatEditor = ({ stage, viewer, get, set }: SeatEditorOptions) => {
    const section = document.createElement('section');
    section.className = 'seats';
    section.innerHTML = `
        <h2>Seats</h2>
        <p class="hint">
            Stand in front of a chair or couch, face it, and click Add seat: it goes just in front
            of you, facing back toward where you stand. Visitors who walk up to a seat see
            “Press F to sit”. Click a marker in the view to try a seat.
        </p>
        <button type="button" class="primary wide" data-action="add">Add seat in front of me</button>
        <p class="seat-status hint"></p>
        <ol class="seat-list"></ol>
    `;
    const list = section.querySelector<HTMLOListElement>('.seat-list')!;
    const status = section.querySelector<HTMLElement>('.seat-status')!;
    const addButton = section.querySelector<HTMLButtonElement>('[data-action="add"]')!;

    // which seat the walker sits on, if any (to follow it when it's nudged)
    let sittingOn: string | null = null;
    const offSeated = viewer.events.on('seated:changed', (on: boolean, position?: number[]) => {
        // sat down some other way ("Press F to sit"): find the seat by where it is
        if (on && position) {
            const seat = get().find((s) => s.position.every((v, i) => Math.abs(v - position[i]) < 1e-3));
            sittingOn = seat?.id ?? null;
        }
        if (!on) sittingOn = null;
        render();
    });

    const say = (text: string) => (status.textContent = text);

    /** A seat in front of where the walker stands, facing back toward them. */
    const seatHere = (): Pick<Seat, 'position' | 'yaw'> | null => {
        if (!viewer.state.loaded) return null;
        if (viewer.isSeated()) {
            say('Stand up first (press F), then place the seat.');
            return null;
        }
        if (viewer.getPlanInfo().active) {
            say('Switch to Walk first, then place the seat.');
            return null;
        }
        const pose = readPose(viewer);
        if (!pose?.forward) return null;
        const [px, , pz] = pose.position;
        const [ax, , az] = pose.forward;
        const flen = Math.hypot(ax, az) || 1;
        const fx = ax / flen;
        const fz = az / flen;
        const floor = viewer.getPlanInfo().floor;
        return {
            position: [round(px + fx * SEAT_AHEAD), round(floor + SEATED_EYE), round(pz + fz * SEAT_AHEAD)],
            yaw: round(yawOf(-fx, -fz))
        };
    };

    const update = (id: string, change: (seat: Seat) => Seat) => {
        const seats = get().map((s) => (s.id === id ? change(structuredClone(s)) : s));
        set(seats);
        // sitting on it: follow the change
        const seat = seats.find((s) => s.id === id);
        if (seat && sittingOn === id) viewer.sitAt(seat);
        render();
    };

    const sit = (seat: Seat) => {
        if (!viewer.state.loaded) return;
        if (viewer.getPlanInfo().active) {
            say('Switch to Walk to try a seat.');
            return;
        }
        if (viewer.sitAt(seat)) sittingOn = seat.id;
        render();
    };

    addButton.addEventListener('click', () => {
        const placed = seatHere();
        if (!placed) return;
        const seats = get();
        const seat: Seat = { id: newId(), name: `Seat ${seats.length + 1}`, ...placed };
        set([...seats, seat]);
        say(`Added "${seat.name}". Rename it below, and click Sit to try it.`);
        render();
    });

    const button = (label: string, title: string, onClick: () => void) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.addEventListener('click', onClick);
        return b;
    };

    const render = () => {
        list.replaceChildren();
        for (const seat of get()) {
            const li = document.createElement('li');
            li.className = 'seat-row';
            if (sittingOn === seat.id) li.classList.add('sitting');

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = seat.name;
            nameInput.setAttribute('aria-label', 'Seat name');
            nameInput.addEventListener('change', () => {
                const name = nameInput.value.trim() || seat.name;
                update(seat.id, (s) => ({ ...s, name }));
            });

            // nudges, in the seat's own frame: forward is the way it faces
            const move = (forward: number, right: number) =>
                update(seat.id, (s) => {
                    const [fx, fz] = dirOf(s.yaw);
                    // right of a heading is the heading turned 90 degrees clockwise (seen from above)
                    const rx = -fz;
                    const rz = fx;
                    s.position = [
                        round(s.position[0] + fx * forward + rx * right),
                        s.position[1],
                        round(s.position[2] + fz * forward + rz * right)
                    ];
                    return s;
                });

            const nudges = document.createElement('div');
            nudges.className = 'seat-nudges';
            nudges.append(
                button('↑', 'Move forward 10 cm', () => move(STEP, 0)),
                button('↓', 'Move back 10 cm', () => move(-STEP, 0)),
                button('←', 'Move left 10 cm', () => move(0, -STEP)),
                button('→', 'Move right 10 cm', () => move(0, STEP)),
                button('⟲', 'Turn left 15°', () => update(seat.id, (s) => ({ ...s, yaw: round(s.yaw + TURN) }))),
                button('⟳', 'Turn right 15°', () => update(seat.id, (s) => ({ ...s, yaw: round(s.yaw - TURN) }))),
                button('▲', 'Raise eye 5 cm', () =>
                    update(seat.id, (s) => ({ ...s, position: [s.position[0], round(s.position[1] + HEIGHT_STEP), s.position[2]] }))
                ),
                button('▼', 'Lower eye 5 cm', () =>
                    update(seat.id, (s) => ({ ...s, position: [s.position[0], round(s.position[1] - HEIGHT_STEP), s.position[2]] }))
                )
            );

            const actions = document.createElement('div');
            actions.className = 'buttons';
            actions.append(
                sittingOn === seat.id
                    ? button('Stand', 'Stand up', () => viewer.standUp())
                    : button('Sit', 'Try this seat', () => sit(seat)),
                button('Move here', 'Move this seat in front of where you stand', () => {
                    const placed = seatHere();
                    if (placed) update(seat.id, (s) => ({ ...s, ...placed }));
                }),
                button('Delete', 'Delete this seat', () => {
                    if (sittingOn === seat.id) viewer.standUp();
                    set(get().filter((s) => s.id !== seat.id));
                    render();
                })
            );

            li.append(nameInput, nudges, actions);
            list.append(li);
        }
        if (get().length === 0) say('No seats yet.');
    };

    // --- markers in the view: one per seat, click to sit

    const markers = document.createElement('div');
    markers.className = 'seat-markers';
    stage.append(markers);

    let frame = 0;
    const draw = () => {
        frame = requestAnimationFrame(draw);
        const seats = get();
        const show = viewer.state.loaded && !viewer.getPlanInfo().active && !viewer.isSeated();
        markers.hidden = !show;
        if (!show) return;
        const canvas = stage.querySelector('canvas');
        const c = canvas?.getBoundingClientRect();
        const s = markers.getBoundingClientRect();
        const ox = c ? c.left - s.left : 0;
        const oy = c ? c.top - s.top : 0;
        while (markers.childElementCount > seats.length) markers.lastChild!.remove();
        while (markers.childElementCount < seats.length) {
            const marker = document.createElement('button');
            marker.type = 'button';
            marker.className = 'seat-marker';
            marker.addEventListener('click', () => {
                const seat = get().find((x) => x.id === marker.dataset.id);
                if (seat) sit(seat);
            });
            markers.append(marker);
        }
        seats.forEach((seat, i) => {
            const marker = markers.children[i] as HTMLButtonElement;
            // the marker sits about at the cushion, below the seated eye
            const p = viewer.worldToScreen(seat.position[0], seat.position[1] - 0.5, seat.position[2]);
            marker.dataset.id = seat.id;
            marker.title = `Sit: ${seat.name}`;
            marker.textContent = seat.name;
            marker.style.display = p ? '' : 'none';
            if (p) marker.style.transform = `translate(${p[0] + ox}px, ${p[1] + oy}px) translate(-50%, -50%)`;
        });
    };
    frame = requestAnimationFrame(draw);

    render();
    if (get().length > 0) say('');

    return {
        section,
        /** Show the draft's seats again (after Revert). */
        refresh: () => {
            if (sittingOn && !get().some((s) => s.id === sittingOn)) viewer.standUp();
            render();
        },
        destroy: () => {
            cancelAnimationFrame(frame);
            offSeated.off();
            markers.remove();
        }
    };
};

export { mountSeatEditor };
