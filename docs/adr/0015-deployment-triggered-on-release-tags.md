# ADR 0015: Deployment is triggered by the pipeline on Release tags

**Date:** 2026-08-02

**Status:** Accepted

## Context

ADR-0004 decided the build lives in CI and deployment pulls from GHCR — but explicitly not *who pulls*. Before this ADR, the publish workflow's last act was a push to GHCR; nothing told Coolify a new image existed. `latest` is a rolling alias of `main`, so production silently tracked whatever the last main push published. A Release produced images, a draft GitHub Release, and a changelog — but had **zero effect on production**: the Release ritual was artifact work, not a deployment.

## Decision

The publish workflow owns "deploy to production": a separate `deploy` job fires the Coolify deploy webhook, and only on Release tags. A Release push now means "verify → publish → deploy" completes in one workflow with one success definition, and the exact digest of the Release is queued to serve production.

## Details

- **Who pulls:** the pipeline fires the Coolify deploy webhook after the multi-arch push completes, so `latest` already equals the Release digest when Coolify pulls. No Coolify-side configuration change — the app keeps pulling `latest`.
- **Trigger scope:** the `deploy` job depends on `build-and-publish` (verify transitively covered) and runs only when that job's `is_release` output — from the `release-gate` step, the single owner of release-ness — is `true`. Branch pushes, pull requests, and tag-less dispatches deploy nothing. A `workflow_dispatch` run with the `deploy-dry-run` input exercises the job in dry-run mode without firing.
- **Mechanism:** the reusable `scripts/deploy-coolify.sh` module reads `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN` from the environment, fires the webhook with a Bearer token, and exits 0 iff the response is HTTP 2xx. The module never prints the secret values; dry-run prints the endpoint host shape and the ref and exits 0 without a request.
- **Success = deployment queued:** HTTP 2xx means Coolify accepted/queued the deployment. The workflow does not poll deployment status; the running app's health remains a Coolify-side observation.
- **Failure:** a non-2xx response, a network error, or a missing secret fails the deploy job loudly with a diagnostic naming the cause (never the secret). No auto-retry inside the workflow; the deploy job is one-click re-runnable from the GitHub UI (that is the retry).
- **Trust precondition:** the C1 publish gate (unit checks + smoke test before any push) means nothing reaches GHCR unverified, which is what makes Release-triggered auto-deploy defensible; the release-gate step makes "Release" a single-owned concept for the deploy condition.

## Consequences

- Production moves only on deliberate Releases. Between Releases, production stays on the last deployed Release; a hand-pull of `latest` in Coolify is possible and documented as the escape hatch, not the normal path.
- A green Release run means production is queued to serve that Release; a red Release run (non-2xx or missing secret) means it was not.
- `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN` become required repository secrets for auto-deploy, referenced by name only.
- The running image's digest is traceable to the Release that deployed it: digest → sha-tagged image → Release → deploy.
- Extends ADR-0004 (which remains unchanged).
