#!/bin/bash
# Phase 11 — Staging Verification Script
# Usage: BASE_URL=https://preview.dashboard.bakudanramen.com ./scripts/verify_staging.sh
# Requires: curl, jq (optional)

BASE_URL="${BASE_URL:-https://preview.dashboard.bakudanramen.com}"
COOKIE_JAR="/tmp/staging_cookies.txt"
REPORT_FILE="reports/PHASE11_STAGING_RESULTS.txt"

echo "============================================"
echo "Phase 11 Staging Verification"
echo "Base URL: $BASE_URL"
echo "Date: $(date)"
echo "============================================"
echo ""

# Clean up
rm -f "$COOKIE_JAR" "$REPORT_FILE"

# ─── Step 1: Login ───────────────────────────────────────────────────────────
echo "[1/5] Logging in..."
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" \
  -d "email=${TEST_EMAIL:-admin@bakudanramen.com}&password=${TEST_PASSWORD:-admin123}" \
  -X POST "$BASE_URL/login")

if [ "$LOGIN_STATUS" = "302" ] || [ "$LOGIN_STATUS" = "200" ]; then
  echo "  ✓ Login successful (HTTP $LOGIN_STATUS)"
else
  echo "  ✗ Login FAILED (HTTP $LOGIN_STATUS)"
  echo "  Cannot continue without auth. Check credentials."
  exit 1
fi

# ─── Step 2: Route Verification ──────────────────────────────────────────────
echo ""
echo "[2/5] Verifying routes..."
ROUTES=(
  "/admin/release-dashboard"
  "/admin/shifts"
  "/admin/employees"
  "/admin/training"
  "/admin/procurement"
  "/admin/documents"
  "/admin/compliance"
  "/admin/store-command"
  "/ceo/boardroom"
  "/admin/digital-twin"
  "/control-tower"
  "/manager/command"
  "/company/calendar"
  "/operations/today"
  "/admin/incidents"
  "/admin/payroll"
)

PASS=0
FAIL=0
echo "Route Verification Results" > "$REPORT_FILE"
echo "==========================" >> "$REPORT_FILE"
echo "Date: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

for route in "${ROUTES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE_URL$route")
  if [ "$STATUS" = "200" ]; then
    echo "  ✓ $route → $STATUS"
    echo "✓ $route → $STATUS" >> "$REPORT_FILE"
    PASS=$((PASS + 1))
  elif [ "$STATUS" = "302" ]; then
    echo "  ~ $route → $STATUS (redirect)"
    echo "~ $route → $STATUS (redirect)" >> "$REPORT_FILE"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $route → $STATUS"
    echo "✗ $route → $STATUS" >> "$REPORT_FILE"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "  Result: $PASS passed, $FAIL failed out of ${#ROUTES[@]} routes"
echo "" >> "$REPORT_FILE"
echo "Result: $PASS/$((PASS + FAIL)) passed" >> "$REPORT_FILE"

# ─── Step 3: Check for errors in response body ──────────────────────────────
echo ""
echo "[3/5] Checking for PHP errors in responses..."
ERROR_ROUTES=()
for route in "${ROUTES[@]}"; do
  BODY=$(curl -s -b "$COOKIE_JAR" "$BASE_URL$route")
  if echo "$BODY" | grep -qi "fatal error\|parse error\|SQLSTATE\|Something went wrong"; then
    echo "  ✗ $route contains error"
    ERROR_ROUTES+=("$route")
  fi
done

if [ ${#ERROR_ROUTES[@]} -eq 0 ]; then
  echo "  ✓ No PHP errors detected in any route"
else
  echo "  ✗ ${#ERROR_ROUTES[@]} routes have errors"
fi

# ─── Step 4: Permission Check (member role) ──────────────────────────────────
echo ""
echo "[4/5] Permission check (requires member account)..."
echo "  ⏭ Skipped — run manually with member credentials"
echo "  Command: TEST_EMAIL=member@test.com TEST_PASSWORD=xxx ./scripts/verify_staging.sh"

# ─── Step 5: API Endpoints ───────────────────────────────────────────────────
echo ""
echo "[5/5] Checking API endpoints..."
API_ROUTES=(
  "/api/payroll/stats"
  "/api/incidents/stats"
)
for route in "${API_ROUTES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE_URL$route")
  echo "  API $route → $STATUS"
done

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "SUMMARY"
echo "============================================"
echo "Routes: $PASS passed, $FAIL failed"
echo "Errors: ${#ERROR_ROUTES[@]} routes with PHP errors"
echo "Report: $REPORT_FILE"
echo ""

if [ "$FAIL" -eq 0 ] && [ ${#ERROR_ROUTES[@]} -eq 0 ]; then
  echo "✅ STAGING VERIFICATION PASSED"
  exit 0
else
  echo "❌ STAGING VERIFICATION FAILED"
  exit 1
fi
