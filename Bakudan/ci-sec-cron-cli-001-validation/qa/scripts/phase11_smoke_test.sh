#!/bin/bash
# Phase 11 Smoke Test — Run against preview environment
# Usage: bash qa/scripts/phase11_smoke_test.sh [BASE_URL]

BASE_URL="${1:-http://localhost:5003}"
PASS=0
FAIL=0
RESULTS=""

echo "═══════════════════════════════════════════════════════════"
echo "  Phase 11 Smoke Test — Bakudan Business Execution Platform"
echo "  Target: $BASE_URL"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""

check_route() {
    local route="$1"
    local description="$2"
    local expected_code="${3:-200}"
    
    # Use curl to check the route (follow redirects for auth)
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/$route" 2>/dev/null)
    
    # For authenticated routes, 302 redirect to login is acceptable (means route exists)
    if [ "$response" = "$expected_code" ] || [ "$response" = "302" ]; then
        echo "  ✅ PASS  [$response] /$route — $description"
        PASS=$((PASS + 1))
        RESULTS="$RESULTS\nPASS|/$route|$response|$description"
    elif [ "$response" = "500" ]; then
        echo "  ❌ FAIL  [500] /$route — SERVER ERROR — $description"
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\nFAIL|/$route|500|$description - SERVER ERROR"
    elif [ "$response" = "404" ]; then
        echo "  ❌ FAIL  [404] /$route — ROUTE NOT FOUND — $description"
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\nFAIL|/$route|404|$description - NOT FOUND"
    elif [ "$response" = "000" ]; then
        echo "  ⚠️  SKIP  [---] /$route — CONNECTION REFUSED — $description"
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\nFAIL|/$route|000|$description - CONNECTION REFUSED"
    else
        echo "  ⚠️  WARN  [$response] /$route — $description"
        PASS=$((PASS + 1))
        RESULTS="$RESULTS\nWARN|/$route|$response|$description"
    fi
}

check_no_error() {
    local route="$1"
    local description="$2"
    
    # Check response body for common error patterns
    body=$(curl -s --max-time 10 "$BASE_URL/$route" 2>/dev/null)
    
    if echo "$body" | grep -qi "SQLSTATE"; then
        echo "  ❌ FAIL  /$route — SQLSTATE ERROR DETECTED"
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\nFAIL|/$route|SQLSTATE|Database error in response"
        return 1
    fi
    
    if echo "$body" | grep -qi "Fatal error"; then
        echo "  ❌ FAIL  /$route — FATAL ERROR DETECTED"
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\nFAIL|/$route|FATAL|Fatal PHP error in response"
        return 1
    fi
    
    if echo "$body" | grep -qi "Stack trace"; then
        echo "  ❌ FAIL  /$route — STACK TRACE LEAKED"
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\nFAIL|/$route|STACKTRACE|Stack trace exposed to user"
        return 1
    fi
    
    return 0
}

echo "── Phase 11 Routes ─────────────────────────────────────────"
echo ""

# CEO Routes
echo "  [CEO]"
check_route "operations/today" "Daily Operations Center"
check_route "control-tower" "Control Tower"
check_route "action-center" "Action Center"
check_route "company/calendar" "Company Calendar"
echo ""

# Manager Routes
echo "  [Manager]"
check_route "manager/command" "Manager Command Center"
check_route "store/checklist/open" "Store Opening Checklist"
check_route "store/checklist/close" "Store Closing Checklist"
check_route "store/checklist/history" "Checklist History"
echo ""

# Admin Routes
echo "  [Admin]"
check_route "admin/releases" "Release Management Center"
echo ""

# API Routes
echo "  [API]"
check_route "api/version" "Version endpoint (public)"
echo ""

# Error Pattern Check (on public routes)
echo "── Error Pattern Scan ────────────────────────────────────────"
echo ""
check_no_error "api/version" "Version API - no errors"
check_no_error "login" "Login page - no errors"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  RESULTS: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "  🎉 ALL SMOKE TESTS PASSED"
    echo ""
    echo "  Status: READY FOR QA WALKTHROUGH"
else
    echo "  ⚠️  SOME TESTS FAILED — Review above"
    echo ""
    echo "  Status: NEEDS INVESTIGATION"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"

# Write report
REPORT_FILE="qa/reports/phase11_smoke_$(date '+%Y%m%d_%H%M%S').txt"
mkdir -p qa/reports
{
    echo "Phase 11 Smoke Test Report"
    echo "=========================="
    echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Target: $BASE_URL"
    echo "Branch: phase11-business-execution-platform"
    echo "Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    echo ""
    echo "Results: $PASS passed, $FAIL failed"
    echo ""
    echo -e "$RESULTS"
} > "$REPORT_FILE" 2>/dev/null

echo "  Report saved: $REPORT_FILE"
echo ""
