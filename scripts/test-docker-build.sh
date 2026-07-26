#!/usr/bin/env bash
set -euo pipefail

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
CONTAINER_NAME="deplacementapp-test"
DB_CONTAINER_NAME="deplacementapp-test-db"
NETWORK_NAME="deplacementapp-test-net"
HOST_PORT=3000
# Docker HEALTHCHECK has --start-period=30s, so 30s min before first check
HEALTH_TIMEOUT=45
DB_TIMEOUT=30
SIZE_LIMIT_MB=800

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

# ------------------------------------------------------------------
# 0. Create isolated Docker network
# ------------------------------------------------------------------
info "Creating test network..."
docker network create "$NETWORK_NAME"
pass "Test network created"

# ------------------------------------------------------------------
# 1. Build the runner image
# ------------------------------------------------------------------
info "Building runner image..."
docker build --target runner --tag "$IMAGE_NAME" "$PROJECT_DIR"
pass "Docker build succeeded"

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
# 3. Start test PostgreSQL container
# ------------------------------------------------------------------
info "Starting test database..."
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
  if docker exec "$DB_CONTAINER_NAME" pg_isready -U test -d testdb >/dev/null 2>&1; then
    ELAPSED=$(( $(date +%s) - START_TIME ))
    pass "Database ready (${ELAPSED}s)"
    break
  fi
  ELAPSED=$(( $(date +%s) - START_TIME ))
  if [ "$ELAPSED" -ge "$DB_TIMEOUT" ]; then
    fail "Database did not become ready within ${DB_TIMEOUT}s"
    exit 1
  fi
  sleep 1
done

# ------------------------------------------------------------------
# 4. Start app container connected to the test database
# ------------------------------------------------------------------
info "Starting app container..."
docker run --rm -d \
  -p "$HOST_PORT:3000" \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  -e DATABASE_URL="postgresql://test:test@${DB_CONTAINER_NAME}:5432/testdb" \
  -e NEXTAUTH_SECRET="test-secret-not-for-production" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e AUTH_TRUST_HOST=true \
  "$IMAGE_NAME"
pass "App container started on port $HOST_PORT"

# ------------------------------------------------------------------
# 5. Wait for HEALTHCHECK
# ------------------------------------------------------------------
info "Waiting for HEALTHCHECK (up to ${HEALTH_TIMEOUT}s)..."
START_TIME=$(date +%s)
while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ "$ELAPSED" -ge "$HEALTH_TIMEOUT" ]; then
    info "Container logs (last 20 lines):"
    docker logs "$CONTAINER_NAME" --tail 20 2>&1 || true
    fail "HEALTHCHECK did not become healthy within ${HEALTH_TIMEOUT}s"
    exit 1
  fi

  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "starting")

  if [ "$STATUS" = "healthy" ]; then
    pass "HEALTHCHECK passed (${ELAPSED}s)"
    break
  elif [ "$STATUS" = "unhealthy" ]; then
    info "Container logs (last 20 lines):"
    docker logs "$CONTAINER_NAME" --tail 20 2>&1 || true
    fail "HEALTHCHECK failed (unhealthy)"
    exit 1
  fi

  sleep 2
done

# ------------------------------------------------------------------
# 6. Hit the health endpoint from the host
# ------------------------------------------------------------------
info "Hitting health endpoint..."
if ! curl -sf "http://localhost:$HOST_PORT/api/health" >/dev/null 2>&1; then
  fail "Health endpoint returned non-200"
  exit 1
fi
pass "Health endpoint responded OK"

# ------------------------------------------------------------------
# 7. Verify container is still running
# ------------------------------------------------------------------
RUNNING=$(docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" --format '{{.Names}}' 2>/dev/null || echo "")
if [ -z "$RUNNING" ]; then
  fail "Container is no longer running"
  exit 1
fi
pass "Container remains running after health check"

# ------------------------------------------------------------------
# 8. Verify production dependency tree
# ------------------------------------------------------------------
info "Verifying production dependency tree..."
if ! (cd "$PROJECT_DIR" && npm ls --omit=dev --depth=0) >/dev/null 2>&1; then
  fail "Production dependency tree has issues"
  (cd "$PROJECT_DIR" && npm ls --omit=dev --depth=0) 2>&1 || true
  exit 1
fi
pass "Production dependency tree is clean"

# ------------------------------------------------------------------
# All checks passed
# ------------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All smoke tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"
