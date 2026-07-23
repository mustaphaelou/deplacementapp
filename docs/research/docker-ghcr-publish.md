# Docker — Build & Publish to GHCR via GitHub Actions

> Generated: 2026-07-23
> Purpose: Establish a reproducible CI pipeline to build multi-arch Docker images and publish them to GitHub Container Registry, then deploy via Coolify.

---

## 1. Docker Multi-Arch Builds (linux/amd64 + linux/arm64)

### Buildx with QEMU emulation

Multi-platform images use a **manifest list** pointing to one manifest + layer set per platform. Building them requires either:

1. **QEMU emulation** (easiest) — BuildKit auto-detects available emulated architectures.
2. **Multiple native nodes** — each arch on its own builder node.
3. **Cross-compilation** — language-level arch targeting in multi-stage builds.

For CI, the QEMU approach is standard. Docker Desktop bundles QEMU; on GitHub runners use `docker/setup-qemu-action`.

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v4

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v4

- name: Build and push
  uses: docker/build-push-action@v7
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ghcr.io/org/repo:latest
```

Source: [Docker Docs — Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
Source: [Docker Docs — Multi-platform with GitHub Actions](https://docs.docker.com/build/ci/github-actions/multi-platform/)

### `docker-container` driver

The `setup-buildx-action` uses the `docker-container` driver by default, which supports multi-platform builds but does **not** load images into the runner's local store — they must be pushed directly to a registry.

Source: [docker/setup-buildx-action README](https://github.com/docker/setup-buildx-action)

---

## 2. GitHub Container Registry (ghcr.io)

### Authentication

GitHub Actions workflows authenticate using the auto-generated `GITHUB_TOKEN`:

```yaml
- name: Login to GitHub Container Registry
  uses: docker/login-action@v4
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

Source: [docker/login-action — GitHub Container Registry](https://github.com/docker/login-action#github-container-registry)

### Token permissions

The `GITHUB_TOKEN` needs the `packages: write` permission at the job level to push images:

```yaml
jobs:
  build:
    permissions:
      contents: read
      packages: write
```

Without this, the login succeeds but the push returns a 403.

Source: [GitHub Docs — About permissions for GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)

### Tag naming pattern

Images are tagged as `ghcr.io/OWNER/REPO:TAG`. The `OWNER` is the GitHub user or organization name (case-insensitive). Use `${{ github.repository }}` for the `OWNER/REPO` pair.

```yaml
tags: |
  ghcr.io/${{ github.repository }}:latest
  ghcr.io/${{ github.repository }}:sha-${{ github.sha }}
```

For multi-target builds (runner + migrator), append a suffix:

```yaml
tags: |
  ghcr.io/${{ github.repository }}/runner:latest
  ghcr.io/${{ github.repository }}/migrator:latest
```

Source: [GitHub Docs — Working with the Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

### PAT for external access

Outside GitHub Actions (e.g., local dev or Coolify), use a **classic personal access token** with `read:packages` scope (or `write:packages` to also push). Fine-grained tokens with `Contents: read` + `Packages: read` also work.

```bash
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
```

Source: [GitHub Docs — Working with the Container registry (Authenticating with a PAT)](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-with-a-personal-access-token-classic)

---

## 3. Recommended Workflow Structure

The following describes the workflow that should be created at `.github/workflows/docker-publish.yml`:

### Triggers

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
```

### Job-level permissions

```yaml
permissions:
  contents: read
  packages: write
```

### Steps

1. **Checkout** — `actions/checkout@v4`
2. **Set up QEMU** — `docker/setup-qemu-action@v4`
3. **Set up Docker Buildx** — `docker/setup-buildx-action@v4`
4. **Log in to GHCR** — `docker/login-action@v4` with `registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`
5. **Metadata** — `docker/metadata-action@v5` to generate tags and labels from git refs (optional but recommended)
6. **Build and push `runner` target** — `docker/build-push-action@v7` with `target: runner`, `platforms: linux/amd64,linux/arm64`, `push: true`, tags including `latest`, `sha-<short>`, and git semver tag
7. **Build and push `migrator` target** — same action, different `target: migrator` and tags (e.g., `migrator-latest`, `migrator-sha-<short>`)

### Tag strategy

Use `docker/metadata-action` or manual tag lists:

```yaml
# Per-target tags using metadata-action
tags: |
  ghcr.io/${{ github.repository }}/runner:latest
  ghcr.io/${{ github.repository }}/runner:${{ github.sha }}

# Or with semver from git tag
tags: |
  type=raw,value=latest,enable=${{ github.ref_name == 'main' }}
  type=sha,format=short
  type=semver,pattern={{version}}
  type=semver,pattern={{major}}.{{minor}}
```

Source: [Docker Docs — Push to multiple registries with GitHub Actions](https://docs.docker.com/build/ci/github-actions/push-multi-registries/)
Source: [docker/metadata-action](https://github.com/docker/metadata-action)

---

## 4. Repository Secrets

### Minimal setup (GHCR push only)

**No secrets needed.** The `GITHUB_TOKEN` is injected automatically by GitHub Actions. You only need to set the `packages: write` permission in the workflow YAML.

### Optional: Coolify deployment trigger

If the workflow should also trigger a Coolify redeploy, add these repository secrets:

| Secret | Source | Required |
|--------|--------|----------|
| `COOLIFY_WEBHOOK` | Coolify app → Webhooks → Deploy Webhook URL | Yes for auto-deploy |
| `COOLIFY_TOKEN` | Coolify → Settings → Keys & Tokens → API Token (with `deploy` permission) | Yes for webhook auth |

Source: [Coolify Docs — GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions)
Source: [Nusendra — Faster Deployments with GitHub Actions, GHCR, and Coolify](https://nusendra.com/post/github-actions-ghcr-coolify-deployment)

---

## 5. .dockerignore Best Practices

### Existing `.dockerignore` (current state)

The project already has a `.dockerignore` covering `node_modules`, `.next`, `.git`, `.env`, `.env*.local`, `*.md`, Docker/Compose files, and IDE config. This is a good baseline.

### Gaps vs. official recommendations

Per the [Docker Docs Next.js guide](https://docs.docker.com/guides/nextjs/) and [Vercel's with-docker example](https://github.com/vercel/next.js/blob/canary/examples/with-docker/.dockerignore), consider adding:

```
# Testing artifacts
coverage/
.nyc_output/
__tests__/
__mocks__/
jest/
cypress/
playwright-report/
test-results/
.vitest/

# Cache and temp
.cache/
.parcel-cache/
.eslintcache
.stylelintcache
.turbo/
.tmp/
.temp/
.swc/

# CI/CD (not needed in build context)
.github/
.gitlab-ci.yml
.travis.yml
.circleci/
Jenkinsfile

# Debug logs (wildcard)
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
lerna-debug.log*
*.log

# OS files
.DS_Store
Thumbs.db
Desktop.ini

# TypeScript build info
*.tsbuildinfo

# Sensitive / dev-only config (optional)
.pem
.editorconfig
.prettierrc*
.eslintrc*
.stylelintrc*
```

Key principle: every file excluded reduces build context size sent to the Docker daemon, speeding up `COPY . .` in the builder stage.

Source: [Docker Docs — Containerize a Next.js app](https://docs.docker.com/guides/nextjs/containerize/)
Source: [Vercel Next.js — examples/with-docker/.dockerignore](https://github.com/vercel/next.js/blob/canary/examples/with-docker/.dockerignore)

---

## 6. Action Pinning & Security

### Recommended actions with pinned versions

Docker's official docs use major-version tags (`@v4`, `@v7`) for readability. For **supply-chain security**, pin to the **commit SHA** of each release. Below are the latest releases (July 2026) with their short SHAs.

| Action | Tag | Pinned SHA (short) | Pinned SHA (full, verify at release) |
|--------|-----|---------------------|--------------------------------------|
| `docker/setup-qemu-action` | `v4.2.0` | `96fe6ef` | `docker://docker/setup-qemu-action@sha256:...` |
| `docker/setup-buildx-action` | `v4.2.0` | `bb05f3f` | `docker://docker/setup-buildx-action@sha256:...` |
| `docker/login-action` | `v4.4.0` | `af1e73f` | `docker://docker/login-action@sha256:...` |
| `docker/build-push-action` | `v7.3.0` | `53b7df9` | `docker://docker/build-push-action@sha256:...` |
| `docker/metadata-action` | `v5.6.1` | (check latest) | — |
| `actions/checkout` | `v4` | (check latest) | — |

To pin by SHA in your workflow:

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@96fe6ef  # v4.2.0
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@bb05f3f  # v4.2.0
- name: Login to GHCR
  uses: docker/login-action@af1e73f  # v4.4.0
- name: Build and push
  uses: docker/build-push-action@53b7df9  # v7.3.0
```

> **Note:** Short SHAs (7 chars) are shown on the release pages. For stronger integrity, use the full 40-char SHA or the container digest (`sha256:...`). Verify the SHA on the [releases page](https://github.com/docker/build-push-action/releases) before pinning.

Source: [Docker Docs — Multi-platform with GitHub Actions](https://docs.docker.com/build/ci/github-actions/multi-platform/) (uses version tags in examples)
Source: Each action's releases page (SHAs above) — [build-push-action v7.3.0](https://github.com/docker/build-push-action/releases/tag/v7.3.0), [setup-qemu-action v4.2.0](https://github.com/docker/setup-qemu-action/releases/tag/v4.2.0), [setup-buildx-action v4.2.0](https://github.com/docker/setup-buildx-action/releases/tag/v4.2.0), [login-action v4.4.0](https://github.com/docker/login-action/releases/tag/v4.4.0)

---

## 7. Coolify Access to Private ghcr.io Packages

### How Coolify pulls from GHCR

Coolify does **not** store registry credentials in its database. It relies on the Docker Engine's native authentication on the deployment server. The `coolify-helper` container mounts the host's `~/.docker/config.json` into the helper at `/root/.docker/config.json:ro`.

Source: [Coolify — Docker Registry docs](https://coolify.io/docs/knowledge-base/docker/registry/)
Source: [Coolify GitHub Issue #6398](https://github.com/coollabsio/coolify/issues/6398)

### Setup steps on the Coolify server

1. **SSH into the Coolify server** as root (or the user Coolify runs as).

2. **Create a classic GitHub PAT** with `read:packages` scope. Fine-grained tokens with `Packages: read` also work.

3. **Login to ghcr.io** as root (critical — Coolify's helper runs as root):

   ```bash
   sudo su -
   echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

   This saves credentials to `/root/.docker/config.json`.

4. **Verify** by pulling the private image manually:

   ```bash
   docker pull ghcr.io/your-org/your-repo:latest
   ```

### Common pitfalls

- **Non-root user login**: If you `docker login` as a non-root user, credentials go to `~/.docker/config.json` but Coolify mounts `~root/.docker/config.json`. Solution: always `sudo su -` first, or copy the config file to the Coolify user's home.
- **Expired PAT**: GitHub classic PATs can expire. When they do, `docker pull` returns "denied: denied". Re-run `docker login` with a renewed token.
- **Dual-server setup**: If Coolify uses separate build and deploy servers, you must `docker login` on **both** servers.

### Workflow-level change for Coolify

Once images are pushed to GHCR, configure the Coolify app as a **Docker Image** resource (not Docker Compose build). Point it to:

```
ghcr.io/your-org/your-repo/runner:latest
ghcr.io/your-org/your-repo/migrator:latest
```

and add `DATABASE_URL` etc. as environment variables in the Coolify UI.

Source: [Coolify Troubleshoot — Expired GitHub PAT](https://coolify.io/docs/troubleshoot/docker/expired-github-personal-access-token)
Source: [Nusendra — Faster Deployments with GitHub Actions, GHCR, and Coolify](https://nusendra.com/post/github-actions-ghcr-coolify-deployment)
Source: [Skipperkongen — Deploy private Docker images to Coolify from GHCR](https://skipperkongen.dk/2026/06/03/deploy-private-docker-images-to-coolify-from-ghcr/)

---

## Summary of What Goes Where

| Artifact | Location | Notes |
|----------|----------|-------|
| Workflow | `.github/workflows/docker-publish.yml` | Do NOT write — this document describes what it should contain |
| `.dockerignore` | `.dockerignore` (root) | Already exists; minor additions recommended |
| GitHub Secrets | None required for GHCR push | `GITHUB_TOKEN` is auto-provided |
| GitHub Secrets (optional) | `COOLIFY_WEBHOOK`, `COOLIFY_TOKEN` | For triggering Coolify redeploy |
| Coolify server config | SSH → `docker login ghcr.io` as root | Classic PAT with `read:packages` |
| Coolify app type | Docker Image (not Docker Compose) | Points to pre-built GHCR image tag |
