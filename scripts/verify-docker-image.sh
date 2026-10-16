#!/usr/bin/env bash
# Verifies the running container started by `docker compose up` (service name: api).
#   bash scripts/verify-docker-image.sh static     non-root, no source/tests, healthy, endpoints
#   bash scripts/verify-docker-image.sh shutdown   graceful stop: exit code 0 and clean logs
set -euo pipefail

SERVICE="api"
BASE_URL="${BASE_URL:-http://localhost:5000}"

fail() {
  echo "  FAIL $1" >&2
  exit 1
}

# check "description" command [args...]  -> prints ok, or fails the whole script
check() {
  local description="$1"
  shift
  if "$@"; then
    echo "  ok   $description"
  else
    fail "$description"
  fi
}

container_id() {
  local id
  id="$(docker compose ps --all --quiet "$SERVICE")"
  [ -n "$id" ] || fail "no container found for service '$SERVICE' (is the stack up?)"
  echo "$id"
}

static_checks() {
  local cid uid leftovers status="starting"
  cid="$(container_id)"
  echo "Runtime image checks ($cid)"

  uid="$(docker exec "$cid" id -u)"
  check "runs as non-root (uid $uid)" test "$uid" != "0"

  check "no src directory" docker exec "$cid" sh -c 'test ! -e /app/src'
  check "no tsconfig.json" docker exec "$cid" sh -c 'test ! -e /app/tsconfig.json'

  leftovers="$(docker exec "$cid" sh -c 'find /app -path /app/node_modules -prune -o \( -name "*.test.*" -o -name "*.spec.*" -o -name "seed*" -o -name "*.d.ts" \) -print')"
  if [ -n "$leftovers" ]; then
    fail "unexpected files in the image: $leftovers"
  fi
  echo "  ok   no test, seed or declaration files"

  check "no development dependencies installed" \
    docker exec "$cid" sh -c 'test ! -e /app/node_modules/typescript && test ! -e /app/node_modules/jest'

  for _ in $(seq 1 30); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$cid")"
    [ "$status" = "healthy" ] && break
    sleep 2
  done
  check "Docker HEALTHCHECK reports healthy (status: $status)" test "$status" = "healthy"

  check "GET /health/live" curl -fsS "$BASE_URL/health/live" -o /dev/null
  check "GET /health/ready" curl -fsS "$BASE_URL/health/ready" -o /dev/null
}

shutdown_check() {
  local cid code logs
  cid="$(container_id)"
  echo "Graceful shutdown check ($cid)"

  docker compose stop --timeout 30 "$SERVICE" > /dev/null
  code="$(docker inspect --format '{{.State.ExitCode}}' "$cid")"
  check "exited with code 0 after SIGTERM (exit code: $code)" test "$code" = "0"

  logs="$(docker logs "$cid" 2>&1)"
  check "log: SIGTERM received" grep -q "SIGTERM received" <<< "$logs"
  check "log: database connection closed" grep -q "Database connection closed." <<< "$logs"
  check "log: shutdown complete" grep -q "Shutdown complete." <<< "$logs"
}

case "${1:-}" in
  static) static_checks ;;
  shutdown) shutdown_check ;;
  *)
    echo "usage: $0 static|shutdown" >&2
    exit 2
    ;;
esac