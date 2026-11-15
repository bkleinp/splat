import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { ExperienceSettings, WalkSettings } from "@playcanvas/supersplat-viewer/viewer";
import type { Seat } from "./seats";

/**
 * One tour: a splat scan plus how it should look and feel. Stored as
 * apps/web/tours/<name>.json, committed to git so a saved tweak is a
 * reviewable diff, and edited on the dev-only settings page
 * (/<slug>/admin).
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
  /**
   * Skybox: an equirectangular image of the surroundings, the view out of the windows (e.g.
   * superspl.at's `https://superspl.at/s/skybox?id=<scene>`). Images from other sites are passed
   * through /api/tours/<name>/skybox, since browsers won't put a cross-site image without CORS
   * headers into WebGL.
   */
  skybox?: string | null;
  /** Show the skybox (default true); off shows the plain background colour instead. */
  showSkybox?: boolean;
  /** Places to sit (chairs, couches): walk up to one and press F. Edited on the settings page. */
  seats?: Seat[];
  /** Viewer experience settings: start camera, background, tonemapping, post effects. */
  viewer: ExperienceSettings;
  /** Walking feel. */
  walk: Partial<WalkSettings>;
  /** Floor plan view. */
  plan?: {
    /**
     * Outline of the home, corners as [x, z] in world space. The floor plan hides everything
     * outside it and centers on it; walking still shows everything. Without one the floor is
     * found automatically.
     */
    outline?: [number, number][];
    /** World height (y) the floor plan hides everything below (strays and backdrop under the floor). */
    bottom?: number;
    /** Haze cleanup: `haze` hides splats fainter than that opacity, `maxSize` splats larger than that (m). */
    cleanup?: { haze?: number; maxSize?: number | null };
  };
};

export type TourSummary = { name: string; title: string };

// Next runs with the working directory at apps/web (pnpm --filter, turbo); fall back to the repo
// root for a run started there.
const TOURS_DIR = [path.resolve(process.cwd(), "tours"), path.resolve(process.cwd(), "apps/web/tours")];

const NAME = /^[a-z0-9][a-z0-9-]*$/;

async function toursDir(): Promise<string> {
  for (const dir of TOURS_DIR) {
    try {
      if ((await fs.stat(dir)).isDirectory()) return dir;
    } catch {
      // try the next candidate
    }
  }
  throw new Error("Tours folder not found (expected apps/web/tours).");
}

const tourPath = async (name: string) => path.join(await toursDir(), `${name}.json`);

const exists = async (file: string) =>
  fs.stat(file).then(
    () => true,
    () => false,
  );

/** Read tours/<name>.json, or null if there's no such tour. */
export async function loadTour(name: string): Promise<Tour | null> {
  if (!NAME.test(name)) return null;
  const file = await tourPath(name);
  if (!(await exists(file))) return null;
  return JSON.parse(await fs.readFile(file, "utf8")) as Tour;
}

export async function listTours(): Promise<TourSummary[]> {
  const dir = await toursDir();
  const names = (await fs.readdir(dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .filter((n) => NAME.test(n))
    .sort();
  return Promise.all(names.map(async (name) => ({ name, title: (await loadTour(name))?.title ?? name })));
}

const writeTour = async (name: string, tour: object) =>
  fs.writeFile(await tourPath(name), `${JSON.stringify(tour, null, 2)}\n`);

/** Replace a tour file. Only for existing tours; a tour needs at least a content url. */
export async function saveTour(name: string, tour: unknown): Promise<"saved" | "not-found" | "invalid"> {
  if (!NAME.test(name) || !(await exists(await tourPath(name)))) return "not-found";
  if (!tour || typeof tour !== "object" || typeof (tour as Tour).content !== "string") return "invalid";
  await writeTour(name, tour);
  return "saved";
}

/** Copy one tour's walk + look settings onto every tour (start position, background and floor plan stay per tour). */
export async function applyToAllTours(name: string): Promise<string[] | null> {
  const source = await loadTour(name);
  if (!source) return null;
  const updated: string[] = [];
  for (const { name: other } of await listTours()) {
    const tour = (await loadTour(other))!;
    tour.walk = { ...source.walk };
    if (source.viewer?.postEffectSettings) {
      tour.viewer = { ...tour.viewer, postEffectSettings: structuredClone(source.viewer.postEffectSettings) };
    }
    await writeTour(other, tour);
    updated.push(other);
  }
  return updated;
}

/**
 * Tour editing writes files on the machine running the app, so it only exists
 * on the dev server (as the tours app's dev API did). A deployed site would
 * need a real backend for it.
 */
export const toursEditable = () => process.env.NODE_ENV !== "production";
