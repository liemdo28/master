#!/usr/bin/env bash
# ============================================================================
# verify-D3-to-D6.sh — CEO acceptance for milestones D3 through D6
# ----------------------------------------------------------------------------
# Each section is independent. You can run with --skip-to D5 to start from D5.
# All tests use real `agentctl` invocations and check real outputs.
#
# Usage:
#   ./verify-D3-to-D6.sh [worker-name] [--skip-to D3|D4|D5|D6]
# ============================================================================

set -uo pipefail
WORKER="pc-master"
SKIP_TO=""
for arg in "$@"; do
  case "$arg" in
    --skip-to=*)   SKIP_TO="${arg#*=}";;
    --skip-to)     SKIP_TO="$2"; shift;;
    pc-*)          WORKER="$arg";;
    *)             ;;
  esac
done

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
ALL_PASS=true

section() { printf "\n${CYAN}${BOLD}═══ %s ═══${NC}\n" "$1"; }
check()   {
  local desc="$1" cmd="$2"
  printf "  %-60s" "$desc"
  if eval "$cmd" >/dev/null 2>&1; then printf "${GREEN}PASS${NC}\n"; else printf "${RED}FAIL${NC}\n"; ALL_PASS=false; fi
}
note()    { printf "  ${DIM}%s${NC}\n" "$1"; }

# Skip-to logic
should_run() {
  case "$SKIP_TO" in
    "")      return 0;;
    D3)      [[ "$1" == "D3" || "$1" == "D4" || "$1" == "D5" || "$1" == "D6" ]] && return 0;;
    D4)      [[ "$1" == "D4" || "$1" == "D5" || "$1" == "D6" ]] && return 0;;
    D5)      [[ "$1" == "D5" || "$1" == "D6" ]] && return 0;;
    D6)      [[ "$1" == "D6" ]] && return 0;;
  esac
  return 1
}

# ════════════════════════════════════════════════════════════════════
# D3 — Open Antigravity
# ════════════════════════════════════════════════════════════════════
if should_run D3; then
section "D3 — Open Antigravity"

note "Dispatching open-antigravity to $WORKER ..."
RESULT_JSON=$(agentctl exec --worker "$WORKER" --json open-antigravity 2>/dev/null || echo '{}')

check "task returned a status field"          "echo '$RESULT_JSON' | grep -q '\"status\"'"
check "status is 'opened' or 'started'"       "echo '$RESULT_JSON' | grep -qE '\"status\"\s*:\s*\"(opened|started|ok)\"'"
check "result includes a pid"                 "echo '$RESULT_JSON' | grep -q '\"pid\"'"

note "Pid from worker: $(echo "$RESULT_JSON" | grep -oE '\"pid\"\s*:\s*[0-9]+' | head -1)"

# Wait a moment, then close
sleep 3
note "Closing Antigravity ..."
CLOSE_JSON=$(agentctl exec --worker "$WORKER" --json close-antigravity 2>/dev/null || echo '{}')
check "close returned ok"                     "echo '$CLOSE_JSON' | grep -qE '\"status\"\s*:\s*\"(closed|ok)\"'"
fi

# ════════════════════════════════════════════════════════════════════
# D4 — Start API Proxy
# ════════════════════════════════════════════════════════════════════
if should_run D4; then
section "D4 — Start API Proxy"

note "Dispatching start-api-proxy ..."
START_JSON=$(agentctl exec --worker "$WORKER" --json start-api-proxy 2>/dev/null || echo '{}')

check "start returned status=started"         "echo '$START_JSON' | grep -qE '\"status\"\s*:\s*\"started\"'"
check "start returned a port"                 "echo '$START_JSON' | grep -q '\"port\"'"
check "start returned log_tail"               "echo '$START_JSON' | grep -q '\"log_tail\"'"

PORT=$(echo "$START_JSON" | grep -oE '\"port\"\s*:\s*[0-9]+' | head -1 | grep -oE '[0-9]+')
note "Proxy reported running on port: ${PORT:-<unknown>}"

# Wait a moment, then check status
sleep 3
STATUS_JSON=$(agentctl status api-proxy --worker "$WORKER" --json 2>/dev/null || echo '{}')
check "status command shows running"          "echo '$STATUS_JSON' | grep -qE '\"state\"\s*:\s*\"running\"'"
check "status reports nonzero uptime"         "echo '$STATUS_JSON' | grep -qE '\"uptime_sec\"\s*:\s*[1-9]'"

# Logs
LOGS=$(agentctl logs api-proxy --worker "$WORKER" --tail 20 2>/dev/null || echo "")
check "logs --tail 20 returns content"        "[ \"$(echo -n \"$LOGS\" | wc -l)\" -gt 0 ]"

# Stop
note "Stopping ..."
STOP_JSON=$(agentctl exec --worker "$WORKER" --json stop-api-proxy 2>/dev/null || echo '{}')
check "stop returned ok"                      "echo '$STOP_JSON' | grep -qE '\"status\"\s*:\s*\"(stopped|ok)\"'"
fi

# ════════════════════════════════════════════════════════════════════
# D5 — Audit Master
# ════════════════════════════════════════════════════════════════════
if should_run D5; then
section "D5 — Audit Master"

note "Dispatching audit E:\\Project\\Master ..."
AUDIT_JSON=$(agentctl exec --worker "$WORKER" --json --timeout 600 audit "E:\\Project\\Master" 2>/dev/null || echo '{}')

check "audit returned status=ok"              "echo '$AUDIT_JSON' | grep -qE '\"status\"\s*:\s*\"ok\"'"
check "audit returned a report path"          "echo '$AUDIT_JSON' | grep -q '\"report_path\"'"
check "audit returned a summary"              "echo '$AUDIT_JSON' | grep -q '\"summary\"'"
check "audit returned counts"                 "echo '$AUDIT_JSON' | grep -q '\"counts\"'"
check "audit reports >0 projects scanned"     "echo '$AUDIT_JSON' | grep -oE '\"projects_scanned\"\s*:\s*[1-9][0-9]*' >/dev/null"

REPORT_PATH=$(echo "$AUDIT_JSON" | grep -oE '"report_path"\s*:\s*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
note "Report path on worker: $REPORT_PATH"

# Fetch the report to laptop
if [ -n "$REPORT_PATH" ]; then
  LOCAL_DIR="$(mktemp -d)"
  LOCAL_PATH="$LOCAL_DIR/audit-report.md"
  note "Fetching report to laptop ..."
  if agentctl fetch "$WORKER:$REPORT_PATH" --to "$LOCAL_PATH" >/dev/null 2>&1; then
    check "report fetched to laptop"          "test -f '$LOCAL_PATH' && [ \$(wc -c < '$LOCAL_PATH') -gt 100 ]"
    check "report contains 'projects'"        "grep -i 'projects' '$LOCAL_PATH'"
  else
    printf "  ${RED}FAIL${NC} report fetch failed\n"; ALL_PASS=false
  fi
fi
fi

# ════════════════════════════════════════════════════════════════════
# D6 — Inject Prompt to Cline
# ════════════════════════════════════════════════════════════════════
if should_run D6; then
section "D6 — Inject Prompt to Cline"

note "Dispatching cline-prompt ..."
PROMPT_JSON=$(agentctl exec --worker "$WORKER" --json --timeout 60 \
  cline-prompt \
    --project "E:\\Project\\Master\\Agent" \
    --prompt "Echo 'hello from D6' and stop" \
  2>/dev/null || echo '{}')

check "cline-prompt task returned ok"         "echo '$PROMPT_JSON' | grep -qE '\"status\"\s*:\s*\"(ok|dispatched|streaming)\"'"
check "task has a task_id"                    "echo '$PROMPT_JSON' | grep -q '\"task_id\"'"

TASK_ID=$(echo "$PROMPT_JSON" | grep -oE '"task_id"\s*:\s*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
note "Cline task id: $TASK_ID"

# Stream logs for 30s
if [ -n "$TASK_ID" ]; then
  note "Streaming Cline output for 30 seconds ..."
  LOG_FILE="$(mktemp)"
  timeout 30 agentctl logs "$TASK_ID" --follow > "$LOG_FILE" 2>&1 || true
  LOG_SIZE=$(wc -c < "$LOG_FILE")
  check "received >100 bytes of Cline output"  "[ $LOG_SIZE -gt 100 ]"
  check "logs mention 'hello' from Cline"     "grep -qi 'hello' '$LOG_FILE'"
  printf "  ${DIM}--- last 10 log lines ---${NC}\n"
  tail -10 "$LOG_FILE" | sed 's/^/    /'
fi
fi

# ════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════════════"
if $ALL_PASS; then
  printf "  ${GREEN}${BOLD}✓ All applicable milestones ACCEPTED${NC}\n"
  echo "════════════════════════════════════════════════════════════════"
  exit 0
else
  printf "  ${RED}${BOLD}✗ One or more milestones NOT YET DONE${NC}\n"
  echo "════════════════════════════════════════════════════════════════"
  exit 1
fi
