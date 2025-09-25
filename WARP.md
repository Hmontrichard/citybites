# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

CityBites is a French food guide generator that creates mini gourmet guides from a city, theme, and date. The system uses a Model Context Protocol (MCP) architecture with three main applications:

- **MCP Server** (`apps/mcp-citybites`) - Exposes tools for place search, route optimization, map exports, and PDF generation
- **Agent** (`apps/agent`) - Express server that orchestrates the MCP server via STDIO and assembles results
- **Frontend** (`apps/frontend`) - Next.js interface that provides the user form and consumes the agent API

## Architecture

```
apps/
├── mcp-citybites/     # MCP server with tools for places, routes, maps, PDF
├── agent/             # Express orchestrator that manages MCP communication
└── frontend/          # Next.js UI with proxy API route
```

### Service Communication
- Frontend → Agent (HTTP on port 4000)
- Agent → MCP Server (STDIO protocol)
- MCP Server integrates with Overpass API, Nominatim, OpenAI, and Playwright (for PDF generation)

## Production Commands

### Installation & Setup
```bash
# Install all dependencies
npm --prefix apps/mcp-citybites install
npm --prefix apps/agent install
npm --prefix apps/frontend install
```

### Build Commands
```bash
# Build all applications
npm --prefix apps/mcp-citybites run build
npm --prefix apps/agent run build
npm --prefix apps/frontend run build
```

### Production Start
```bash
# Start agent (includes MCP server)
npm --prefix apps/agent run start

# Start frontend
npm --prefix apps/frontend run start
```

## Environment Variables

### Frontend
- `AGENT_SERVICE_URL` - URL to the agent service (production: `https://citybites.fly.dev`)

### Agent (`apps/agent/`)
- `PORT` - Agent server port (default: 4000)
- `MCP_PREFIX` - Path to MCP server directory (auto-detected if not set)
- `MCP_COMMAND` - Custom command to launch MCP server
- `MCP_ARGS` - Custom arguments for MCP server
- `MCP_ENTRY` - Custom entry point for MCP server
- `MCP_CWD` - Custom working directory for MCP server

### MCP Server (`apps/mcp-citybites/`)
- `OVERPASS_ENDPOINTS` - Comma-separated Overpass API endpoints
- `OVERPASS_USER_AGENT` - User agent for Overpass requests
- `DISABLE_PDF` - Set to `true` to return HTML instead of PDF (useful for environments without Chromium)
- `OPENAI_API_KEY` - OpenAI API key for place enrichment
- `OPENAI_MODEL` - OpenAI model to use (default: `gpt-4o-mini`)
- `PLACE_ENRICH_CACHE_TTL_MS` - Cache TTL for place enrichments (default: 6 hours)

## Key Files & Directories

- `apps/mcp-citybites/src/tools.ts` - Core tools (Overpass, exports, PDF generation)
- `apps/mcp-citybites/src/mcp-server.ts` - MCP protocol implementation
- `apps/agent/src/generator.ts` - Main orchestration logic
- `apps/frontend/src/app/api/generate/route.ts` - API proxy to agent

## Development Workflow

### Code Style
- TypeScript throughout with strict configuration
- ESLint with Next.js rules for frontend
- Prettier-style 2-space indentation
- Functional React components preferred

### Build Strategy
- Frontend: Next.js build validation
- Services: TypeScript compilation validation
- Deployment: GitHub Actions automated pipeline

### Commit Conventions
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`
- Keep subject lines under 72 characters
- Include relevant context in body for non-trivial changes

### Deployment Process
- GitHub Actions handles build validation and deployment
- Automatic deployment to production on main branch
- Frontend deployed to Vercel, backend to Fly.io

## Production Guidelines

- **Module Organization**: Three-app separation (frontend UI, agent orchestration, MCP tools)
- **Build Commands**: Use the npm --prefix pattern for app-specific commands
- **Code Style**: TypeScript with strict configuration throughout
- **Environment Setup**: MCP server requires Playwright for PDF generation

### Common Tasks
- **New MCP Tool**: Add to `apps/mcp-citybites/src/tools.ts` and expose via `mcp-server.ts`
- **Agent Logic**: Modify `apps/agent/src/generator.ts` for orchestration changes
- **Frontend Changes**: Update `apps/frontend/src/app/page.tsx` for UI changes

## Deployment Notes

- **Agent & MCP**: Deployable to Fly.io with Dockerfile in `apps/agent/`
- **Frontend**: Deployable to Vercel, requires `AGENT_SERVICE_URL` configuration
- **CI/CD**: Uses `.github/workflows/` for testing and deployment automation

The agent Dockerfile embeds both the agent and MCP server in a single image for production deployment.

## Troubleshooting

### Common Issues
- **MCP Server not starting**: Ensure `apps/mcp-citybites` is built
- **PDF generation failing**: Check Playwright installation or set `DISABLE_PDF=true`
- **OpenAI integration**: Requires valid `OPENAI_API_KEY` for place enrichment

### Production Health Checks
```bash
# Check agent health
curl https://citybites.fly.dev/health

# Check frontend
curl https://citybites.vercel.app
```

## References

- [README.md](README.md) - Detailed setup and deployment instructions
- [ARCHITECTURE.md](ARCHITECTURE.md) - Complete system architecture documentation
- `.github/workflows/` - CI/CD pipeline configuration
