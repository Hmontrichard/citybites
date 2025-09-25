# Repository Guidelines

**Status**: Production-ready (pilot) ✅ | Score: 6.8/10 → Target: 8.4/10  
**Last Updated**: September 2025 | **Next Review**: October 2025

## Project Structure & Module Organization
- `apps/frontend/` — Next.js 14.2.33 client with security improvements:
  - `src/app/page.tsx` + `app/api/generate/route.ts` (proxy to agent with 30s timeout)
  - Security: Generic error messages, AbortController timeouts
  - Leaflet integration: `LeafletMapView.tsx`, `BottomBar.tsx` components
  - ESLint clean, all JSX entities properly escaped
- `apps/agent/` — Secured Express server with production middleware:
  - `src/server.ts`: Helmet + rate limiting (60 req/15min) + CORS + body limits
  - `src/generator.ts`: MCP orchestration with timeouts (5-30s) + retry logic
  - `src/mcpClient.ts`: STDIO MCP client with lifecycle management
  - TypeScript strict compilation → `dist/`
- `apps/agent/Dockerfile` — Fly.io production image (agent + MCP server embedded)
- `apps/mcp-citybites/` — MCP tools server with external API integration:
  - `src/mcp-server.ts`: MCP protocol implementation with Zod schemas
  - `src/tools.ts`: Overpass, Nominatim, OpenAI, PDF generation with caching
  - Cache: TTL-based with plans for LRU eviction (memory safety)
  - Fallback strategies for all external dependencies
- `scripts/` — Quality assurance utilities:
  - `run-tests.sh`: Cross-app linting, build, and type checking
  - `run-tests.ps1`: Windows PowerShell equivalent
- **Documentation**: 
  - `FINAL-CODE-REVIEW-REPORT.md`: Executive summary + 4-sprint roadmap
  - `review-mcp-server.md`: Detailed MCP analysis (6.7/10 → 8.5/10)
  - `rapport-communications.md`: Frontend ↔ Agent ↔ MCP flow analysis

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

## Environnements & Secrets

### Frontend (Vercel)
- `AGENT_SERVICE_URL` — URL publique de l'agent Fly.io (ex: `https://citybites-agent.fly.dev`)
- `NODE_ENV` — Automatiquement géré par Vercel

### Agent (Fly.io)
- `PORT` — Port d'écoute (défaut: 4000)
- `NODE_ENV` — `production` pour optimisations
- `ALLOWED_ORIGINS` — Domaines autorisés CORS (ex: `https://citybites.vercel.app`)
- `MCP_PREFIX` — Chemin vers MCP server (auto-détecté si non défini)

### MCP Server
- `OPENAI_API_KEY` / `OPENAI_MODEL` — Enrichissement IA (défaut: gpt-4o-mini)
- `PLACE_ENRICH_CACHE_TTL_MS` — TTL cache enrichissement (défaut: 6h)
- `OVERPASS_ENDPOINTS` — URLs Overpass API séparées par virgules
- `OVERPASS_USER_AGENT` — User-Agent pour requêtes OSM
- `DISABLE_PDF` — `true` pour fallback HTML (environnements sans Chromium)

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`) as seen in history (`refactor: reorganize frontend and clean repo`). Keep subject lines under ~72 chars.
- Each PR should: describe the change in 1–2 paragraphs, list manual/automated checks (include `./scripts/run-tests.sh` output), and attach screenshots for visible UI updates.
- Link relevant issues or TODO items in the description; request review from a teammate familiar with the affected app.

## Security & Production Hardening

### Applied Security Measures ✅
- **Next.js 14.2.33**: Critical CVE patches applied
- **Helmet middleware**: Security headers (CSP, X-Frame-Options, etc.)
- **Rate limiting**: 60 requests/15min per IP on agent
- **CORS restrictions**: Configurable origins (whitelist in production)
- **Input validation**: Zod schemas on all endpoints
- **Error message sanitization**: No internal details exposed to frontend
- **Timeout protection**: 30s frontend, 5-30s MCP tools
- **Body size limits**: 200kb JSON payload max

### Pending Security Improvements 🔄
- **Content-Security-Policy**: Restrictive CSP headers for frontend
- **Request correlation**: UUID propagation for audit trails
- **Structured logging**: Pino with secret redaction
- **LRU cache bounds**: Prevent memory exhaustion
- **Circuit breakers**: External API failure isolation

## Deployment Guide

### Development Environment
```bash
# Install dependencies
npm --prefix apps/mcp-citybites install
npm --prefix apps/agent install
npm --prefix apps/frontend install

# Setup environment
echo "AGENT_SERVICE_URL=http://localhost:4000" > apps/frontend/.env.local

# Start services (2 terminals)
npm --prefix apps/agent run dev      # Port 4000
npm --prefix apps/frontend run dev   # Port 3000
```

### Production Deployment
1. **Agent (Fly.io)**:
   ```bash
   fly deploy apps/agent/
   fly secrets set ALLOWED_ORIGINS="https://your-frontend.vercel.app"
   fly secrets set OPENAI_API_KEY="sk-..."
   ```

2. **Frontend (Vercel)**:
   - Connect GitHub repository
   - Set `AGENT_SERVICE_URL` to your Fly.io agent URL
   - Deploy automatically on push to main

### Health Checks
- Agent: `GET /health` → `{"status": "ok"}`
- Frontend: Build success + Lighthouse score
- MCP: Compilation success (`npm run test`)

## Development Roadmap

### 🔴 Sprint 1 (Week 1) - Stability
- [ ] LRU cache implementation (prevent memory leaks)
- [ ] Response size limits (5MB Overpass, 300 tokens OpenAI)
- [ ] Bounding box validation (prevent API overload)

### 🟡 Sprint 2-3 (Weeks 2-3) - Observability  
- [ ] Request correlation (UUID end-to-end)
- [ ] Structured logging with Pino
- [ ] Circuit breaker pattern
- [ ] Retry with exponential backoff

### 🟢 Sprint 4 (Month 1) - Monitoring
- [ ] Prometheus metrics endpoint
- [ ] Grafana dashboard
- [ ] Integration tests with mocked APIs
- [ ] OpenAPI documentation generation

## Configuration & Security Notes
- **Secrets management**: Use Fly.io secrets and Vercel env vars, never commit to code
- **CORS configuration**: Whitelist specific domains in production (avoid `*`)
- **Rate limiting**: Adjust based on usage patterns (current: 60/15min)
- **Cache TTL**: Balance freshness vs API costs (current: 6h enrichment, 24h geocoding)
- **PDF generation**: Requires Playwright in production or set `DISABLE_PDF=true`
