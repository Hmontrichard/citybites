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
├── frontend/          # Next.js UI with proxy API route
└── api/               # Future endpoints (currently unused)
scripts/
└── run-tests.sh       # Cross-app test runner
```

### Service Communication
- Frontend → Agent (HTTP on port 4000)
- Agent → MCP Server (STDIO protocol)
- MCP Server integrates with Overpass API, Nominatim, OpenAI, and Playwright (for PDF generation)

## Development Commands

### Installation & Setup
```bash
# Install all dependencies
npm --prefix apps/mcp-citybites install
npm --prefix apps/agent install
npm --prefix apps/frontend install
```

### Build Commands
```bash
# Build MCP server (recommended before running agent)
npm --prefix apps/mcp-citybites run build

# Build agent
npm --prefix apps/agent run build

# Build frontend
npm --prefix apps/frontend run build
```

### Development Servers
```bash
# Start agent (auto-starts MCP server via STDIO) - port 4000
npm --prefix apps/agent run dev

# Start frontend - port 3000
npm --prefix apps/frontend run dev

# Start MCP server directly (debug only) - port 3001
npm --prefix apps/mcp-citybites run dev
```

### Testing & Quality
```bash
# Run all app tests/linting (Linux/macOS)
./scripts/run-tests.sh

# Run all app tests/linting (Windows PowerShell)
.\scripts\run-tests.ps1

# Individual app commands
npm --prefix apps/frontend run lint
npm --prefix apps/mcp-citybites run test  # TypeScript compilation check
npm --prefix apps/agent run build        # TypeScript compilation check
```

### Specialized Commands
```bash
# Run MCP server directly
npm --prefix apps/mcp-citybites run mcp

# Production starts
npm --prefix apps/agent run start        # Requires built dist/
npm --prefix apps/frontend run start     # Requires built .next/
```

## Environment Variables

### Frontend (`apps/frontend/.env.local`)
- `AGENT_SERVICE_URL` - URL to the agent service (default: `http://localhost:4000`)

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
- `scripts/run-tests.sh` - Repository-wide test orchestration

## Development Workflow

### Code Style
- TypeScript throughout with strict configuration
- ESLint with Next.js rules for frontend
- Prettier-style 2-space indentation
- Functional React components preferred

### Testing Strategy
- Frontend: ESLint serves as primary quality gate
- Services: TypeScript compilation validation
- Cross-repo: `./scripts/run-tests.sh` validates all apps

### Commit Conventions
- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`
- Keep subject lines under 72 characters
- Include relevant context in body for non-trivial changes

### Pull Request Requirements
- Run `./scripts/run-tests.sh` before pushing
- Include screenshots for UI changes
- Link related issues or TODO items

## Agent Guidelines

From [AGENTS.md](AGENTS.md):

- **Module Organization**: Respect the three-app separation (frontend UI, agent orchestration, MCP tools)
- **Development Commands**: Use the npm --prefix pattern for app-specific commands
- **Code Style**: Follow existing TypeScript patterns and ESLint rules
- **Environment Setup**: MCP server requires Playwright for PDF generation; agent auto-detects MCP location

### Common Development Tasks
- **New MCP Tool**: Add to `apps/mcp-citybites/src/tools.ts` and expose via `mcp-server.ts`
- **Agent Logic**: Modify `apps/agent/src/generator.ts` for orchestration changes
- **Frontend Changes**: Update `apps/frontend/src/app/page.tsx` for UI, ensure API route compatibility

## Deployment Notes

- **Agent & MCP**: Deployable to Fly.io with Dockerfile in `apps/agent/`
- **Frontend**: Deployable to Vercel, requires `AGENT_SERVICE_URL` configuration
- **CI/CD**: Uses `.github/workflows/` for testing and deployment automation

The agent Dockerfile embeds both the agent and MCP server in a single image for production deployment.

## Troubleshooting

### Common Issues
- **MCP Server not starting**: Ensure `apps/mcp-citybites` is built or use dev mode
- **PDF generation failing**: Check Playwright installation or set `DISABLE_PDF=true`
- **OpenAI integration**: Requires valid `OPENAI_API_KEY` for place enrichment

### Debug Commands
```bash
# Check MCP server directly
npm --prefix apps/mcp-citybites run mcp

# Test agent without frontend
curl http://localhost:4000/health
```

## References

- [README.md](README.md) - Detailed setup and deployment instructions
- [AGENTS.md](AGENTS.md) - Repository guidelines and coding conventions
- `.github/workflows/` - CI/CD pipeline configuration
- `scripts/run-tests.sh` - Cross-application testing orchestration