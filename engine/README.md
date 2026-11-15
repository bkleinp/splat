# engine/

The splat viewer engine for the product.

## supersplat-viewer/

Our fork of [playcanvas/supersplat-viewer](https://github.com/playcanvas/supersplat-viewer) (MIT),
imported as a **git subtree** with its full history. It lives in this repo like any other folder:
edit it, commit it, no submodule steps.

Imported at upstream `964770e` (v1.43.2, 2026-11-13).

### Ground rules

- Keep product UI out of this folder. The product app uses the viewer through
  `createViewer({ ui: false })` (see `supersplat-viewer/docs/api.md`).
- Put our own features in **new files** (e.g. a custom movement controller in `src/cameras/`) and
  keep edits to upstream files small, so upstream merges stay easy.
- Generic API additions (camera pose, glide-to-point, walk settings) are worth sending back
  upstream as PRs; anything they accept is code we no longer carry.

### Running it

```bash
cd engine/supersplat-viewer
npm ci            # install
npm run develop   # dev server at http://localhost:3000
npm test          # build + unit tests
```

Opening http://localhost:3000 on its own shows a **blank page**: the viewer looks for
`./scene.compressed.ply` and `./settings.json`, which don't exist. Fetch the sample apartment scan
(CC-BY-4.0, by Stephane Agullo / sa3d.fr) into the dev server folder:

```bash
engine/scripts/fetch-sample.sh
```

Then open **http://localhost:3000/apartment** or **/seven-park** (stock viewer in our walk-only
mode, no buttons) or **/apartment-hosted** (stock viewer, unchanged, for comparison). Samples land
in `public/`, which is gitignored. The product tours themselves run in the web app (`web/`).

### Our changes to the viewer

| Change | Where |
| --- | --- |
| Human walking pace with eased start/stop, the stock jump at a set height (0 = off), subtle head bob (paused mid-air, off under OS reduced motion), all tunable as `WalkSettings` | `src/cameras/tour-walk-controller.ts` (new), used by `src/camera-manager.ts` |
| `walkOnly` option (`?walkonly`): starts in walk, no intro animation, no switching to fly/orbit, settles onto the floor once collision loads | `src/options.ts`, `src/index.ts`, `src/index.html`, `src/camera-manager.ts` |
| `walk` option, and `getWalkSettings` / `setWalkSettings` / `setPostEffects` on the viewer handle; `DEFAULT_WALK_SETTINGS` export | `src/options.ts`, `src/types.ts`, `src/viewer.ts`, `src/index.ts` |

### Pulling upstream updates

The `upstream-viewer` remote points at PlayCanvas's repo. To add it on a fresh clone:

```bash
git remote add upstream-viewer https://github.com/playcanvas/supersplat-viewer.git
```

To merge their latest `main` (do this on a branch, roughly monthly, then retest on real phones):

```bash
git subtree pull --prefix=engine/supersplat-viewer upstream-viewer main
```

### Sending a change upstream

```bash
git subtree split --prefix=engine/supersplat-viewer -b viewer-upstream
```

Push `viewer-upstream` to a GitHub fork of `playcanvas/supersplat-viewer` and open a PR from there.
