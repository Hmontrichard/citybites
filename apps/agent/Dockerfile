# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.15.0
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS build

# Copy package manifests
COPY apps/mcp-citybites/package.json apps/mcp-citybites/package.json
COPY apps/mcp-citybites/package-lock.json apps/mcp-citybites/package-lock.json
COPY apps/agent/package.json apps/agent/package.json
COPY apps/agent/package-lock.json apps/agent/package-lock.json

# Install dependencies (include dev deps for build)
RUN npm --prefix apps/mcp-citybites install
RUN npm --prefix apps/agent install

# Copy full repo
COPY . .

# Build MCP server (provides dist/mcp-server.js)
RUN npm --prefix apps/mcp-citybites run build

# Build agent
RUN npm --prefix apps/agent run build

# Trim dev dependencies for runtime
RUN npm --prefix apps/agent prune --omit=dev && \
    npm --prefix apps/mcp-citybites prune --omit=dev

FROM base
ENV PORT=4000
ENV MCP_PREFIX=/app/apps/mcp-citybites

COPY --from=build /app /app

EXPOSE 4000
CMD ["node", "apps/agent/dist/server.js"]
