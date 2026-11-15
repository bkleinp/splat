# Splat

Walk through a home as a 3D Gaussian splat and ask an AI assistant about it. Spec: [`spatial-property-ai-platform-blueprint.md`](spatial-property-ai-platform-blueprint.md).

## Layout

```text
apps/web/   The product (Next.js): home page → full-screen walk-through with the Walk / Floor plan
            switch and the location-aware chat floating over it. Tour files live in
            apps/web/tours/*.json, edited on dev-only settings pages (/tours)
llm/        @splat/llm: listing data, spatial resolution, prompts, Claude client (Haiku 5.5)
engine/     supersplat-viewer fork (git subtree): tour walking, floor plan view; see engine/README.md
docs/       llm-layer.md: how the chat, context and location work
```

pnpm workspaces + Turborepo for `apps/web` and `llm`. `engine/supersplat-viewer` keeps its own npm
setup; `apps/web` links to the viewer's built `dist/`.

**Tours.** A house in `llm/src/houses.ts` names its tour (`scene: { tour: "seven-park" }`); the
walk-through is built from `apps/web/tours/seven-park.json` (content, collision, look, walk feel,
floor plan). On the dev server, http://localhost:3000/tours lists the tours and links each one's
settings page (`/<slug>/admin`, e.g. `/singlefloor/admin`; the home itself is at `/singlefloor`), which previews changes live and saves them to the JSON file
(commit it to keep them). The settings pages and their API are dev-only: a production build 404s them.
The `apartment` tour reads its scan from `engine/supersplat-viewer/public/samples`
(`engine/scripts/fetch-sample.sh`).

**Seats.** Visitors who walk up to a seat see **F · Sit** (a button on touch screens); F glides
them into it, they can look around, and F (or walking, or clicking somewhere) stands them back up
where they were. Seats are per tour (`seats` in the tour file) and edited in the settings page's
**Seats** section: stand in front of a chair or couch, face it, **Add seat in front of me**, then
rename it, nudge it (arrows move 10 cm, ⟲ ⟳ turn 15°, ▲ ▼ raise or lower the eye 5 cm), try it with
**Sit**, or **Move here** / **Delete**. Seats also show as markers in the settings page's view;
click one to try it. Save writes them to the tour file.

**Outside view.** A tour can have a `skybox` (an image of the surroundings, seen through the
windows); the settings page's **Outside view** checkbox switches it off for the plain background
(`showSkybox: false`). Images from other sites go through `/api/tours/<name>/skybox`.

## Setup (Windows)

```powershell
npm install -g pnpm@9.15.9          # once, if you don't have pnpm
pnpm viewer:build                    # npm ci + build engine/supersplat-viewer (needed before the web app runs)
pnpm install

copy .env.example apps\web\.env.local   # then add your ANTHROPIC_API_KEY

py -3.13 -m venv .venv                   # Python venv for helper scripts
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Re-run `pnpm viewer:build` after pulling changes to `engine/`.

## Run

```powershell
pnpm dev         # http://localhost:3000
pnpm build
pnpm typecheck
```

The viewer's own dev server (`npm run develop` in `engine/supersplat-viewer`) also uses port 3000.
To run both, start one on another port, e.g. `pnpm --filter @splat/web dev -p 3001`.
