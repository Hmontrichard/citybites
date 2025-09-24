# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.15.0
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"

FROM base AS build

# Copy package manifests
COPY apps/mcp-citybites/package.json apps/mcp-citybites/package.json
COPY apps/mcp-citybites/package-lock.json apps/mcp-citybites/package-lock.json
COPY apps/mcp-citybites/scripts apps/mcp-citybites/scripts
COPY apps/agent/package.json apps/agent/package.json
COPY apps/agent/package-lock.json apps/agent/package-lock.json

# Install dependencies (include dev deps for build)
RUN npm --prefix apps/mcp-citybites install --include=dev
RUN npm --prefix apps/agent install --include=dev

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

# Install runtime dependencies for Chromium
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    libxfixes3 \
    libx11-xcb1 \
    libx11-6 \
    libxcb1 \
    libxext6 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

RUN npx --yes playwright install chromium

EXPOSE 4000
CMD ["node", "apps/agent/dist/server.js"]
