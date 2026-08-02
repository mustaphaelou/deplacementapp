#!/usr/bin/env bash
set -euo pipefail

# deploy-coolify.sh — fire the Coolify deploy webhook with an exit-code contract.
#
# Contract: exits 0 iff the deploy webhook accepts the request (HTTP 2xx) or
# --dry-run was given. Any other outcome — non-2xx response, network error, or
# a missing COOLIFY_WEBHOOK / COOLIFY_TOKEN — exits non-zero with a diagnostic
# naming the cause. The module never echoes the COOLIFY_WEBHOOK or COOLIFY_TOKEN
# values; dry-run and error output name only the endpoint host shape.
#
# Usage:
#   COOLIFY_WEBHOOK=... COOLIFY_TOKEN=... scripts/deploy-coolify.sh [--dry-run] [--ref <ref>]
#
# The module runs unchanged on a developer machine and on a GitHub Actions
# runner. In CI the secrets are passed through by name; locally they come from
# the environment. Success means Coolify accepted/queued the deployment — the
# workflow does not poll deployment status.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

DRY_RUN=false
REF="${GITHUB_REF_NAME:-unknown}"

usage() {
  echo "Usage: $0 [--dry-run] [--ref <ref>]" >&2
  echo "Requires COOLIFY_WEBHOOK and COOLIFY_TOKEN in the environment (never printed)." >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --ref)
      REF="${2:-}"
      if [ -z "$REF" ]; then usage; fi
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

# Print only the scheme://host of the webhook — the URL path may embed a token.
endpoint_shape() {
  if [[ "$COOLIFY_WEBHOOK" =~ ^(https?)://([^/]+) ]]; then
    echo "${BASH_REMATCH[1]}://${BASH_REMATCH[2]}"
  else
    echo "the configured webhook endpoint"
  fi
}

# Prerequisites — named, never their values.
if [ -z "${COOLIFY_WEBHOOK:-}" ]; then
  fail "COOLIFY_WEBHOOK is not set (cannot fire the deploy webhook)"
  exit 1
fi
if [ -z "${COOLIFY_TOKEN:-}" ]; then
  fail "COOLIFY_TOKEN is not set (cannot authenticate the deploy webhook)"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  info "Dry run: would fire the Coolify deploy webhook at $(endpoint_shape) for ref '$REF'"
  info "No request was sent; COOLIFY_WEBHOOK and COOLIFY_TOKEN values were not printed."
  pass "Deploy dry run (exit 0)"
  exit 0
fi

info "Firing Coolify deploy webhook at $(endpoint_shape) for ref '$REF'..."
HTTP_CODE=$(curl --silent --show-error --output /dev/null \
  --request GET "$COOLIFY_WEBHOOK" \
  --header "Authorization: Bearer $COOLIFY_TOKEN" \
  --write-out "%{http_code}") || {
  fail "Deploy webhook request failed (network error to $(endpoint_shape))"
  exit 1
}

if [[ "$HTTP_CODE" =~ ^2[0-9][0-9]$ ]]; then
  pass "Deploy webhook accepted the deploy (HTTP $HTTP_CODE)"
  exit 0
else
  fail "Deploy webhook returned HTTP $HTTP_CODE (expected 2xx)"
  exit 1
fi
