# Splat

Walk through a home as a 3D Gaussian splat and ask an AI assistant about it. Spec: [`spatial-property-ai-platform-blueprint.md`](spatial-property-ai-platform-blueprint.md).

## Layout

```text
apps/web/   Next.js site: pick a house → full-screen 3D walkthrough with a floating chat
llm/        @splat/llm: listing data, spatial resolution, prompts, Claude client (Haiku 5.5)
engine/     supersplat-viewer (git subtree), embedded by apps/web; see engine/README.md
docs/       llm-layer.md: how the chat, context and location work
```

pnpm workspaces + Turborepo. The viewer in `engine/supersplat-viewer` keeps its own npm setup;
`apps/web` links to its built `dist/`.

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
