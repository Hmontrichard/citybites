# CityBites

CityBites generates a mini food guide from a city, theme, and date. The system is structured as a Model Context Protocol (MCP) architecture:

- **MCP Server** (`apps/mcp-citybites`): tools for `places.search`, `routes.optimize`, `maps.export`, `pdf.build`
- **Agent** (`apps/agent`): Express server that orchestrates the MCP server over STDIO and assembles results
- **Frontend** (`apps/frontend`): Next.js app with a form and an API route proxy to the Agent

## Quick start (local)

1) Install dependencies
```bash
npm --prefix apps/mcp-citybites install
npm --prefix apps/agent install
npm --prefix apps/frontend install
```

2) Build MCP server (recommended)
```bash
npm --prefix apps/mcp-citybites run build
```

3) Start the Agent (spawns MCP via STDIO)
```bash
npm --prefix apps/agent run dev
```
The Agent listens on `http://localhost:4000` and runs `apps/mcp-citybites/dist/mcp-server.js` if present, otherwise `tsx src/mcp-server.ts`.

4) Start the Frontend
- Create `apps/frontend/.env.local` with `AGENT_SERVICE_URL=http://localhost:4000`
- Start Next.js:
```bash
npm --prefix apps/frontend run dev
```
- Open `http://localhost:3000`

## Project structure

- `apps/frontend/`: UI + `app/api/generate/route.ts` (proxy to Agent)
- `apps/agent/`: Express server (`src/server.ts`) + MCP orchestration (`src/generator.ts`)
- `apps/mcp-citybites/`:
  - `src/tools/…` domain tools (Overpass, exports, PDF, enrich)
  - `src/mcp-server.ts` MCP server over STDIO

## Environment variables

| Variable | Scope | Description |
| --- | --- | --- |
| `AGENT_SERVICE_URL` | Frontend | Public Agent URL (default `http://localhost:4000`). |
| `MCP_PREFIX` | Agent | Path to `apps/mcp-citybites` (auto-detected if omitted). |
| `MCP_COMMAND`, `MCP_ARGS`, `MCP_ENTRY`, `MCP_CWD` | Agent | Override how the Agent spawns the MCP server. |
| `OVERPASS_ENDPOINTS`, `OVERPASS_USER_AGENT` | MCP | Overpass configuration. |
| `DISABLE_PDF` | MCP | If `true`, PDF generation is disabled (errors strictly). |
| `OPENAI_API_KEY` | MCP | API key used by `places.enrich`. Required in strict mode. |
| `OPENAI_MODEL` | MCP | OpenAI model (default `gpt-4o-mini`). |
| `PLACE_ENRICH_CACHE_TTL_MS` | MCP | Enrichment cache TTL (default 6h). |

## Build & quality

- `npm --prefix apps/mcp-citybites run build` validates MCP/tools TypeScript
- `npm --prefix apps/agent run build` validates the Agent
- `npm --prefix apps/frontend run build` validates the Frontend

## Deployment overview

- **Agent** (Fly.io): `apps/agent/Dockerfile` builds an image that embeds both Agent and MCP server
- **Frontend** (Vercel): requires `AGENT_SERVICE_URL` set in project env

### Fly.io (Agent)
```bash
fly launch --no-deploy --name citybites-agent --copy-config --dockerfile apps/agent/Dockerfile
# edit fly.toml if needed (port 4000)
fly deploy --dockerfile apps/agent/Dockerfile
# optionally set secrets if paths differ
# fly secrets set MCP_PREFIX=/app/apps/mcp-citybites
```

### Vercel (Frontend)
- Set `AGENT_SERVICE_URL=https://<your-agent>.fly.dev` in Vercel Project Environment (Production)
- Deploy with the CLI or via CI

## Health checks
```bash
# Agent
curl https://citybites.fly.dev/health

# Frontend
curl https://<your-frontend>.vercel.app
```

## Notes
- This repository runs in strict failure mode (no mock fallbacks). If a dependency fails (Overpass, OpenAI, PDF), the request fails with a clear error.
- For PDF generation, ensure Playwright/Chromium is present (or keep `DISABLE_PDF=true`).
