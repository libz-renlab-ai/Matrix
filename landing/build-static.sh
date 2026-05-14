#!/usr/bin/env bash
# Builds the TeamBrain GitHub Pages frontend from landing/rocketteam (the
# vendored RocketTeam app, with TeamBrain patches already merged in-tree and
# server-only routes already stripped). Generates demo data, runs
# `next build` in STATIC_EXPORT mode, and prints the artefact path.
# CI uploads landing/rocketteam/out as the Pages artifact.
#
# Idempotent: re-runs cleanly.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANDING_DIR="${REPO_ROOT}/landing"
ROCKET_DIR="${LANDING_DIR}/rocketteam"
BASE_PATH="${STATIC_BASE_PATH:-}"

if [[ ! -d "${ROCKET_DIR}/src/app" ]]; then
  echo "[build-static] landing/rocketteam is missing src/app — vendored tree is incomplete" >&2
  exit 1
fi

# Seed private/ if not already populated. Real deployments may mount their
# own private/ via a CI secret; demo seed is overridden iff DEMO_SEED=1.
if [[ ! -d "${ROCKET_DIR}/private/agents" ]] || [[ -z "$(ls -A "${ROCKET_DIR}/private/agents" 2>/dev/null | grep -v '^\.')" ]] || [[ "${DEMO_SEED:-0}" == "1" ]]; then
  echo "[build-static] generating demo data into ${ROCKET_DIR}/private/"
  mkdir -p "${ROCKET_DIR}/private/agents" "${ROCKET_DIR}/private/tasks" "${ROCKET_DIR}/private/resources"
  cp -R "${ROCKET_DIR}/private.example/." "${ROCKET_DIR}/private/"
  ( cd "${ROCKET_DIR}" && bun tools/generate-demo-data.ts )
fi

# Install + dump JSON + build.
cd "${ROCKET_DIR}"
if [[ ! -d node_modules ]]; then
  echo "[build-static] installing rocketteam deps via bun"
  bun install
fi

echo "[build-static] dumping static data → public/data/"
bun tools/inline-static-data.ts

echo "[build-static] next build STATIC_EXPORT=1 STATIC_BASE_PATH='${BASE_PATH}'"
rm -rf .next out
STATIC_EXPORT=1 STATIC_BASE_PATH="${BASE_PATH}" ./node_modules/.bin/next build

echo "[build-static] DONE → ${ROCKET_DIR}/out"
echo "[build-static] artefact size: $(du -sh "${ROCKET_DIR}/out" | cut -f1)"
echo "[build-static] page count: $(find "${ROCKET_DIR}/out" -name 'index.html' | wc -l | tr -d ' ')"
