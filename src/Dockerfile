# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# AgentCore Runtime expects the MCP server at 0.0.0.0:8000/mcp
# We never change this port — AgentCore hardcodes it
EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000
# DB_BACKEND and MEMORY_BACKEND are injected at runtime by AgentCore

CMD ["node", "dist/index.js"]