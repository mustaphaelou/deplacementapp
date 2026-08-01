# Cutting a Release (release-as-ticket)

A **Release** is a git tag `vX.Y.Z` pushed to `main`. Everything else — the GHCR image tags (`vX.Y.Z`, `X.Y`), the GitHub Release object, and its changelog — derives from it. Releasing is a **ticket**, not a button: a human decides *when* a Release happens, and RALPH executes the mechanics.

## Process overview

1. **Human** files a release ticket titled `Cut vX.Y.Z`, labelled `ready-for-agent`, whose body lists the issues closed since the last Release.
2. **RALPH** verifies the listed issues are closed, pushes the tag to `main`, waits for the `Docker Build & Publish` workflow, then rewrites the draft GitHub Release notes from the ticket's issue list and closes the ticket.
3. The workflow produces runner + migrator images on GHCR tagged `vX.Y.Z` and `X.Y` (plus `latest` and the full-sha tag) and auto-creates a **draft** GitHub Release with generated notes.

## When to cut a Release

On-demand. There is no automated version bump. The cadence is decided by filing the ticket — a Release never happens without one.

## Versioning

- SemVer (`vX.Y.Z`). Pre-1.0 bump rules: breaking changes bump the **minor** (e.g. `v0.1.0` → `v0.2.0`). First Release: `v0.1.0`.
- The `package.json` `version` field is decorative (private app) — never sync it; the git tag is canonical.
- Commit messages are deliberately not conventional, so the changelog is assembled from **issue titles**, never from commit subjects.

## Ticket template

```markdown
## Release: vX.Y.Z

## Closed issues since vA.B.C

- #<N> — <issue title>
- #<N> — <issue title>
```

- Title: `Cut vX.Y.Z`
- Label: `ready-for-agent`
- The issue list is the sole input for the changelog. List every issue closed since the previous Release (determine the previous Release from the [Releases page](https://github.com/mustaphaelou/deplacementapp/releases)).

## RALPH's steps

1. **Verify** each issue in the ticket body is closed (`gh issue view <N>`); if any is still open, comment on the ticket and stop.
2. **Push the tag** so the publish workflow runs:
   ```
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
   Confirm the tag points at the intended commit (the tip of `main` unless the ticket says otherwise).
3. **Wait** for the `Docker Build & Publish` workflow on the tag to succeed — it pushes the `vX.Y.Z` / `X.Y` / `latest` / sha images and creates a **draft** GitHub Release with generated notes.
4. **Rewrite the draft notes** from the ticket's issue list:
   - Open the draft Release (created by the workflow) and replace the generated body with one line per issue from the ticket, each referencing the issue number (e.g. `- #123 — <title>`).
   - Publish the Release (flip from draft).
5. **Close the ticket** with a comment noting the tag pushed, the workflow run, and the Release URL.

## Behaviors to rely on

- **Malformed tags** (`v-weird`, not SemVer): no versioned images and no GitHub Release — the `docker/metadata-action` semver patterns filter the image side and the strict `vX.Y.Z` gate (`release-check` step) blocks the Release object. Only the full-sha image is still pushed (harmless); `latest` and the versioned tags are left untouched.
- **Draft-first**: the auto-created Release is a draft, so generated-notes inaccuracies are fixed before anyone can read them.
- **Version trace**: a running image's digest → sha-tagged image → its Release answers "what's running?" in two hops. Production keeps pulling `latest`; no Coolify changes are needed for a Release.

## Example Release notes body (post-rewrite)

```markdown
### What's new in v0.1.0

- #123 — Create lib/auth/ deep module directory & consolidated session test suite
- #144 — Workflow table hygiene: explicit lane ordering, remove dead onApprove field
```
