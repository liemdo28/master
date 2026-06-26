# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

LABEL org.opencontainers.image.title="Antigravity Universal AI Gateway"
LABEL org.opencontainers.image.description="Multi-provider AI gateway with protocol translation and failover"

RUN addgroup -S gateway && adduser -S gateway -G gateway

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Runtime data directory (keys.json, gateway.log)
RUN mkdir -p /app/data && chown -R gateway:gateway /app
VOLUME ["/app/data"]

USER gateway

ENV PORT=3456 \
    HOST=0.0.0.0 \
    NODE_ENV=production \
    CONFIG_PATH=/app/data/keys.json

EXPOSE 3456

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3456/health || exit 1

CMD ["node", "dist/server.js"]
