# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat

# --- deps stage: full install (build tooling + prisma CLI for migrations) ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# --- builder stage: build Next.js standalone output ---
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- migrator stage: one-shot schema migrations + reference seed ---
# node_modules come from builder (not deps) because prisma generate has
# already run there — the seed script needs the generated client.
FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY prisma ./prisma
COPY prisma.config.js ./
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed-production.js"]

# --- runner stage: minimal production image (pure standalone) ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output already contains the traced minimal node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Uploads directory (named volume mount point, writable by uid 1001)
RUN mkdir -p public/uploads/avatars && \
    chown -R nextjs:nodejs public/uploads

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1))" || exit 1

CMD ["node", "server.js"]
