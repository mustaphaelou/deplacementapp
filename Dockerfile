FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# --- deps stage: install all dependencies (for build) ---
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts && npm cache clean --force

# --- prod-deps stage: install production dependencies only ---
FROM base AS prod-deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.js ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
RUN npx prisma generate

# --- builder stage: build Next.js standalone ---
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner stage: minimal production image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy production dependencies (includes Prisma client generated in prod-deps)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy Prisma schema and config for runtime migrations
COPY --from=builder /app/prisma.config.js ./
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint script
COPY --chmod=0755 docker-entrypoint.sh ./

# Create directories for persistent volumes and set ownership
RUN mkdir -p public/uploads pdfs && \
    chown -R nextjs:nodejs public/uploads pdfs

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1))" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
