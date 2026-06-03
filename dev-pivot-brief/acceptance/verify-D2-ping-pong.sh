#!/usr/bin/env bash
# ============================================================================
# verify-D2-ping-pong.sh — CEO acceptance test for Milestone D2
# ----------------------------------------------------------------------------
# Runs 10 round-trip pings to the worker, measures latency, verifies audit.
# Run from the laptop. Worker must be already paired.
#
# Pass criteria:
#   - 10/10 pings return < 5 seconds each
#   - audit ledger has matching rows
#
# Usage:
#   ./verify-D2-ping-pong.sh [worker-name]
# ============================================================================

set -uo pipefail
WORKER="${1:-pc-master}"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
pass=0; fail=0

check() {
  local desc="$1" cmd="$2"
  printf "  %-55s" "$desc"
  if eval "$cmd" >/dev/null 2>&1; then printf "${GREEN}PASS${NC}\n"; pass=$((pass+1))
  else printf "${RED}FAIL${NC}\n"; fail=$((fail+1)); fi
}

printf "\n${CYAN}${BOLD}D2 — Ping/Pong verification (worker: %s)${NC}\n\n" "$WORKER"

# 1. agentctl is installed
check "agentctl in PATH"                "command -v agentctl"

# 2. worker is registered
check "worker '$WORKER' registered"     "agentctl workers list | grep -q '$WORKER'"

# 3. worker is online
check "worker '$WORKER' status=online"  "agentctl workers show '$WORKER' | grep -q 'online'"

# 4. 10 successive pings
printf "\n  Running 10 pings...\n"
PINGS_OK=0
LATENCIES=()
for i in $(seq 1 10); do
  T0=$(date +%s%3N)
  if agentctl ping "$WORKER" --timeout 5 >/dev/null 2>&1; then
    T1=$(date +%s%3N)
    LAT=$((T1 - T0))
    LATENCIES+=("$LAT")
    PINGS_OK=$((PINGS_OK + 1))
    printf "    ping #%-2d  ${GREEN}OK${NC}  %dms\n" "$i" "$LAT"
  else
    printf "    ping #%-2d  ${RED}FAIL${NC}\n" "$i"
  fi
done

printf "\n  10/10 pings succeeded                                  "
[ "$PINGS_OK" -eq 10 ] && { printf "${GREEN}PASS${NC}\n"; pass=$((pass+1)); } \
                      || { printf "${RED}FAIL${NC} (%d/10)\n" "$PINGS_OK"; fail=$((fail+1)); }

# 5. compute p50 and p99
if [ "${#LATENCIES[@]}" -gt 0 ]; then
  IFS=$'\n' SORTED=($(sort -n <<<"${LATENCIES[*]}")); unset IFS
  P50=${SORTED[4]}
  P99=${SORTED[9]}
  printf "  latency p50 = %dms  (target < 500ms)                  " "$P50"
  [ "$P50" -lt 500 ] && { printf "${GREEN}PASS${NC}\n"; pass=$((pass+1)); } \
                     || { printf "${RED}FAIL${NC}\n"; fail=$((fail+1)); }
  printf "  latency p99 = %dms  (target < 2000ms)                 " "$P99"
  [ "$P99" -lt 2000 ] && { printf "${GREEN}PASS${NC}\n"; pass=$((pass+1)); } \
                      || { printf "${RED}FAIL${NC}\n"; fail=$((fail+1)); }
fi

# 6. audit ledger
check "audit shows recent ping events"  "agentctl audit '$WORKER' --tail 20 | grep -q 'control_ping'"

# 7. hash chain integrity
check "audit chain verifies"            "agentctl audit verify '$WORKER'"

# ───────────── summary
echo ""
echo "─────────────────────────────────────────────"
printf "  ${BOLD}D2 — %d passed, %d failed${NC}\n" "$pass" "$fail"
echo "─────────────────────────────────────────────"

if [ "$fail" -eq 0 ]; then
  printf "  ${GREEN}${BOLD}✓ Milestone D2 ACCEPTED${NC}\n\n"
  exit 0
else
  printf "  ${RED}${BOLD}✗ Milestone D2 NOT YET DONE${NC}\n\n"
  exit 1
fi
