FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# --- Production ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

# Create non-root user and data directory
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appgroup /app/data

USER appuser

CMD ["node", "--enable-source-maps", "dist/index.js"]
