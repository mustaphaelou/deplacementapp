# Separate database migrations from the runtime image

The production runtime image contains only the Next.js standalone output; schema migrations and the reference seed run in a dedicated one-shot `migrate` service (built from a separate `migrator` Dockerfile target) that compose orders before `app` via `depends_on: service_completed_successfully`. Previously the entrypoint ran `prisma migrate deploy` + seed on every container start, which forced the full production `node_modules` and the prisma CLI into the runtime image — negating the standalone output's size benefit — and made the app crash-loop whenever the database was unavailable at startup.

## Considered Options

- **Migrations in the app entrypoint (rejected).** The common pattern, and what we had. It permanently couples the runtime image to migration tooling (the prisma CLI was only present *transitively*, via the `shadcn` CLI being mis-declared as a production dependency — an accident waiting to break) and conflates "start the app" with "change the schema".
- **Migrations run externally, from the deployer's shell or CI (rejected).** Keeps the image pure but adds a forgettable manual step to every deploy; on Coolify, where a deploy is a git push, there is no natural place for that step.

## Consequences

- The runtime image must never need the prisma CLI, `tsx`, or any dev tooling — if a future change requires a runtime script, it belongs in the `migrate` service or a new one-shot service, not the app entrypoint (which no longer exists).
- Startup ordering is owned by compose (`db` healthy → `migrate` exits 0 → `app` starts), so the app container no longer tolerates or retries database-unavailable states; it simply starts after the schema is ready.
- The full-install `deps` stage exists solely to feed the `builder` and `migrator` targets; nothing from it may be copied into the `runner` stage.
