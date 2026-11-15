/**
 * Where the browser loads a tour's skybox from. A local path (/samples/...) is used as is; an image
 * on another site goes through this app's /api/tours/<name>/skybox, which fetches it server-side:
 * browsers won't put a cross-site image into WebGL unless that site sends CORS headers, and
 * superspl.at's skyboxes don't.
 */
export function skyboxSrc(name: string, tour: { skybox?: string | null }): string | undefined {
  if (!tour.skybox) return undefined;
  return /^https?:\/\//i.test(tour.skybox) ? `/api/tours/${encodeURIComponent(name)}/skybox` : tour.skybox;
}
