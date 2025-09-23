#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mapfile -d '' PACKAGE_JSONS < <(find "$ROOT/apps" -mindepth 1 -maxdepth 2 -name package.json -not -path "*/node_modules/*" -print0 | sort -z)

if [ "${#PACKAGE_JSONS[@]}" -eq 0 ]; then
  echo "No npm packages found under apps/." >&2
  exit 1
fi

has_script() {
  local package_dir="$1"
  local script_name="$2"
  node -e '
const fs = require("fs");
const path = require("path");
const pkgDir = process.argv[1];
const script = process.argv[2];
const pkgPath = path.join(pkgDir, "package.json");
if (!fs.existsSync(pkgPath)) process.exit(1);
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
process.exit(pkg.scripts && pkg.scripts[script] ? 0 : 1);
' "$package_dir" "$script_name" >/dev/null 2>&1
}

run_script() {
  local package_dir="$1"
  local relative_dir="${package_dir#$ROOT/}"
  echo "\n▶ $relative_dir"

  if has_script "$package_dir" test; then
    npm --prefix "$package_dir" run test
    return
  fi

  for fallback in lint build; do
    if has_script "$package_dir" "$fallback"; then
      echo "(no test script, running '$fallback' instead)"
      npm --prefix "$package_dir" run "$fallback"
      return
    fi
  done

  echo "Skipping $relative_dir — no test/lint/build scripts found." >&2
}

for pkg_json in "${PACKAGE_JSONS[@]}"; do
  run_script "$(dirname "$pkg_json")"
done

printf '\nAll done.\n'
