# landing/

Matrix GitHub Pages frontend, deployed via `.github/workflows/landing-deploy.yml`.

The deployed page is the **RocketTeam** Next.js app running in
`output: 'export'` static-export mode.

## Pieces

| Path | Role |
|------|------|
| `landing/rocketteam/` | The RocketTeam Next.js app, vendored in-tree. Originally from upstream `hrdAI3/RocketTeam`; the Matrix-side static-export patches are already merged into this tree and the server-only routes (`src/app/api`, `src/app/live`, `src/app/sim`) have been stripped. Edit directly. |
| `landing/build-static.sh` | Build script. Seeds demo data via `bun tools/generate-demo-data.ts`, dumps JSON snapshots via `bun tools/inline-static-data.ts`, then runs `STATIC_EXPORT=1 next build`. |
| `.github/workflows/landing-deploy.yml` | Runs `landing/build-static.sh` on push to `main` (paths: `landing/**`), uploads `landing/rocketteam/out` as the Pages artefact. |

## Local build

```sh
# From repo root
STATIC_BASE_PATH=/Matrix DEMO_SEED=1 bash landing/build-static.sh

# Preview the artefact under a basePath-mimicking directory
mkdir -p /tmp/preview/Matrix
cp -R landing/rocketteam/out/. /tmp/preview/Matrix/
(cd /tmp/preview && python3 -m http.server 4567) &
open "http://localhost:4567/Matrix/"
```

## How it works

`build-static.sh` generates demo data into `landing/rocketteam/private/`,
dumps JSON snapshots into `public/data/`, and runs `next build` in
static-export mode. `fetch('/api/X')` calls are rewritten to
`fetch('/data/X.json')` at runtime by `StaticFetchShim`. The result is
`landing/rocketteam/out/` — a self-contained set of static HTML pages that
CI uploads to GitHub Pages.

## GH Pages source-mode caveat

The deploy workflow uses `actions/deploy-pages@v5`, which requires the Pages
source to be set to **GitHub Actions** (repo settings → Pages → Source =
"GitHub Actions"). Set this once before the first deploy.

## Demo data

`landing/rocketteam/tools/generate-demo-data.ts` seeds 8 agents across 5
departments, 6 tasks, 4 resources, and 10 timeline events. `DEMO_SEED=1`
refreshes the seed each deploy; unset it in production builds where a real
`private/` is supplied by another mechanism.
