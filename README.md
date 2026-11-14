# Splat

Walk through a home as a 3D Gaussian splat and ask an AI assistant about it. Spec: [`spatial-property-ai-platform-blueprint.md`](spatial-property-ai-platform-blueprint.md).

## Layout

```text
apps/web/   Next.js site (home page → pick a house → see its context)
llm/        @splat/llm — listing types, seed realtor docs, Claude client (Haiku 5.5)
engine/     3D viewer / splat side (in progress)
```

pnpm workspaces + Turborepo.

## Setup (Windows)

```powershell
npm install -g pnpm@9.15.9          # once, if you don't have pnpm
pnpm install

copy .env.example apps\web\.env.local   # then add your ANTHROPIC_API_KEY

py -3.13 -m venv .venv                   # Python venv for helper scripts
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Run

```powershell
pnpm dev         # http://localhost:3000
pnpm build
pnpm typecheck
```
