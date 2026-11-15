import type { Tour, TourSummary } from '@/lib/tours';

// Browser side of the dev-only tour API (app/api/tours): the settings panel saves through it.

const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
    return body as T;
};

const listTours = () => api<TourSummary[]>('/api/tours');

const saveTour = (name: string, tour: Tour) =>
    api<{ saved: string }>(`/api/tours/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(tour)
    });

/** Copy this tour's saved walk + look settings onto every tour. */
const applyToAllTours = (name: string) =>
    api<{ updated: string[] }>(`/api/tours/${encodeURIComponent(name)}/apply-to-all`, { method: 'POST' });

export { applyToAllTours, listTours, saveTour };
