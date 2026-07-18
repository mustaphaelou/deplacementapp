FROM node:20-alpine AS base

# --- deps stage: install all dependencies (for build) ---
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

# --- prod-deps stage: install production dependencies only ---
FROM base AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# --- builder stage: build Next.js standalone ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner stage: minimal production image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy production dependencies for runtime scripts (seeding / admin CLI)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy Prisma assets needed for runtime migrations and seeding
COPY --from=builder /app/prisma.config.js ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create directories for persistent volumes and set ownership
RUN mkdir -p public/uploads pdfs && \
    chown -R nextjs:nodejs public/uploads pdfs

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=30s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1))" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
