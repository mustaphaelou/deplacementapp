# Starting point: command-line fluency, conceptual gaps

User has run `docker compose up` and copied commands before, but does not understand what Docker is doing underneath. Goal is to deploy **deplacementapp** (Next.js standalone + Prisma + Postgres) on **Coolify**, with enough conceptual understanding to debug and configure confidently rather than copy-paste.

**Implications for future sessions:**
- Teach Docker primitives (image vs container vs layer vs stage) BEFORE walking the repo's Dockerfile, otherwise the 4-stage `Dockerfile` will feel like arbitrary noise.
- The repo's own `Dockerfile`, `compose.yml`, `docker-entrypoint.sh` are the canonical examples — don't substitute generic ones.
- Sequence is fixed: Docker primitives → this repo's `Dockerfile` stages → `compose.yml` services/healthchecks → Coolify mapping → first deploy.
- Watch-outs: `.env` looks like it contains a real password (`Mmmm2005.`) with a placeholder `NEXTAUTH_SECRET`. Flag rotation before first deploy. Never commit secrets.
