#!/usr/bin/env bash
set -euo pipefail

# test-docker-build.sh — local convenience wrapper for the smoke-test module.
#
# Builds the runner and migrator images, then hands them to the shared
# smoke-test module (scripts/smoke-test.sh). One command for a developer:
#   scripts/test-docker-build.sh
# exits 0 iff the deployment set (runner + migrator) is runnable.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; }
info()  { echo -e "${YELLOW}[INFO]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="deplacementapp:test"
MIGRATOR_IMAGE="deplacementapp-migrator:test"

if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not in PATH"
  exit 1
fi

# ------------------------------------------------------------------
# 1. Build the images
# ------------------------------------------------------------------
info "Building runner image..."
docker build --target runner --tag "$IMAGE_NAME" "$PROJECT_DIR"
pass "Runner image built"

info "Building migrator image..."
docker build --target migrator --tag "$MIGRATOR_IMAGE" "$PROJECT_DIR"
pass "Migrator image built"

# ------------------------------------------------------------------
# 2. Verify production dependency tree
# ------------------------------------------------------------------
info "Verifying production dependency tree..."
if ! (cd "$PROJECT_DIR" && npm ls --omit=dev --depth=0) >/dev/null 2>&1; then
  fail "Production dependency tree has issues"
  (cd "$PROJECT_DIR" && npm ls --omit=dev --depth=0) 2>&1 || true
  exit 1
fi
pass "Production dependency tree is clean"

# ------------------------------------------------------------------
# 3. Run the shared smoke-test module
# ------------------------------------------------------------------
info "Running smoke-test module..."
"$SCRIPT_DIR/smoke-test.sh" --image "$IMAGE_NAME" --migrator-image "$MIGRATOR_IMAGE"
