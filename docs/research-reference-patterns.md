# Research: Deployment Patterns for Next.js + Prisma + PostgreSQL on Coolify

> Generated: 2026-07-18
> Sources compared for the `deplacementapp` project.

---

## Summary Table

| Dimension | nico.fyi blog | AZDIGI blog | Coolify NextJS docs | Coolify Docker Compose docs |
|---|---|---|---|---|
| **Build pack** | Dockerfile (avoids Nixpacks bugs) | Docker Compose | Nixpacks or Dockerfile | Docker Compose |
| **DB strategy** | Separate Coolify-managed Postgres | Postgres in same compose file | Not specified | Postgres in same compose file |
| **Configures own DB?** | No — uses Coolify's internal DB URL | Yes — postgres service in compose | Not covered | Yes — compose service |
| **Networking** | Not covered (single container) | Auto-network; don't declare custom networks | Not covered | Auto-network; **do NOT define custom networks** (causes 504) |
| **Healthcheck** | Not covered | Not covered | Not covered | `exclude_from_hc: true` for one-off services |
| **Entrypoint** | `CMD node server.js` (no migration in entrypoint) | Not covered | Not covered | Node.js example not covered |
| **Prisma migration** | Build-time via `RUN npx prisma migrate deploy` (needs DB during build) | Not covered | Not covered | Not covered |
| **Standalone output** | Required (`output: 'standalone'`) | Not applicable | Not covered | Not covered |
| **Volumes** | Not covered | Named volumes auto-managed; keep-volumes prompt on delete | Not covered | `is_directory: true` annotation for empty dirs; `content:` for inline files |
| **Env vars** | `ARG`/`ENV` in Dockerfile for build-time; same at runtime | Inline `environment:` or Coolify UI (UI overrides) | Via Coolify UI (Port 3000) | Coolify UI or compose inline; UI overrides compose |
| **Build cache** | Not covered | Not covered | Not covered | `SOURCE_COMMIT` disabled by default to preserve cache |
| **Custom domains** | Not covered | Via FQDN per service after deploy | Not covered | Via FQDN per service; Traefik routes automatically |

---

## 1. Source: nico.fyi Blog — Nico Prananta, 2024-06-19

**URL:** https://www.nico.fyi/blog/deploy-next-js-prisma-postgres-using-coolify

### Pattern
- Single-container Next.js app (Dockerfile build pack) + separate Coolify-managed Postgres.
- Reason: Nixpacks fails with Prisma ("Schema engine error" — known Nixpacks limitation).
- Uses `output: 'standalone'` in `next.config.mjs` for a minimal production image.
- DATABASE_URL is Coolify's *internal* Postgres URL (exposed by Coolify when you create a Postgres resource).
- **Build-time migration issue:** The author initially tried `prisma migrate deploy` during `docker build` — this fails because the build container is not on the same Docker network as the database. Their solution: use a Dockerfile, set DATABASE_URL as a build arg, and presumably ensured network connectivity during build.
- Dockerfile follows the [official Next.js standalone example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) with multi-stage build.

### Key Dockerfile pattern
```dockerfile
FROM node:18-alpine AS base
FROM base AS builder
WORKDIR /app
COPY package.json lockfile* ./
RUN npm ci
COPY app public components lib prisma ... ./
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate
RUN npm run build

FROM base AS runner
RUN apk --no-cache add curl
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
EXPOSE 3000
ENV PORT 3000
CMD HOSTNAME=0.0.0.0 node server.js
```

### Gotchas
- Nixpacks + Prisma = unreliable; use **Dockerfile** build pack.
- Build-time DB access requires network connectivity between build container and DB.
- Standalone output is required for the `COPY --from=builder .next/standalone` approach.

---

## 2. Source: AZDIGI Blog — 2026-03-15

**URL:** https://azdigi.com/en/blog/self-hosted/deploy-docker-compose-on-coolify-complex-multi-container-applications

### Pattern
- Docker Compose stack for multi-service apps (app + DB + cache + worker).
- Simpler apps (1 app + 1 DB) can be separate Coolify resources for easier management.
- Coolify auto-creates a shared bridge network for all services in a compose stack.
- **No need to declare networks in compose** — doing so causes issues.

### Key Docker Compose pattern (for Node.js + Postgres + Redis)
```yaml
services:
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://appuser:apppass@postgres:5432/myapp
    ports:
      - "3000:3000"
    depends_on:
      - postgres
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: apppass
      POSTGRES_DB: myapp
    volumes:
      - pg_data:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
  worker:
    build: .
    command: node worker.js
    environment:
      DATABASE_URL: postgresql://appuser:apppass@postgres:5432/myapp
    depends_on:
      - postgres
volumes:
  pg_data:
  redis_data:
```

### Domains
- Only services with `ports:` mapping are externally accessible.
- Assign domain via Coolify UI (FQDN field) after deployment.
- Traefik automatically routes traffic.

### Volumes
- Named volumes are auto-created by Coolify.
- When deleting the compose resource, Coolify asks: **keep or delete volumes**.
- Choose "Keep Volumes" to preserve data across stack deletion.

### Environment Variables
- Two methods: inline in compose `environment:` section, or via Coolify UI.
- Coolify UI variables **override** inline values.

---

## 3. Source: Coolify NextJS Docs

**URL:** https://coolify.io/docs/applications/nextjs

### Build Options
| Type | Build Pack | Settings |
|---|---|---|
| Server (Node.js SSR) | Nixpacks | Default build pack, no extra flags |
| Static (SPA) | Nixpacks | Enable "Is it a static site?", Output Directory = `out` |
| Custom Dockerfile | Dockerfile | Port Exposes = `3000`, create `Dockerfile` in repo root |

### Dockerfile recommendation
- When Nixpacks has problems or you need more control, use Dockerfile.
- References the [official Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker).
- Port Exposes must be set to `3000` in Coolify UI.

---

## 4. Source: Coolify Docker Compose Build Packs Docs

**URL:** https://coolify.io/docs/applications/build-packs/docker-compose

### Key Configuration
- Build pack selection: Nixpacks → Docker Compose from dropdown.
- Branch auto-detected; Base Directory (monorepo support); Compose file location.
- Ports exposed automatically get domains via Coolify UI.

### Networking — CRITICAL GOTCHA
```
WARNING: If your docker-compose.yml defines custom networks, remove them.
Defining custom networks causes intermittent outages where your app becomes
unreachable over HTTPS.
```
- Reason: Containers end up on *two* networks (Coolify-managed + custom). Traefik non-deterministically picks which IP to route to. If it picks the custom network IP, requests get 504 Gateway Timeout.
- **Fix:** Remove all `networks:` sections from compose. Coolify's auto-created network handles inter-service communication.
- Cross-stack communication: use "Connect to Predefined Network" option and reference service as `postgres-<uuid>`.

### Storage Features
| Feature | Syntax |
|---|---|
| Create empty dir | `volumes: - type: bind, source: ./srv, target: /srv, is_directory: true` |
| Create file with content | `volumes: - type: bind, source: ./path/file.sql, target: /path, content: \| ...` |

### Healthcheck Exclusion
```yaml
services:
  migration-runner:
    exclude_from_hc: true
```

### Labels (Raw Compose Mode)
Coolify auto-adds traefik labels. In raw compose mode, add manually:
```yaml
labels:
  - coolify.managed=true
  - traefik.enable=true
  - "traefik.http.routers.myapp.rule=Host(`example.com`)"
```

### Build Arguments
- **Inject Build Args** (default enabled): Coolify auto-injects env vars as Docker build args.
- **Include Source Commit** (default disabled): Keeps Docker cache intact. Enable only if build process needs the commit hash.

---

## Key Takeaways for deplacementapp

### What's already correct

| Aspect | Current setup | Status |
|---|---|---|
| Build pack | Dockerfile (multi-stage, standalone output) | ✅ Best practice |
| Docker Compose | `app` + `db` services | ✅ Matches AZDIGI pattern |
| Standalone output | `output: 'standalone'` in next.config.mjs | ✅ Required |
| Runtime migrations | `docker-entrypoint.sh` runs `prisma migrate deploy` at container start, not build | ✅ Avoids build-time DB dependency |
| Healthcheck | PostgreSQL `pg_isready`, app via `/api/health` | ✅ |
| depends_on | `condition: service_healthy` | ✅ |
| No custom networks | Not defined in compose | ✅ Avoids the 504 bug |
| DB hostname | `@db:5432` (service name) | ✅ Correct for compose networking |
| Named volumes | `postgres_data`, `upload_data`, `pdf_data` | ✅ |
| Node version | `node:20-alpine` | ✅ Current LTS |

### Recommended additions / checks

1. **Verify `prisma.config.js` exists** — the Dockerfile copies `prisma.config.js` from builder. If this file doesn't exist, remove that `COPY` line or the build will fail.
2. **Entrypoint runs seed every restart** — `docker-entrypoint.sh` runs `prisma/seed-production.js` on every container start. If seeding is idempotent this is fine; otherwise wrap in a guard (check if data already exists).
3. **Consider `exclude_from_hc` for seed-only service** — if you ever split migrations/seeding into a separate one-shot service, add `exclude_from_hc: true`.
4. **Volume deletion safety** — document in runbook that on resource deletion, choose "Keep Volumes" to preserve `postgres_data`.
5. **Env var strategy** — use Coolify UI for secrets (NEXTAUTH_SECRET, SMTP_PASS, POSTGRES_PASSWORD); use inline `environment:` in compose for non-sensitive defaults. UI overrides compose values.
6. **Build cache** — keep `Include Source Commit in Build` **disabled** (the Coolify default) to preserve Docker layer caching across deploys.
7. **SMTP optionality** — the app has SMTP vars but they're optional. The compose file should not fail if SMTP_* are unset. Currently they use `${SMTP_HOST}` without defaults — consider adding `:-` fallbacks or making the app tolerate empty SMTP config.
8. **Coolify UI port** — ensure Port Exposes is set to `3000` in the Coolify UI (matches Dockerfile `EXPOSE 3000`).

### Decision: Dockerfile vs Docker Compose build pack

The project already uses **Docker Compose build pack** (deploying `docker-compose.yaml` as the resource). This is the right choice because:

- The DB is part of the stack (not a separate Coolify resource) — self-contained deployment.
- The startup order is enforced via `depends_on: condition: service_healthy`.
- No external network references needed.

### If migrating to separate DB resource

If you ever split the DB out as a standalone Coolify-managed Postgres:
- Switch to **Dockerfile build pack** (single app container).
- Change `DATABASE_URL` to Coolify's internal Postgres URL (visible in Coolify DB resource UI).
- Remove `db` service, healthcheck, and `depends_on` from compose.
- Migrations still run at container start via entrypoint (no build-time DB needed).

---

## Citations

| # | Source | URL |
|---|---|---|
| 1 | Nico's Blog — Deploy Next.js + Prisma + Postgres using Coolify | https://www.nico.fyi/blog/deploy-next-js-prisma-postgres-using-coolify |
| 2 | AZDIGI — Deploy Docker Compose on Coolify | https://azdigi.com/en/blog/self-hosted/deploy-docker-compose-on-coolify-complex-multi-container-applications |
| 3 | Coolify Docs — NextJS | https://coolify.io/docs/applications/nextjs |
| 4 | Coolify Docs — Docker Compose Build Packs | https://coolify.io/docs/applications/build-packs/docker-compose |
| 5 | Coolify Docs — Dockerfile Build Pack | https://coolify.io/docs/applications/build-packs/dockerfile |
