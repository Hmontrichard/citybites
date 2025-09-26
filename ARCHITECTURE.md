# CityBites Architecture

## Overview

CityBites is an MCP-based system (Model Context Protocol) deployed as three services:

```mermaid
graph TB
    User[👤 User] --> FE[🌐 Frontend (Next.js)]
    FE --> |HTTP POST /api/generate| FE_API[📡 API Route /api/generate]
    FE_API --> |HTTP POST /generate| AGENT[🤖 Agent (Express)]
    AGENT --> |STDIO MCP| MCP[⚙️ MCP Server (embedded)]

    MCP --> |HTTP| OVERPASS[🗺️ Overpass API]
    MCP --> |HTTP| NOMINATIM[📍 Nominatim]
    MCP --> |HTTP| OPENAI[🧠 OpenAI API]
    MCP --> |Playwright| CHROMIUM[🎨 Chromium (PDF)]
```

## Services & URLs

| Service    | URL (Production)                | Port | Responsibility |
|------------|----------------------------------|------|----------------|
| Frontend   | `https://<your-frontend>.vercel.app` | 3000 | UI + API proxy |
| Agent      | `https://citybites.fly.dev`      | 4000 | Orchestration, validation, security |
| MCP Server | (embedded with Agent)            | —    | Domain tools (search, optimize, export, PDF) |

## Data flow

1) Frontend collects user input and calls `/api/generate` (Next.js API route).
2) API route forwards the request to the Agent (`POST /generate`).
3) Agent orchestrates the MCP server over STDIO and calls tools.
4) MCP server integrates with external services (Overpass, Nominatim, OpenAI, Playwright) and returns structured results.

## App structure

### Frontend (apps/frontend)
```
src/
├── app/
│   ├── page.tsx              # Main page (UI)
│   └── api/
│       └── generate/
│           └── route.ts      # Proxy to Agent
└── components/               # Reusable components
```

### Agent (apps/agent)
```
src/
├── server.ts                 # Express + security
├── generator.ts              # MCP orchestration
└── schemas.ts                # Zod validation
```

### MCP Server (apps/mcp-citybites)
```
src/
├── mcp-server.ts             # MCP server (STDIO)
└── tools/…                   # Domain tools
```

## Environment variables

### Frontend
```bash
AGENT_SERVICE_URL=https://citybites.fly.dev
```

### Agent
```bash
PORT=4000
NODE_ENV=production
ALLOWED_ORIGINS=https://<your-frontend>.vercel.app
MCP_PREFIX=/app/apps/mcp-citybites  # in Fly.io container
```

### MCP Server
```bash
OPENAI_API_KEY=sk-...
OVERPASS_ENDPOINTS=https://overpass-api.de/api/interpreter
DISABLE_PDF=false
```

## Endpoints

### Frontend (Vercel)
- `GET /` — main page
- `POST /api/generate` — proxy to Agent

### Agent (Fly.io)
- `GET /health` — status
- `POST /generate` — guide generation

## Security

### Frontend
- Next.js security headers (CSP tightened)
- API proxy restricted to Agent URL

### Agent
- Helmet (security headers)
- Rate limiting (60 req/15min)
- Strict CORS (prod)
- Body size limit (200KB)
- Input validation (Zod)

### MCP Server
- STDIO only (no public HTTP)
- Timeouts on external APIs

## Error flow
```
[MCP error] → [Agent catches] → [HTTP 502] → [Frontend catches] → [User message]
[Agent timeout] → [Frontend AbortController] → [HTTP 504] → [Timeout message]
[Validation] → [HTTP 400] → [Validation details]
```

## Troubleshooting

1) Frontend not loading
- Check your Vercel domain
- Inspect Vercel build/runtime logs

2) API not responding
- Check `https://citybites.fly.dev/health`
- `flyctl logs -a citybites`

3) MCP issues
- Agent cannot talk to MCP
- Use Agent logs: `flyctl logs -a citybites`

## Verification tests
```bash
# 1) Frontend reachable
curl -I https://<your-frontend>.vercel.app

# 2) Agent healthy
curl https://citybites.fly.dev/health

# 3) End-to-end generation
curl -X POST https://<your-frontend>.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"city":"Paris","theme":"restaurant","day":"2025-09-25"}'
```

## Deployment

### GitHub Actions
1. Tests → TypeScript + Lint for all apps
2. Deploy Fly.io → Agent (with embedded MCP)
3. Deploy Vercel → Frontend (with env vars)

—

This repo uses strict failure semantics (no fallbacks). If a dependency fails (Overpass, OpenAI, PDF), the request fails with a clear error. Ensure PDF prerequisites are met (Chromium via Playwright) or keep `DISABLE_PDF=true`.
