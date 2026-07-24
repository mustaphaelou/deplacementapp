# Use GitHub Container Registry as the Docker image registry

The project's Docker images (runner and migrator) are built by GitHub Actions and published to GitHub Container Registry (GHCR) at `ghcr.io/mustaphaelou/deplacementapp`. Production deployments via Coolify pull from GHCR rather than building locally.

## Considered Options

- **Build inline on Coolify (previous approach).** The `docker-compose.yaml` used `build:` directives, so Coolify built images from source on every deploy. Simple to understand but wasted server CPU and network bandwidth on every deploy, especially for multi-stage builds with Node.js dependencies.
- **Docker Hub.** An alternative registry. Requires a separate Docker Hub account and token stored as a GitHub secret, adding one more credential to rotate and manage.
- **Build locally and push to GHCR via GitHub Actions (chosen).** Keeps the build off the production server, co-locates the registry with the source on GitHub, and uses the auto-generated `GITHUB_TOKEN` for authentication — no extra secrets.

## Consequences

- The build is now decoupled from deployment. A failed build produces no new image, but the old image on GHCR remains available — Coolify keeps running the last good image.
- The `GITHUB_TOKEN` in the Actions workflow needs `packages: write` permission (already set in the workflow). For private repos, Coolify needs a separate GitHub PAT with `read:packages` scope to pull.
- Tag strategy is managed by `docker/metadata-action`: `latest` on default branch, `vX.Y.Z` on version tags, branch refs on feature branches.
- Two separate packages appear on GHCR: `deplacementapp` (runner) and `deplacementapp-migrator`.
