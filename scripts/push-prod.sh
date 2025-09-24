#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)
cd "$ROOT_DIR"

if ! git diff --quiet --ignore-submodules HEAD; then
  echo "⚠️  Des modifications locales non commit trouvées. Commit ou stash avant de déployer." >&2
  exit 1
fi

if ! command -v fly >/dev/null 2>&1; then
  echo "❌  La CLI Fly.io n'est pas installée (fly)." >&2
  exit 1
fi

echo "⬢ Lancement des tests repo…"
./scripts/run-tests.sh

echo "⬢ Push git → origin/main"
git push origin main

echo "⬢ Déploiement Fly (agent)"
fly deploy --config apps/agent/fly.toml --dockerfile apps/agent/Dockerfile "$@"

echo "⬢ Déploiement Fly (MCP)"
fly deploy --config apps/mcp-citybites/fly.toml "$@"

echo "✅ Déploiement terminé. Pense à redeployer Vercel si nécessaire (AGENT_SERVICE_URL mis à jour)."
