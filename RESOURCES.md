# Deploying deplacementapp on Coolify — Resources

Annotated, high-trust sources only. Knowledge is grouped in teaching order (Docker primitives → this repo's specifics → Compose → Coolify). Wisdom / communities are deferred until first deploy, per [NOTES.md](./NOTES.md).

## Knowledge

### Docker core
- [Docs: "Docker overview" — Docker](https://docs.docker.com/get-started/docker-overview/)
  The official conceptual model: images vs containers, the layered filesystem, daemon/engine split. Use for: building the mental model that makes everything else click. Start here.
- [Docs: "Multi-stage builds" — Docker](https://docs.docker.com/build/building/multi-stage/)
  Canonical reference for the 4-stage pattern (deps / prod-deps / builder / runner) used in this repo's `Dockerfile`. Use for: understanding why the image splits install + build + runtime.
- [Docs: "Best practices for writing Dockerfiles" — Docker](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
  Explains WHY each pattern (small base image, `--omit=dev`, non-root user, layered COPY ordering). Use for: judging whether an edit to the Dockerfile is safe.
- [Docs: "Dockerfile reference" — Docker](https://docs.docker.com/reference/dockerfile/)
  Authoritative for instruction semantics (`FROM`, `COPY --from=`, `USER`, `HEALTHCHECK`, `ENTRYPOINT`). Use for: resolving "what does this exact line do?".

### Compose & runtime
- [Docs: "Compose file reference" — Docker](https://docs.docker.com/compose/compose-file/)
  Defines `services`, `ports`, `environment`, `volumes`, `depends_on`, `healthcheck`. Use for: mapping `compose.yml` line-by-line to behaviour.
- [Docs: "Compose startup order & depends_on condition" — Docker](https://docs.docker.com/compose/startup-order/)
  Explains `depends_on: { db: { condition: service_healthy } }` — why the app waits for the Postgres healthcheck before starting. Use for: explaining how migrations don't run against a half-up DB.

### This app's specifics
- [Docs: "Automatically configure static exports" / `output: 'standalone'` — Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
  Why the Dockerfile copies `.next/standalone` and runs `node server.js` instead of `next start`. Use for: the "why standalone" mini-lesson. Without this, the runtime image layout is mysterious.
- [Docs: "Deployment" — Prisma](https://www.prisma.io/docs/orm/prisma-cli/deployment)
  Why `prisma migrate deploy` (not `migrate dev`) is used in `docker-entrypoint.sh`. Use for: explaining the entrypoint and why production uses `deploy`.

### Coolify
- [Docs: Coolify — Applications](https://coolify.io/docs/applications)
  How Coolify builds & runs an app from git, including Dockerfile-based apps and the env-var injection model. Use for: mapping the repo's `Dockerfile` + `compose.yml` into Coolify concepts.
- [Docs: Coolify — Databases](https://coolify.io/docs/databases)
  Managed Postgres inside Coolify as an alternative to the `db` service in `compose.yml`. Use for: deciding whether to use Coolify's DB or keep the compose `db` service.
- [Docs: Coolify — Knowledge Base](https://coolify.io/docs/knowledge-base)
  Short indexed answers to common ops questions (env vars, ports, persistent storage, deploy hooks). Use for: debug-time lookups during first deploy.

## Wisdom (Communities)
Deferred until after first successful deploy (see [NOTES.md](./NOTES.md)):

- [Coolify Discord](https://coollabs.io/discord)
  Official community; maintainer-present. Use for: Coolify-specific deployment quirks and getting unstuck on platform behaviour.
- [r/selfhosted](https://reddit.com/r/selfhosted)
  Broad self-hosting community. Use for: VPS choice, reverse-proxy gotchas, general Coolify usage context.

## Gaps
- No learning resource yet covers the **interaction** between Coolify's Compose-aware mode and a repo that ships a self-contained `compose.yml` plus a `Dockerfile`. We may need to discover this empirically during the first deploy and write a learning record from the result.
- Coolify's generated env-var names vs. the `compose.yml` `${...}` placeholders need verifying live (e.g. does Coolify inject `POSTGRES_USER`, `NEXTAUTH_SECRET` verbatim?). A learning record will capture confirmed mappings after first deploy.
