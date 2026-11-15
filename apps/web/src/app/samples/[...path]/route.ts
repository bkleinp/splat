import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { toursEditable } from "@/lib/tours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dev-only: serves sample scans (/samples/...) from the engine's dev folder, where
// engine/scripts/fetch-sample.sh downloads them, so each scan exists on disk once. Tours like
// tours/apartment.json point here. (Ported from the tours app's dev API.)

const SAMPLES_DIRS = [
  path.resolve(process.cwd(), "../../engine/supersplat-viewer/public/samples"),
  path.resolve(process.cwd(), "engine/supersplat-viewer/public/samples"),
];

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".sog": "application/octet-stream",
  ".ply": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".webp": "image/webp",
  ".txt": "text/plain",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!toursEditable()) return new Response("Not found", { status: 404 });
  const { path: parts } = await params;
  for (const dir of SAMPLES_DIRS) {
    const file = path.resolve(dir, ...parts);
    // never serve anything outside the samples folder
    if (!file.startsWith(dir + path.sep)) return new Response("Not found", { status: 404 });
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
      return new Response(stream, {
        headers: { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" },
      });
    }
  }
  return new Response("Not found", { status: 404 });
}
