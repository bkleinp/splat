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

## Tours

Each tour is a file in `tours/<name>.json`; the file name is the route.

| Field | Meaning |
| --- | --- |
| `title`, `credit` | Name and scan attribution |
| `content` | Splat url (`.sog`, `meta.json`, `lod-meta.json`, `.ply`, ...) |
| `collision` | Walk collision (`.voxel.json` or `.glb`); without it walking has no walls |
| `aa` | Anti-aliasing override (optional) |
| `viewer` | Viewer settings: start camera, background, tonemapping, post effects |
| `walk` | Walking feel: `speed`, `responseTime`, `headBob`, `stepLength`, `eyeHeight`, `fov` |

The admin panel previews every change live. **Save** writes the tour file (commit it like code).
**Apply to all tours** copies this tour's `walk` and post effects to every tour file; start camera
and background stay per tour.

Saving goes through a dev-server-only API (`dev-api.ts`). A production build reads the tour files
bundled at build time and has no admin pages; editing in production will need a real backend.

Local sample scans (`/samples/...`) are served from `engine/supersplat-viewer/public/samples/`;
fetch them with `engine/scripts/fetch-sample.sh`.
