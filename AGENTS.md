# Repository Guidelines

## Project Structure & Module Organization
- `apps/frontend/` — Next.js client; key entry is `src/app/page.tsx`. Assets live under `public/`. ESLint config uses `eslint.config.mjs` with a generated `.eslintrc.json` shim.
- `apps/mcp-citybites/` — Express mock service served from `src/server.ts`. TypeScript build outputs to `dist/` when compiled.
- `apps/api/` — Placeholder for future API routes; current demo lives in `generate/route.ts`.
- `scripts/` — Utility scripts; `run-tests.sh` orchestrates package-level test commands.

## Build, Test, and Development Commands
- `npm --prefix apps/frontend run dev` — Start the Next.js dev server on port 3000.
- `npm --prefix apps/mcp-citybites run dev` — Launch the mock MCP Express server on port 3001.
- `./scripts/run-tests.sh` — Run each app’s `npm test`, falling back to `lint` or `build` when tests are absent.
- `npm --prefix apps/frontend run build` / `npm --prefix apps/mcp-citybites run build` — Produce production bundles for deployment.

## Coding Style & Naming Conventions
- TypeScript and JSX throughout; prefer functional React components.
- Follow Prettier-style 2-space indentation and keep imports sorted logically.
- Respect existing directory naming (kebab-case for folders, camelCase for files under `src/` unless React component). ESLint (`next/core-web-vitals`) enforces most rules; run `npm run lint` before commits.

## Testing Guidelines
- Frontend linting acts as the baseline guard (`next lint`). Add Vitest/Playwright suites under `apps/frontend/__tests__/` as they emerge; name files `*.test.ts(x)`.
- The mock service relies on TypeScript checks; add runtime tests with your preferred harness under `apps/mcp-citybites/tests/`, mirroring source structure.
- Always run `./scripts/run-tests.sh` before pushing to ensure repo-wide sanity.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`) as seen in history (`refactor: reorganize frontend and clean repo`). Keep subject lines under ~72 chars.
- Each PR should: describe the change in 1–2 paragraphs, list manual/automated checks (include `./scripts/run-tests.sh` output), and attach screenshots for visible UI updates.
- Link relevant issues or TODO items in the description; request review from a teammate familiar with the affected app.

## Configuration & Security Notes
- Keep `.env.local` only in local setups; never commit secrets. Sample variables should go in `README.md` or a new `.env.example`.
- Next.js telemetry is enabled by default; opt out locally via `npx next telemetry disable` if required, but leave project defaults unchanged.
