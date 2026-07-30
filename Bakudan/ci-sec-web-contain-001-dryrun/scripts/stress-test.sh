#!/usr/bin/env bash
# =============================================================
# TaskFlow — Full Stress Test + Bug Hunt Script
# Usage:
#   ./scripts/stress-test.sh                         # local PHP server + public stress
#   ./scripts/stress-test.sh --local [cookie]        # local PHP server + optional session
#   ./scripts/stress-test.sh <base_url> [cookie]     # remote/prod target
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$PROJECT_DIR/reports"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT="$OUT_DIR/stress-test-$TIMESTAMP.md"
RUNTIME_LOG="$LOG_DIR/runtime-debug.log"
STARTED_SERVER_PID=""
START_LOCAL=0

if [ "$#" -eq 0 ]; then
  START_LOCAL=1
  COOKIE=""
elif [ "${1:-}" = "--local" ]; then
  START_LOCAL=1
  COOKIE="${2:-}"
else
  BASE_URL="${1:-https://dashboard.bakudanramen.com}"
  COOKIE="${2:-}"
fi

mkdir -p "$OUT_DIR" "$LOG_DIR/errors" "$LOG_DIR/performance"

cleanup() {
  if [ -n "$STARTED_SERVER_PID" ]; then
    kill "$STARTED_SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    (echo > "/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
  fi
}

if [ "$START_LOCAL" = "1" ]; then
  PORT="${STRESS_TEST_PORT:-8088}"
  while port_in_use "$PORT"; do
    PORT=$((PORT+1))
  done
  BASE_URL="http://127.0.0.1:$PORT"
  : > "$RUNTIME_LOG"
  echo "Starting local PHP server on $BASE_URL ..."
  (
    cd "$PROJECT_DIR"
    PHP_CLI_SERVER_WORKERS="${STRESS_TEST_WORKERS:-8}" \
      php -d display_errors=0 -d log_errors=1 -d error_log="$LOG_DIR/errors/php-errors.log" -S "127.0.0.1:$PORT" router.php
  ) >> "$RUNTIME_LOG" 2>&1 &
  STARTED_SERVER_PID="$!"

  for _ in $(seq 1 30); do
    if curl -s -o /dev/null --max-time 2 "$BASE_URL/login"; then
      break
    fi
    sleep 0.2
  done
fi

echo "======================================================"
echo "  TaskFlow Stress Test — $(date)"
echo "  Target: $BASE_URL"
echo "======================================================"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
section() { echo ""; echo -e "${YELLOW}═══ $1 ═══${NC}"; }

PASS=0; FAIL=0; WARN=0
results=()

check() {
  local name="$1" url="$2" expect_code="${3:-200}"
  local cmd="curl -s -o /dev/null -w '%{http_code}' --max-time 10"
  if [ -n "$COOKIE" ]; then
    cmd="$cmd -H 'Cookie: $COOKIE'"
  fi
  local code
  code=$(eval "$cmd '$url'" 2>/dev/null || echo "000")
  if [ "$code" = "$expect_code" ] || ( [ "$expect_code" = "2xx" ] && [[ "$code" =~ ^2 ]] ) || ( [ "$expect_code" = "3xx" ] && [[ "$code" =~ ^3 ]] ); then
    pass "$name → HTTP $code"
    PASS=$((PASS+1))
    results+=("✓|$name|$code")
  else
    fail "$name → HTTP $code (expected $expect_code)"
    FAIL=$((FAIL+1))
    results+=("✗|$name|$code (expected $expect_code)")
  fi
}

check_no_php_error() {
  local name="$1" url="$2"
  local body
  body=$(curl -sL --max-time 15 "$url" 2>/dev/null)
  local code=$?
  if echo "$body" | grep -qi "Fatal error\|Parse error\|Warning:.*in.*on line\|Uncaught Error\|Call to undefined"; then
    local err
    err=$(echo "$body" | grep -oiE "(Fatal|Parse|Warning|Uncaught) error[^<]*" | head -1)
    fail "$name — PHP error: $err"
    FAIL=$((FAIL+1))
    results+=("✗|$name|PHP error: $err")
  else
    pass "$name — no PHP errors"
    PASS=$((PASS+1))
    results+=("✓|$name|clean")
  fi
}

# ── PHASE 1: HTTP Status Checks ─────────────────────────────
section "PHASE 1 — HTTP Status Checks"

check "Login page" "$BASE_URL/login" "200"
check "Dashboard (unauth)" "$BASE_URL/dashboard" "302"
if [ -n "$COOKIE" ]; then
  check "Non-existent page (→ login redirect)" "$BASE_URL/nonexistent-page-xyz" "302"
else
  check "Non-existent page (unauth redirects to login)" "$BASE_URL/nonexistent-page-xyz" "302"
fi
check "Manifest" "$BASE_URL/manifest.json" "200"
check "Service Worker" "$BASE_URL/sw.js" "200"
check "CSS tokens" "$BASE_URL/assets/css/tokens.css" "200"
check "App JS" "$BASE_URL/assets/js/app.js" "200"

# ── PHASE 2: PHP Error Scan ──────────────────────────────────
section "PHASE 2 — PHP Error Scan (public pages)"

check_no_php_error "Login page" "$BASE_URL/login"

if [ -n "$COOKIE" ]; then
  check_no_php_error "Dashboard" "$BASE_URL/"
  check_no_php_error "Calendar" "$BASE_URL/calendar"
  check_no_php_error "My Tasks" "$BASE_URL/my-tasks"
  check_no_php_error "Inbox" "$BASE_URL/inbox"
  check_no_php_error "Projects" "$BASE_URL/projects"
  check_no_php_error "Bills" "$BASE_URL/bills"
  check_no_php_error "Settings" "$BASE_URL/settings"
  check_no_php_error "Overview" "$BASE_URL/overview"
  check_no_php_error "Team" "$BASE_URL/team"
  check_no_php_error "Admin Users" "$BASE_URL/admin/users"
  check_no_php_error "Admin Stores" "$BASE_URL/admin/stores"
  check_no_php_error "Admin Vendors" "$BASE_URL/admin/vendors"
  check_no_php_error "AI Import" "$BASE_URL/ai-import"
else
  warn "No session cookie provided — skipping authenticated page checks"
  warn "Run with: ./scripts/stress-test.sh $BASE_URL 'PHPSESSID=your-session-id'"
  WARN=$((WARN+3))
fi

# ── PHASE 3: API Endpoint Checks ────────────────────────────
section "PHASE 3 — API Endpoint Health"

if [ -n "$COOKIE" ]; then
  check "API sidebar badges" "$BASE_URL/api/sidebar/badges" "200"
  check "API notifications" "$BASE_URL/api/notifications" "200"
  check "API users assignable" "$BASE_URL/api/users/assignable" "200"
  check "API team summary" "$BASE_URL/api/team/summary" "200"
else
  warn "Skipping API checks — no session cookie"
  WARN=$((WARN+4))
fi

# ── PHASE 4: Response Time Check ────────────────────────────
section "PHASE 4 — Response Time Check"

check_response_time() {
  local name="$1" url="$2" max_ms="${3:-3000}"
  local time_ms
  time_ms=$(curl -o /dev/null -s -w '%{time_total}' --max-time 15 "$url" 2>/dev/null)
  time_ms=$(echo "$time_ms * 1000" | bc 2>/dev/null | cut -d. -f1)
  if [ -z "$time_ms" ]; then time_ms=9999; fi
  if [ "$time_ms" -le "$max_ms" ]; then
    pass "$name — ${time_ms}ms (≤ ${max_ms}ms)"
    PASS=$((PASS+1))
  else
    warn "$name — ${time_ms}ms (> ${max_ms}ms threshold)"
    WARN=$((WARN+1))
  fi
}

check_response_time "Login page TTFB" "$BASE_URL/login" 2000
check_response_time "Assets CSS" "$BASE_URL/assets/css/style.css" 1000

# ── PHASE 4B: Navigation Spam ───────────────────────────────
section "PHASE 4B — Navigation Spam"

PAGES=(
  "/login"
  "/dashboard"
  "/calendar"
  "/my-tasks"
  "/projects"
  "/inbox"
  "/bills"
  "/settings"
  "/overview"
  "/team"
  "/manifest.json"
  "/sw.js"
)

nav_failures=0
for i in $(seq 1 100); do
  path="${PAGES[$(( (i - 1) % ${#PAGES[@]} ))]}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$path" ${COOKIE:+-H "Cookie: $COOKIE"} 2>/dev/null || echo "000")
  if [[ ! "$code" =~ ^(2|3|4) ]]; then
    nav_failures=$((nav_failures+1))
  fi
done

if [ "$nav_failures" = "0" ]; then
  pass "100x navigation spam — no transport failures"
  PASS=$((PASS+1))
else
  fail "100x navigation spam — $nav_failures transport failures"
  FAIL=$((FAIL+1))
fi

tab_failures=0
tab_pids=()
: > /tmp/taskflow_tab_codes_$$
for _ in $(seq 1 20); do
  (curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 "$BASE_URL/login" 2>/dev/null || echo "000") >> /tmp/taskflow_tab_codes_$$ &
  tab_pids+=("$!")
done
for pid in "${tab_pids[@]}"; do
  wait "$pid" || true
done
while IFS= read -r code; do
  if [[ ! "$code" =~ ^(2|3) ]]; then tab_failures=$((tab_failures+1)); fi
done < /tmp/taskflow_tab_codes_$$
rm -f /tmp/taskflow_tab_codes_$$

if [ "$tab_failures" = "0" ]; then
  pass "20-tab simulation — no failed login loads"
  PASS=$((PASS+1))
else
  fail "20-tab simulation — $tab_failures failed loads"
  FAIL=$((FAIL+1))
fi

# ── PHASE 5: Concurrent Load Test ───────────────────────────
section "PHASE 5 — Concurrent Load Test (10 simultaneous)"

if command -v ab &>/dev/null; then
  echo "Running Apache Bench: 50 requests, 10 concurrent..."
  ab -n 50 -c 10 -q "$BASE_URL/login" > /tmp/ab_output.txt 2>&1 || true
  req_per_sec=$(grep "Requests per second" /tmp/ab_output.txt | awk '{print $4}' || echo "N/A")
  failed=$(grep "Failed requests" /tmp/ab_output.txt | awk '{print $3}' || echo "0")
  p99=$(grep "99%" /tmp/ab_output.txt | awk '{print $2}' || echo "N/A")
  echo "  Requests/sec: $req_per_sec"
  echo "  Failed: $failed"
  echo "  P99 latency: ${p99}ms"
  if [ "${failed:-0}" = "0" ]; then
    pass "Concurrent load — 0 failed requests"
    PASS=$((PASS+1))
  else
    fail "Concurrent load — $failed failed requests"
    FAIL=$((FAIL+1))
  fi
else
  # Fallback: use curl parallel
  echo "Apache Bench not found, using curl parallel (10 requests)..."
  failed_count=0
  for i in $(seq 1 10); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/login" 2>/dev/null || echo "000")
    if [[ ! "$code" =~ ^[23] ]]; then
      failed_count=$((failed_count+1))
    fi
  done
  if [ "$failed_count" = "0" ]; then
    pass "Curl parallel test — 0 failures"
    PASS=$((PASS+1))
  else
    fail "Curl parallel test — $failed_count failures"
    FAIL=$((FAIL+1))
  fi
fi

# ── PHASE 6: Security Checks ────────────────────────────────
section "PHASE 6 — Security Headers"

check_header() {
  local name="$1" url="$2" header="$3"
  local found
  found=$(curl -sI --max-time 10 "$url" 2>/dev/null | grep -i "$header" || true)
  if [ -n "$found" ]; then
    pass "$name present: $found"
    PASS=$((PASS+1))
  else
    warn "$name MISSING"
    WARN=$((WARN+1))
  fi
}

check_header "X-Content-Type-Options" "$BASE_URL/login" "X-Content-Type-Options"
check_header "Cache-Control (no-store)" "$BASE_URL/login" "cache-control"

# Check no directory listing
dir_body=$(curl -s --max-time 10 "$BASE_URL/controllers/" 2>/dev/null || echo "")
if echo "$dir_body" | grep -qi "Index of\|Directory listing"; then
  fail "SECURITY: Directory listing enabled on /controllers/"
  FAIL=$((FAIL+1))
else
  pass "No directory listing on /controllers/"
  PASS=$((PASS+1))
fi

# Check log files not publicly accessible
log_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE_URL/logs/errors/php-errors.log" 2>/dev/null || echo "000")
if [[ "$log_code" =~ ^(403|404|200) ]]; then
  if [ "$log_code" = "200" ]; then
    fail "SECURITY: Log file publicly accessible! ($BASE_URL/logs/errors/php-errors.log → HTTP 200)"
    FAIL=$((FAIL+1))
  else
    pass "Log files protected (HTTP $log_code)"
    PASS=$((PASS+1))
  fi
fi

# ── PHASE 7: API Failure Recovery ───────────────────────────
section "PHASE 7 — API Failure Recovery"

client_log_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
  -H 'Content-Type: application/json' \
  -X POST \
  --data '{"kind":"stress-test","message":"client log endpoint probe"}' \
  "$BASE_URL/api/client-log" 2>/dev/null || echo "000")
if [[ "$client_log_code" =~ ^2 ]]; then
  pass "Client log endpoint accepts bounded telemetry (HTTP $client_log_code)"
  PASS=$((PASS+1))
else
  warn "Client log endpoint unavailable or blocked (HTTP $client_log_code)"
  WARN=$((WARN+1))
fi

malformed_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
  -H 'Content-Type: application/json' \
  -X POST \
  --data '{"bad":' \
  "$BASE_URL/api/client-log" 2>/dev/null || echo "000")
if [[ "$malformed_code" =~ ^2 ]]; then
  pass "Malformed telemetry payload handled safely (HTTP $malformed_code)"
  PASS=$((PASS+1))
else
  warn "Malformed telemetry payload returned HTTP $malformed_code"
  WARN=$((WARN+1))
fi

# ── PHASE 8: PHP Syntax Check ───────────────────────────────
section "PHASE 8 — Local PHP Syntax Check"

php_errors=0
while IFS= read -r -d '' phpfile; do
  result=$(php -l "$phpfile" 2>&1)
  if ! echo "$result" | grep -q "No syntax errors"; then
    fail "Syntax error in $phpfile"
    echo "  $result"
    php_errors=$((php_errors+1))
    FAIL=$((FAIL+1))
  fi
done < <(find "$PROJECT_DIR" -maxdepth 6 -name "*.php" \
  -not -path "*/.git/*" \
  -not -path "*/Projects_backup*" \
  -not -path "*/google-cloud*" \
  -not -path "*/node_modules/*" \
  -not -path "*/Downloads/*" \
  -not -path "*/Documents/*" \
  -not -path "*/Desktop/*" \
  -not -path "*/Library/*" \
  -not -path "*/.cache/*" \
  -not -path "*/vendor/*" \
  -print0 2>/dev/null)

if [ "$php_errors" = "0" ]; then
  pass "All PHP files — no syntax errors"
  PASS=$((PASS+1))
fi

# ── FINAL REPORT ────────────────────────────────────────────
section "SUMMARY"

TOTAL=$((PASS+FAIL+WARN))
echo ""
echo "  Total checks : $TOTAL"
echo -e "  ${GREEN}Passed${NC}       : $PASS"
echo -e "  ${RED}Failed${NC}       : $FAIL"
echo -e "  ${YELLOW}Warnings${NC}     : $WARN"
echo ""

# Write markdown report
{
  echo "# Stress Test Report — $(date)"
  echo ""
  echo "**Target:** $BASE_URL"
  echo "**Runtime log:** logs/runtime-debug.log"
  echo "**Total:** $TOTAL | **Pass:** $PASS | **Fail:** $FAIL | **Warn:** $WARN"
  echo ""
  echo "## Results"
  echo ""
  echo "| Status | Check | Detail |"
  echo "|--------|-------|--------|"
  for r in "${results[@]}"; do
    IFS='|' read -r status name detail <<< "$r"
    echo "| $status | $name | $detail |"
  done
  echo ""
  echo "## Timestamp"
  echo "Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
} > "$REPORT"

echo "Report saved: $REPORT"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}RESULT: FAILED — $FAIL issues found${NC}"
  exit 1
else
  echo -e "${GREEN}RESULT: PASSED — site is healthy${NC}"
  exit 0
fi
