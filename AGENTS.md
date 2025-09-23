# Repository Guidelines

## Project Structure & Module Organization
- `apps/frontend/` — Next.js client (`src/app/page.tsx` + `app/api/generate/route.ts` qui proxy vers l’agent). Assets sous `public/`. ESLint guidé par `eslint.config.mjs`.
- `apps/agent/` — Service Express (`src/server.ts`) qui orchestre le serveur MCP via STDIO (`src/mcpClient.ts`, `src/generator.ts`). TypeScript build → `dist/`.
- `apps/agent/Dockerfile` — image Fly prête à l’emploi (embarque l’agent + le serveur MCP).
- `apps/mcp-citybites/` —
  - `src/server.ts` : endpoints REST historiques (`/places/search`, etc.).
  - `src/mcp-server.ts` : serveur MCP basé sur `@modelcontextprotocol/sdk`.
  - `src/tools.ts` : logique partagée (Overpass, exports, PDF).
- `scripts/` — utilitaires dont `run-tests.sh` (enchaîne `npm test`/`lint`/`build` pour chaque app).
- `apps/api/` — placeholder pour de futurs endpoints (non utilisé actuellement).

## Build, Test, and Development Commands
- `npm --prefix apps/frontend run dev` — Start the Next.js dev server on port 3000.
- `npm --prefix apps/agent run dev` — Lance l’agent (port 4000) et démarre le serveur MCP via STDIO.
- `npm --prefix apps/mcp-citybites run dev` — Lance le serveur REST historique (port 3001) si besoin pour debug.
- `./scripts/run-tests.sh` — Run each app’s `npm test`, falling back to `lint` or `build` when tests are absent.
- `npm --prefix apps/frontend run build` / `npm --prefix apps/mcp-citybites run build` / `npm --prefix apps/agent run build` — Production bundles pour chaque app.

## Coding Style & Naming Conventions
- TypeScript and JSX throughout; prefer functional React components.
- Follow Prettier-style 2-space indentation and keep imports sorted logically.
- Respect existing directory naming (kebab-case for folders, camelCase for files under `src/` unless React component). ESLint (`next/core-web-vitals`) enforces most rules; run `npm run lint` before commits.

## Testing Guidelines
- Frontend linting acts as the baseline guard (`next lint`). Add Vitest/Playwright suites under `apps/frontend/__tests__/` as they emerge; name files `*.test.ts(x)`.
- Services (`apps/mcp-citybites`, `apps/agent`) reposent sur TypeScript + tests unitaires à ajouter sous `tests/` si nécessaire.
- Always run `./scripts/run-tests.sh` before pushing to ensure repo-wide sanity.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`) as seen in history (`refactor: reorganize frontend and clean repo`). Keep subject lines under ~72 chars.
- Each PR should: describe the change in 1–2 paragraphs, list manual/automated checks (include `./scripts/run-tests.sh` output), and attach screenshots for visible UI updates.
- Link relevant issues or TODO items in the description; request review from a teammate familiar with the affected app.

## Configuration & Security Notes
- Keep `.env.local` only in local setups; never commit secrets. Sample variables should go in `README.md` or a new `.env.example`.
- Next.js telemetry is enabled by default; opt out locally via `npx next telemetry disable` if required, but leave project defaults unchanged.
