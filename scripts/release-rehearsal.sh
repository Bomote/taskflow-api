#!/usr/bin/env bash
# Clean-clone release rehearsal.
#
# Clones a pushed commit into a temporary directory and runs every release gate there,
# so the result cannot depend on your working tree, local .env, or leftover build output.
# Writes an evidence record to paste into the GitHub Release notes.
#
#   bash scripts/release-rehearsal.sh [--commit <sha>] [--live-url <url>] [--skip docker,live] [--out <file>] [--keep]
#
#   --commit    commit to verify (default: origin/main)
#   --live-url  also smoke-test this deployment and assert it is running the verified commit
#   --skip      comma-separated groups to skip: docker, live (skipped steps are recorded as SKIPPED)
#   --out       evidence file (default: release-evidence-<sha7>.md in the current directory)
#   --keep      keep the temporary clone for inspection
#
# Needs: git, node/npm, and (unless skipped) Docker with Compose v2 and a free port 5000.
set -uo pipefail

usage() { sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; }

COMMIT=""
LIVE_URL=""
SKIP=""
OUT=""
KEEP="no"

while [ $# -gt 0 ]; do
  case "$1" in
    --commit) COMMIT="${2:-}"; shift 2 ;;
    --live-url) LIVE_URL="${2:-}"; LIVE_URL="${LIVE_URL%/}"; shift 2 ;;
    --skip) SKIP="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    --keep) KEEP="yes"; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

skipped() { case ",$SKIP," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }

ORIGIN_URL="$(git remote get-url origin 2>/dev/null)" || { echo "run this inside the repository (no 'origin' remote found)" >&2; exit 2; }
git fetch --quiet origin || { echo "could not fetch origin" >&2; exit 2; }
[ -n "$COMMIT" ] || COMMIT="origin/main"
SHA="$(git rev-parse --verify "$COMMIT^{commit}" 2>/dev/null)" || { echo "cannot resolve commit '$COMMIT'" >&2; exit 2; }
SHORT="${SHA:0:7}"
SUBJECT="$(git log -1 --format=%s "$SHA")"
OUT="${OUT:-release-evidence-$SHORT.md}"

WORKDIR="$(mktemp -d)"
REPO="$WORKDIR/repo"
mkdir -p "$WORKDIR/logs"
# Keep the MongoDB test binary between rehearsals instead of re-downloading it into each fresh clone.
export MONGOMS_DOWNLOAD_DIR="${MONGOMS_DOWNLOAD_DIR:-$HOME/.cache/taskflow-mongodb-binaries}"

NAMES=(); STATUSES=(); COMMANDS=(); DETAILS=()
LAST_STATUS=""

strip_ansi() { sed 's/\x1b\[[0-9;]*m//g'; }

record() {
  NAMES+=("$1"); STATUSES+=("$2"); COMMANDS+=("$3"); DETAILS+=("$4")
  LAST_STATUS="$2"
}

# run_step "name" "command" ["detail regex"]  (runs inside the clone)
run_step() {
  local name="$1" command="$2" pattern="${3:-}" log status detail=""
  log="$WORKDIR/logs/$(printf '%02d' "${#NAMES[@]}").log"
  echo "> $name"
  if (cd "$REPO" && RENDER_GIT_COMMIT="$SHA" bash -c "$command") > "$log" 2>&1; then
    status="PASS"
  else
    status="FAIL"
  fi
  if [ -n "$pattern" ]; then
    detail="$(strip_ansi < "$log" | grep -v '^> ' | grep -E "$pattern" | tail -3 | sed 's/|/\\|/g' || true)"
  fi
  record "$name" "$status" "$command" "$detail"
  echo "  $status"
  if [ "$status" = "FAIL" ]; then
    strip_ansi < "$log" | tail -15 | sed 's/^/    | /'
  fi
}

skip_step() { # skip_step "name" "reason"
  record "$1" "SKIPPED" "-" "$2"
  echo "> $1"
  echo "  SKIPPED ($2)"
}

finish() {
  local overall="PASS" incomplete="" i
  for i in "${!NAMES[@]}"; do
    [ "${STATUSES[$i]}" = "FAIL" ] && overall="FAIL"
    [ "${STATUSES[$i]}" = "SKIPPED" ] && incomplete="$incomplete ${NAMES[$i]};"
  done

  {
    echo "# Release verification: ${SHORT}"
    echo
    echo "- **Commit:** \`${SHA}\` (${SUBJECT})"
    echo "- **Repository:** ${ORIGIN_URL}"
    echo "- **Verified (UTC):** $(date -u '+%Y-%m-%d %H:%M:%S')"
    echo "- **Environment:** Node $(node -v), npm $(npm -v), $(uname -s)"
    echo "- **Method:** fresh clone of the pushed commit in a temporary directory (\`scripts/release-rehearsal.sh\`)"
    echo "- **Deployment checked:** ${LIVE_URL:-not checked}"
    echo
    echo "## Results"
    echo
    echo "| Step | Result | Detail |"
    echo "|---|---|---|"
    for i in "${!NAMES[@]}"; do
      local detail="${DETAILS[$i]//$'\n'/<br>}"
      echo "| ${NAMES[$i]} | ${STATUSES[$i]} | ${detail} |"
    done
    echo
    echo "## Commands"
    echo
    echo '```text'
    for i in "${!NAMES[@]}"; do
      [ "${COMMANDS[$i]}" = "-" ] || echo "${NAMES[$i]}: ${COMMANDS[$i]}"
    done
    echo '```'
    echo
    if [ -n "$incomplete" ]; then
      echo "## Overall: ${overall} (INCOMPLETE, skipped:${incomplete})"
    else
      echo "## Overall: ${overall}"
    fi
  } > "$OUT"

  echo
  echo "Evidence written to: $OUT"
  echo "Overall: $overall${incomplete:+ (INCOMPLETE, skipped:$incomplete)}"

  if [ "$KEEP" = "yes" ]; then
    echo "Clone kept at: $REPO"
  else
    rm -rf "$WORKDIR" 2> /dev/null || true
  fi
  [ "$overall" = "PASS" ] && exit 0
  exit 1
}

echo "Verifying ${SHORT} (${SUBJECT})"

# ---- 1. fresh clone ----
echo "> Fresh clone of the pushed commit"
if git clone --quiet "$ORIGIN_URL" "$REPO" > "$WORKDIR/logs/clone.log" 2>&1 && (cd "$REPO" && git checkout --quiet "$SHA") >> "$WORKDIR/logs/clone.log" 2>&1; then
  record "Fresh clone of the pushed commit" "PASS" "git clone <origin> && git checkout $SHORT" "HEAD is ${SHA}"
  echo "  PASS"
else
  record "Fresh clone of the pushed commit" "FAIL" "git clone <origin> && git checkout $SHORT" "$(tail -3 "$WORKDIR/logs/clone.log")"
  echo "  FAIL"
  finish
fi

run_step "Commit is on origin/main" "git branch -r --contains $SHA | grep -q 'origin/main' && echo 'commit is reachable from origin/main'" "commit is"

# ---- 2. install ----
run_step "Install dependencies" "npm ci" "added|up to date"
[ "$LAST_STATUS" = "FAIL" ] && finish

# ---- 3. static and automated checks ----
run_step "Production dependency audit" "npm audit --omit=dev --audit-level=high" "vulnerabilit"
run_step "Typecheck" "npm run typecheck" "error|tsc"
run_step "Unit and integration tests" "npm test" "Tests:|Test Suites:"
run_step "Build" "npm run build" "tsc|error"
run_step "Inspect dist (no tests, seed or declaration files)" \
  "test -d dist && echo \"dist files: \$(find dist -type f | wc -l)\" && ! find dist \\( -name '*.test.*' -o -name '*.spec.*' -o -name 'seed*' -o -name '*.d.ts' \\) | grep -q ." \
  "dist files"
run_step "Compiled-app end-to-end tests (graceful shutdown)" "npm run test:e2e" "Tests:|skipped"
run_step "OpenAPI validation" "npm run openapi:validate" "OpenAPI"

# ---- 4. Docker ----
if skipped docker; then
  skip_step "Docker rehearsal" "skipped by request"
else
  run_step "Docker: port 5000 is free" \
    "if curl -s -o /dev/null --max-time 2 http://localhost:5000/; then echo 'something is already listening on port 5000; stop it first'; exit 1; else echo 'port 5000 is free'; fi" \
    "port 5000|listening"
  if [ "$LAST_STATUS" = "PASS" ]; then
    run_step "Docker: build image and start with a disposable MongoDB" "docker compose up --build --detach --wait --wait-timeout 180" "Healthy|Built|Error|error"
    if [ "$LAST_STATUS" = "PASS" ]; then
      run_step "Docker: verify runtime image" "bash scripts/verify-docker-image.sh static" "ok|FAIL"
      run_step "Docker: smoke test the container (asserts commit)" \
        "npm run smoke -- --env-var baseUrl=http://localhost:5000 --env-var expectedCommit=\$RENDER_GIT_COMMIT" "requests|assertions"
      run_step "Docker: verify graceful shutdown" "bash scripts/verify-docker-image.sh shutdown" "ok|FAIL"
    else
      skip_step "Docker: remaining checks" "the stack did not start"
    fi
    run_step "Docker: tear down" "docker compose down --volumes" "Removed|Error"
  else
    skip_step "Docker: remaining checks" "port 5000 is in use"
  fi
fi

# ---- 5. deployed environment ----
if skipped live || [ -z "$LIVE_URL" ]; then
  skip_step "Smoke test of the deployment" "no --live-url given or skipped by request"
else
  run_step "Smoke test of the deployment (asserts it runs this commit)" \
    "npm run smoke -- --env-var baseUrl=$LIVE_URL --env-var expectedCommit=$SHA" "requests|assertions|deployed commit"
fi

# ---- 6. repository state ----
run_step "Clone working tree is clean after all steps" "test -z \"\$(git status --porcelain)\" && echo 'git status: clean'" "git status"

finish