# deplacementapp Deployment Glossary

Canonical language for this teaching workspace. All lessons, reference docs, and learning records adhere to these terms. Terms are added only once the user has demonstrated understanding (per GLOSSARY-FORMAT.md); this starts small and grows.

## Docker core

**Image**:
A read-only, layered snapshot of a filesystem plus metadata (env, working dir, entrypoint). Built from a `Dockerfile`. Not a running thing.
_Avoid_: package, artifact

**Container**:
A running instance of an image — an isolated process tree with its own filesystem view (a writable layer stacked on the image), network, and env. Same image can launch many containers.
_Avoid_: instance (ambiguous), pod

**Stage (build stage)**:
One `FROM`-block inside a multi-stage Dockerfile. Each stage produces an intermediate image that later stages can `COPY --from=`. Used to keep build tools out of the runtime image.
_Avoid_: layer (different concept — layers are within one image)

**Layer**:
A single instruction's worth of filesystem delta inside one image, stacked on the previous layer. Cached independently. Order of `RUN` / `COPY` instructions directly affects cache hits.
_Avoid_: stage

## This app

**Standalone build**:
Next.js build mode (`output: 'standalone'` in `next.config.mjs`) that emits the minimum server + node_modules to run `node server.js`. Lets the Dockerfile ship a small runtime image without the full `node_modules`.
_Avoid_: serverless export, static export (both wrong here)

**Entrypoint (`docker-entrypoint.sh`)**:
Script that runs every time a container starts. For this app: `prisma migrate deploy` → production seed → `node server.js`. Runs migrations on each boot, which matters for zero-downtime and rolling deploys.
_Avoid_: startup script (too vague)
