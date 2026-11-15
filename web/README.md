# web/

The product: home tours built on our viewer fork (`engine/supersplat-viewer`).

```bash
cd web
npm install
npm run dev      # http://localhost:5173 (also rebuilds the engine on change)
```

| Route | What |
| --- | --- |
| `/` | List of tours |
| `/<tour>` | The walk-through: walk only, no stock buttons |
| `/<tour>/admin` | The walk-through with a settings panel (dev server only) |

## Floor plan view

Every tour has a **Walk / Floor plan** switch at the top (`src/plan-controls.ts`). Floor plan flies
the camera up over the floor you're standing on and shows a **Walls** slider that cuts away
everything above that height (default 1.3 m; all the way right shows everything). In the floor
plan you can drag to tilt and turn, and scroll or pinch to zoom. Walk flies back down to where you
were.

**Outline (per tour, on the settings page).** Scans carry parts outside the home that the walk
needs (the view out of the windows) but that look broken from above. Under *Floor plan outline*,
**Draw outline** opens the floor plan showing everything: click to add corners around the home,
drag a corner to move it, double-click (or right-click) it to remove it, scroll to zoom, then
**Done** and **Save**. The floor plan then hides everything outside the outline and centers on it;
walking is unaffected. It's stored as `plan.outline` (corners `[x, z]`) in the tour file and is
per tour ("Apply to all tours" leaves it alone). Without an outline the floor plan finds the floor
from the walk collision and crops to a box around it.

**Trim below floor (same section).** Hides what's under the floor in the floor plan, seen when it's
tilted: slide left until the mess underneath is gone but the floor still shows; the right end is
off. Stored as `plan.bottom` (a world height). The floor plan camera also can't tilt below about
10° above the horizon, so it never goes under the floor.

Edges stay crisp on their own: splats near the outline, the wall cut or the trim are shrunk to fit
inside it rather than spilling over the line, and along those cuts only fairly solid splats stay.

**Remove haze / Remove large blobs (same section).** Floor-plan-only cleanup, stored as
`plan.cleanup` (`haze`: opacity bar 0-1, default 0.1; `maxSize`: thickness in meters, default off).
Haze hides faint see-through splats; large blobs hides splats thicker than the size shown (flat
floor and wall splats are kept however wide they are). Push them only until the fuzz goes: too
far and floors get dark patches, since some scans build floors from many faint layers.

It works best on scans that are level (up is straight up) and have walk collision: the floor
height comes from the collision. The viewer side is `setPlanView`, `setCutHeight`,
`setPlanOutline`, `screenToFloor`, `floorToScreen` and `getPlanInfo` on the viewer handle
(`engine/supersplat-viewer/src/height-cut.ts` does the cut and crop).

## Tours

Each tour is a file in `tours/<name>.json`; the file name is the route.

| Field | Meaning |
| --- | --- |
| `title`, `credit` | Name and scan attribution |
| `content` | Splat url (`.sog`, `meta.json`, `lod-meta.json`, `.ply`, ...) |
| `collision` | Walk collision (`.voxel.json` or `.glb`); without it walking has no walls |
| `aa` | Anti-aliasing override (optional) |
| `viewer` | Viewer settings: start camera, background, tonemapping, post effects |
| `walk` | Walking feel: `speed`, `responseTime`, `headBob`, `stepLength`, `eyeHeight`, `fov`, `jumpHeight` |

The admin panel previews every change live. **Save** writes the tour file (commit it like code).
**Apply to all tours** copies this tour's `walk` and post effects to every tour file; start camera
and background stay per tour.

Saving goes through a dev-server-only API (`dev-api.ts`). A production build reads the tour files
bundled at build time and has no admin pages; editing in production will need a real backend.

Local sample scans (`/samples/...`) are served from `engine/supersplat-viewer/public/samples/`;
fetch them with `engine/scripts/fetch-sample.sh`.
