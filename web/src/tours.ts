import type { ExperienceSettings, WalkSettings } from '@playcanvas/supersplat-viewer/viewer';

/** One tour: a splat scan plus how it should look and feel. Stored as web/tours/<name>.json. */
type Tour = {
    title: string;
    /** Attribution / licence note for the scan. */
    credit?: string;
    /** Splat url (.sog, .ply, meta.json, lod-meta.json, ...). */
    content: string;
    /** Walk-mode collision (voxel .json or .glb). Without it walking has no walls. */
    collision?: string | null;
    /** Anti-aliasing compensation override; unset follows the file. */
    aa?: boolean;
    /** Viewer experience settings: start camera, background, tonemapping, post effects. */
    viewer: ExperienceSettings;
    /** Walking feel. */
    walk: Partial<WalkSettings>;
};

type TourSummary = { name: string; title: string };

// The built site has no API: it reads the tour files bundled at build time. In development the
// API is used instead, so saves from the admin page show up without a rebuild.
const bundled = import.meta.glob<Tour>('../tours/*.json', { import: 'default' });
const bundledName = (path: string) => path.split('/').pop()!.replace(/\.json$/, '');

const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
    return body as T;
};

const listTours = async (): Promise<TourSummary[]> => {
    if (import.meta.env.DEV) return api<TourSummary[]>('/api/tours');
    return Promise.all(
        Object.entries(bundled).map(async ([path, load]) => ({
            name: bundledName(path),
            title: (await load()).title
        }))
    );
};

const loadTour = async (name: string): Promise<Tour | null> => {
    if (import.meta.env.DEV) {
        try {
            return await api<Tour>(`/api/tours/${encodeURIComponent(name)}`);
        } catch {
            return null;
        }
    }
    const entry = Object.entries(bundled).find(([path]) => bundledName(path) === name);
    return entry ? entry[1]() : null;
};

const saveTour = (name: string, tour: Tour) =>
    api<{ saved: string }>(`/api/tours/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(tour)
    });

/** Copy this tour's saved walk + look settings onto every tour. */
const applyToAllTours = (name: string) =>
    api<{ updated: string[] }>(`/api/tours/${encodeURIComponent(name)}/apply-to-all`, { method: 'POST' });

export { applyToAllTours, listTours, loadTour, saveTour };
export type { Tour, TourSummary };
