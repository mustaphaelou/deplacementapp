# Mission

Deploy the **deplacementapp** (Next.js + Prisma + PostgreSQL) to production myself, on **Coolify**, and actually understand what Docker is doing underneath — not just blindly copy commands.

## Why

I have run `docker compose up` and copied commands before, but I don't really understand what's happening. When the deployment breaks — or when I need to change an environment variable, add a service, or swap a database — I'm stuck. I want enough understanding to debug and trust what Coolify is doing on my behalf.

## Target environment

- A Coolify instance (self-hosted PaaS that wraps Docker + Docker Compose).
- The repo already has a multi-stage `Dockerfile`, a production `compose.yml`, a dev `compose.dev.yml`, and a `docker-entrypoint.sh` that runs Prisma migrations + production seeding before starting `node server.js`.

## Definition of done

- I can explain, in my own words, what each stage of the `Dockerfile` does and why.
- I can explain what `compose.yml` declares (services, ports, env, volumes, healthchecks, `depends_on`) and how Coolify uses it.
- I can deploy the app to Coolify, configure the required environment variables, and have it serve traffic with a healthy database.
- When something breaks, I know where to look: image build, container start, entrypoint/migrations, app health, or env config.

## Out of scope (for now)

- Kubernetes, Nomad, or other orchestrators.
- CI/CD pipelines outside Coolify's built-in git hooks.
- Multi-server / load-balanced setups.
- Deep Next.js internals (I only need the deployment-relevant facts: `output: 'standalone'`, `node server.js`, the static/standalone split).
