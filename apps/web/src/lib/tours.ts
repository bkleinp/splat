import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { ExperienceSettings, WalkSettings } from "@playcanvas/supersplat-viewer/viewer";

/**
 * One tour, as stored in web/tours/<name>.json and edited on the tours app's
 * settings page (web/). Same shape as web/src/tours.ts: keep them in step.
 */
export type Tour = {
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
  /** Floor plan view: outline of the home, trim below the floor, haze cleanup. */
  plan?: {
    outline?: [number, number][];
    bottom?: number;
    cleanup?: { haze?: number; maxSize?: number | null };
  };
};

// Next runs with the working directory at apps/web (pnpm --filter, turbo); fall back to the repo
// root for a run started there.
const TOUR_DIRS = [path.resolve(process.cwd(), "../../web/tours"), path.resolve(process.cwd(), "web/tours")];

const SAFE_NAME = /^[a-z0-9-]+$/;

/** Read web/tours/<name>.json, or null if there's no such tour. */
export async function loadTour(name: string): Promise<Tour | null> {
  if (!SAFE_NAME.test(name)) return null;
  for (const dir of TOUR_DIRS) {
    try {
      return JSON.parse(await fs.readFile(path.join(dir, `${name}.json`), "utf8")) as Tour;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return null;
}
