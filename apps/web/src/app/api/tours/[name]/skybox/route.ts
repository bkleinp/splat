import { loadTour } from "@/lib/tours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A tour's skybox, fetched server-side from the site in the tour file and passed on. Browsers won't
// put a cross-site image into WebGL unless that site sends CORS headers, and superspl.at's
// skyboxes don't; served from here, the image is same-origin. Only the url in the tour file is
// ever fetched, so this can't be used to fetch anything else.

const MAX_BYTES = 64 * 1024 * 1024;

// Skyboxes are large (Seven Park's is 20 MB) and don't change: keep each one after the first fetch.
const cache = new Map<string, { body: ArrayBuffer; type: string }>();

type Params = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { name } = await params;
  const tour = await loadTour(name);
  const url = tour?.skybox;
  if (!url) return new Response("Not found", { status: 404 });

  // a local path needs no passing through
  if (!/^https?:\/\//i.test(url)) return Response.redirect(new URL(url, _req.url), 302);

  let entry = cache.get(url);
  if (!entry) {
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    } catch {
      return new Response("Skybox fetch failed", { status: 502 });
    }
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response("Skybox fetch failed", { status: 502 });
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new Response("Skybox too large", { status: 502 });
    entry = { body, type };
    cache.set(url, entry);
  }

  return new Response(entry.body, {
    headers: {
      "Content-Type": entry.type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
