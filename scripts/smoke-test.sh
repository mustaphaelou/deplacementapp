#!/usr/bin/env bash
set -euo pipefail

# smoke-test.sh — reusable image verification with an exit-code contract.
#
# Contract: exits 0 iff the deployment set is runnable — a scratch Postgres
# starts, the runner image passes its HEALTHCHECK, /api/health answers 200,
# and (when --migrator-image is given) the migrator runs against the scratch
# database and exits 0. Any failure exits non-zero, with a diagnostic tail of
# container logs where available.
#
# Usage:
#   scripts/smoke-test.sh --image <runner-tag> [--migrator-image <migrator-tag>]
#
# The module owns all topology knowledge (database container, healthcheck wait
# loops, network isolation) and runs unchanged on a developer machine and on a
# GitHub Actions runner. It never builds an image — callers load a prebuilt
# image (docker build --load / pull) and pass its tag.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

dump_container_logs() {
  local name="$1" label="${2:-Container}"
  info "$label logs (last 20 lines):"
  docker logs "$name" --tail 20 2>&1 || true
}

# ------------------------------------------------------------------
# Constants — all topology knowledge lives here
# ------------------------------------------------------------------
CONTAINER_NAME="deplacementapp-smoke-runner"
DB_CONTAINER_NAME="deplacementapp-smoke-db"
MIGRATOR_CONTAINER_NAME="deplacementapp-smoke-migrator"
NETWORK_NAME="deplacementapp-smoke-net"
HOST_PORT="${SMOKE_HOST_PORT:-3000}"
# Docker HEALTHCHECK has --start-period=30s, so 30s min before first check
HEALTH_TIMEOUT="${SMOKE_HEALTH_TIMEOUT:-45}"
DB_TIMEOUT="${SMOKE_DB_TIMEOUT:-30}"
SIZE_LIMIT_MB="${SMOKE_SIZE_LIMIT_MB:-800}"

IMAGE_NAME=""
MIGRATOR_IMAGE=""

usage() {
  echo "Usage: $0 --image <runner-tag> [--migrator-image <migrator-tag>]" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --image)
      IMAGE_NAME="${2:-}"
      if [ -z "$IMAGE_NAME" ]; then usage; fi
      shift 2
      ;;
    --migrator-image)
      MIGRATOR_IMAGE="${2:-}"
      if [ -z "$MIGRATOR_IMAGE" ]; then usage; fi
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

[ -n "$IMAGE_NAME" ] || usage

cleanup() {
  info "Cleaning up..."
  if docker ps --filter "name=$CONTAINER_NAME" --format '{{.Names}}' 2>/dev/null | grep -qFx "$CONTAINER_NAME"; then
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    info "App container stopped"
  fi
  if docker ps --filter "name=$DB_CONTAINER_NAME" --format '{{.Names}}' 2>/dev/null | grep -qFx "$DB_CONTAINER_NAME"; then
    docker stop "$DB_CONTAINER_NAME" >/dev/null 2>&1 || true
    info "Database container stopped"
  fi
  if docker network ls --filter "name=$NETWORK_NAME" --format '{{.Name}}' 2>/dev/null | grep -qFx "$NETWORK_NAME"; then
    docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || true
    info "Test network removed"
  fi
}

trap cleanup EXIT

# ------------------------------------------------------------------
# Prerequisite check
# ------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not in PATH"
  exit 1
fi
if ! command -v curl &>/dev/null; then
  fail "Curl is not installed or not in PATH"
  exit 1
fi

# ------------------------------------------------------------------
# 1. Create isolated Docker network
# ------------------------------------------------------------------
info "Creating test network..."
docker network create "$NETWORK_NAME"
pass "Test network created"

# ------------------------------------------------------------------
# 2. Check image size
# ------------------------------------------------------------------
info "Checking image size..."
SIZE_BYTES=$(docker inspect "$IMAGE_NAME" --format '{{.Size}}')
SIZE_MB=$((SIZE_BYTES / 1024 / 1024))
SIZE_HUMAN=$(docker images "$IMAGE_NAME" --format '{{.Size}}')
info "Image size: $SIZE_HUMAN ($SIZE_MB MB)"

if [ "$SIZE_MB" -gt "$SIZE_LIMIT_MB" ]; then
  fail "Image size ${SIZE_MB}MB exceeds limit of ${SIZE_LIMIT_MB}MB"
  exit 1
fi
pass "Image size ${SIZE_MB}MB is within ${SIZE_LIMIT_MB}MB limit"

# ------------------------------------------------------------------
# 3. Start scratch PostgreSQL container
# ------------------------------------------------------------------
info "Starting scratch database..."
docker run --rm -d \
  --name "$DB_CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=testdb \
  postgres:16-alpine
pass "Database container started"

info "Waiting for database to be ready..."
START_TIME=$(date +%s)
while true; do
  ELAPSED=$(( $(date +%s) - START_TIME ))
  if docker exec "$DB_CONTAINER_NAME" pg_isready -U test -d testdb >/dev/null 2>&1; then
    pass "Database ready (${ELAPSED}s)"
    break
  fi
  if [ "$ELAPSED" -ge "$DB_TIMEOUT" ]; then
    fail "Database did not become ready within ${DB_TIMEOUT}s"
    exit 1
  fi
  sleep 1
done

# ------------------------------------------------------------------
# 4. Run the migrator against the scratch database (when requested)
# ------------------------------------------------------------------
if [ -n "$MIGRATOR_IMAGE" ]; then
  info "Running migrator image $MIGRATOR_IMAGE against scratch database..."
  if ! docker run --rm \
    --name "$MIGRATOR_CONTAINER_NAME" \
    --network "$NETWORK_NAME" \
    -e "DATABASE_URL=postgresql://test:test@${DB_CONTAINER_NAME}:5432/testdb" \
    "$MIGRATOR_IMAGE"; then
    dump_container_logs "$MIGRATOR_CONTAINER_NAME" "Migrator"
    fail "Migrator exited non-zero"
    exit 1
  fi
  pass "Migrator exited 0"
fi

# ------------------------------------------------------------------
# 5. Start runner container connected to the test database
# ------------------------------------------------------------------
info "Starting runner container..."
docker run --rm -d \
  -p "$HOST_PORT:3000" \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  -e "DATABASE_URL=postgresql://test:test@${DB_CONTAINER_NAME}:5432/testdb" \
  -e NEXTAUTH_SECRET="test-secret-not-for-production" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e AUTH_TRUST_HOST=true \
  "$IMAGE_NAME"
pass "Runner container started on port $HOST_PORT"

# ------------------------------------------------------------------
# 6. Wait for HEALTHCHECK
# ------------------------------------------------------------------
info "Waiting for HEALTHCHECK (up to ${HEALTH_TIMEOUT}s)..."
START_TIME=$(date +%s)
while true; do
  ELAPSED=$(( $(date +%s) - START_TIME ))

  if [ "$ELAPSED" -ge "$HEALTH_TIMEOUT" ]; then
    dump_container_logs "$CONTAINER_NAME"
    fail "HEALTHCHECK did not become healthy within ${HEALTH_TIMEOUT}s"
    exit 1
  fi

  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "starting")

  if [ "$STATUS" = "healthy" ]; then
    pass "HEALTHCHECK passed (${ELAPSED}s)"
    break
  elif [ "$STATUS" = "unhealthy" ]; then
    dump_container_logs "$CONTAINER_NAME"
    fail "HEALTHCHECK failed (unhealthy)"
    exit 1
  fi

  sleep 2
done

# ------------------------------------------------------------------
# 7. Hit the health endpoint from the host
# ------------------------------------------------------------------
info "Hitting health endpoint..."
if ! curl -sf "http://localhost:$HOST_PORT/api/health" >/dev/null 2>&1; then
  fail "Health endpoint returned non-200"
  exit 1
fi
pass "Health endpoint responded OK"

# ------------------------------------------------------------------
# 8. Verify runner container is still running
# ------------------------------------------------------------------
RUNNING=$(docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" --format '{{.Names}}' 2>/dev/null || echo "")
if [ -z "$RUNNING" ]; then
  fail "Container is no longer running"
  exit 1
fi
pass "Container remains running after health check"

# ------------------------------------------------------------------
# All checks passed
# ------------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All smoke tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"
