# syntax=docker/dockerfile:1

# ── BaseForge Production Dockerfile ──────────────────────────────
# Multi-stage build: deps → build → production
# - Non-root user (nextjs:1001)
# - Standalone output (~150MB final image)
# - Health check endpoint
# - Security labels

FROM node:20-alpine AS base

# ── Stage 1: Install dependencies ────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependency files first for better layer caching
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then \
    npm ci --ignore-scripts && npm cache clean --force; \
  else \
    echo "No lockfile found. Run npm install before building." && exit 1; \
  fi

# ── Stage 2: Build the application ──────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build args for Sentry source maps (optional)
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

RUN npm run build

# ── Stage 3: Production server ───────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only production artifacts (standalone output)
COPY --from=builder /app/public ./public

# Set correct permissions for standalone output
RUN mkdir -p .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check — hit the /api/health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# OCI metadata labels
LABEL org.opencontainers.image.title="BaseForge Analytics"
LABEL org.opencontainers.image.description="AI-Ready Intelligence Layer for the Base Ecosystem"
LABEL org.opencontainers.image.url="https://github.com/AmnAnon/baseforge"
LABEL org.opencontainers.image.source="https://github.com/AmnAnon/baseforge"
LABEL org.opencontainers.image.vendor="BaseForge"

CMD ["node", "server.js"]
