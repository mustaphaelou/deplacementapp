# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

# --- deps stage: full install ---
#
# The retry flags are not decoration. The `runner` image is built for
# linux/amd64 AND linux/arm64, and the arm64 leg runs under QEMU emulation —
# roughly an order of magnitude slower at network I/O than a native leg. Main
# run #195 (2026-09-29, merge of #330) died here with `npm error code
# ETIMEDOUT` at 164s on exactly that leg, with no code change to blame: the
# next run of the same tree was green. npm's defaults (2 retries, 10s/60s
# bounds) are not enough to ride out an emulated fetch, so a transient
# registry hiccup takes the whole multi-arch build — and with it `deploy` —
# down.
FROM base AS deps
WORKDIR /app
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000

# --- build environment: adds glibc compat for native build tools (tailwindcss oxide, swc, etc.) ---
FROM base AS build-env
RUN apk add --no-cache libc6-compat

# --- migrator stage: run database migrations at container start ---
FROM build-env AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY drizzle.config.ts ./drizzle.config.ts
COPY db ./db
COPY drizzle ./drizzle
ENV NODE_ENV=production
# Versioned migrations, not `push`. `push` diffs the live database against the
# schema and applies whatever it finds missing, which is a destructive
# operation on a non-TTY deploy container and bypasses migration review. The
# committed chain in drizzle/ is the reviewable, ordered record (#241, ADR-0005).
CMD ["npx", "drizzle-kit", "migrate"]

# --- builder stage: build Next.js standalone output ---
FROM build-env AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner stage: minimal production image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --no-create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p public/uploads/avatars && \
    chown -R nextjs:nodejs public/uploads

LABEL org.opencontainers.image.title="DeplacementApp" \
      org.opencontainers.image.description="Travel request management system" \
      org.opencontainers.image.authors="Mustapha Elouardi" \
      org.opencontainers.image.source="https://github.com/mustaphaelou/deplacementapp" \
      org.opencontainers.image.vendor="Mustapha Elouardi" \
      org.opencontainers.image.licenses="UNLICENSED"

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1))" || exit 1

CMD ["node", "server.js"]
