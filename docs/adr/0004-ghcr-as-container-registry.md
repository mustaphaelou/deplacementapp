# Use GitHub Container Registry as the Docker image registry

The project's Docker images (runner and migrator) are built by GitHub Actions and published to GitHub Container Registry (GHCR) at `ghcr.io/mustaphaelou/deplacementapp/runner` and `ghcr.io/mustaphaelou/deplacementapp-migrator`. Production deployments via Coolify pull from GHCR rather than building locally.

## Considered Options

- **Build inline on Coolify (previous approach).** The `docker-compose.yaml` used `build:` directives, so Coolify built images from source on every deploy. Simple to understand but wasted server CPU and network bandwidth on every deploy, especially for multi-stage builds with Node.js dependencies.
- **Docker Hub.** An alternative registry. Requires a separate Docker Hub account and token stored as a GitHub secret, adding one more credential to rotate and manage.
- **Build locally and push to GHCR via GitHub Actions (chosen).** Keeps the build off the production server, co-locates the registry with the source on GitHub, and uses the auto-generated `GITHUB_TOKEN` for authentication — no extra secrets.

## Consequences

- The build is now decoupled from deployment. A failed build produces no new image, but the old image on GHCR remains available — Coolify keeps running the last good image.
- The `GITHUB_TOKEN` in the Actions workflow needs `packages: write` permission (already set in the workflow). For private repos, Coolify needs a separate GitHub PAT with `read:packages` scope to pull.
- Tag strategy is managed by `docker/metadata-action` in the single publish workflow (`.github/workflows/docker-publish.yml`): semver `vX.Y.Z` + `X.Y` tags on `v*` version tags, `latest` on default-branch and `vX.Y.Z` tag pushes, full-sha on every run. The image map — the `build-and-push` matrix job's one `include:` row per image (`{id, target, image, platforms}`) — is the tag-platform source of truth: it maps each Dockerfile stage to its GHCR image and platform set, and the metadata + build + push steps fan out from it unchanged per row. The naming inconsistency (runner nested under `deplacementapp/`, migrator a sibling `deplacementapp-migrator`) is a known wart, documented here rather than silently "fixed", to avoid orphaning published packages and Coolify's pinned pulls. A `vX.Y.Z` tag push also auto-creates a draft GitHub Release with generated notes. Non-semver tags fail the run before any Docker work and produce nothing — no versioned images, no sha image, no Release. See `CONTEXT.md` (*Deployment*) and `docs/agents/release.md` for the release-as-ticket process.
- Two separate packages appear on GHCR: `deplacementapp/runner` and `deplacementapp-migrator`.
- Future architecture reviews should not suggest re-expanding the image map into per-image blocks — the matrix `include:` row is the single data-rot seam (one added row = a third image), and the twin build/push blocks issue #178 replaced are gone. The twin-block deepening candidate is closed.
