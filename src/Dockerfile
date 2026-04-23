# ─── Online build stage (optional) ────────────────────────────────────────────
# Use this stage only when network access to npm registry is stable.
FROM node:20-alpine AS builder-online

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci --no-audit --fund=false

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

# ─── Online production stage (optional) ───────────────────────────────────────
FROM node:20-alpine AS production-online

WORKDIR /app

# Copy minimal runtime artifacts from builder (no second npm download)
COPY package*.json ./
COPY --from=builder-online /app/node_modules ./node_modules

# Copy compiled JS from builder
COPY --from=builder-online /app/dist ./dist

# ─── Offline/local production stage (default) ─────────────────────────────────
# Bypasses npm network calls by reusing local artifacts from the build context.
# Prereq on host:
#   npm install
#   npm run build
FROM node:20-alpine AS production-local

WORKDIR /app

COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist

# AgentCore Runtime expects the MCP server at 0.0.0.0:8000/mcp
# We never change this port — AgentCore hardcodes it
EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000
# DB_BACKEND and MEMORY_BACKEND are injected at runtime by AgentCore

CMD ["node", "dist/index.js"]

# Default target for `docker build -f src/Dockerfile ...`
FROM production-local AS production