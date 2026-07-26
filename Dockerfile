# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat

# --- deps stage: full install ---
FROM base AS deps
WORKDIR /app
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# --- migrator stage: run database migrations at container start ---
FROM base AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY drizzle.config.ts ./drizzle.config.ts
COPY db ./db
COPY drizzle ./drizzle
ENV NODE_ENV=production
CMD ["npx", "drizzle-kit", "push"]

# --- builder stage: build Next.js standalone output ---
FROM base AS builder
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
    adduser --system --uid 1001 --no-log-init nextjs

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
