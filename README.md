# Splat

Walk through a home as a 3D Gaussian splat and ask an AI assistant about it. Spec: [`spatial-property-ai-platform-blueprint.md`](spatial-property-ai-platform-blueprint.md).

## Layout

```text
apps/web/   The product (Next.js): home page → full-screen walk-through with the Walk / Floor plan
            switch and the location-aware chat floating over it
llm/        @splat/llm: listing data, spatial resolution, prompts, Claude client (Haiku 5.5)
engine/     supersplat-viewer fork (git subtree): tour walking, floor plan view; see engine/README.md
web/        Tours app (Vite): tour files in web/tours/*.json and their settings pages (walk feel,
            look, floor plan outline). apps/web reads the same tour files; see web/README.md
docs/       llm-layer.md: how the chat, context and location work
```

pnpm workspaces + Turborepo for `apps/web` and `llm`. `engine/supersplat-viewer` and `web/` keep their
own npm setups; `apps/web` links to the viewer's built `dist/`.

**Tours are shared.** A house in `llm/src/houses.ts` names its tour (`scene: { tour: "seven-park" }`);
the walk-through in `apps/web` is built from `web/tours/seven-park.json`, so changes saved on the
tours app's settings page (`cd web && npm run dev`, then `/<tour>/admin`) show up in the product too.

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
To run both, start one on another port, e.g. `pnpm --filter @splat/web dev -p 3001`. The tours app
(`web/`) runs on 5173.
