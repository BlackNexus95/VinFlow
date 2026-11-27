# Stage 1: Build shared React + Vite frontend
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# Stage 2: Install backend production dependencies (compiles better-sqlite3 for target arch)
FROM node:22-bookworm-slim AS backend-builder
WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Stage 3: Minimal production runtime (serves both Web UI and shared REST API)
FROM node:22-bookworm-slim AS runtime
WORKDIR /app/backend

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    FINANCE_DB_PATH=/data/finance.db

COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
