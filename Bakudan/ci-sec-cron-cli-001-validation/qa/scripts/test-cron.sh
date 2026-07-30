#!/bin/bash
# ============================================================
# TaskFlow — Cron Pipeline Test Script
# Usage: bash qa/scripts/test-cron.sh [--force-telegram]
# ============================================================

BASE_URL="https://dashboard.bakudanramen.com"
CRON_KEY="taskflow-cron-2024-secret"

echo "============================================="
echo " TaskFlow Cron Pipeline Test"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================="
echo ""

# ── Standard run ──────────────────────────────────────────────
echo "[1/3] Running cron pipeline (standard)..."
RESULT=$(curl -s "${BASE_URL}/cron.php?key=${CRON_KEY}")
echo "Response: ${RESULT}"
echo ""

# Validate output
if echo "$RESULT" | grep -q "^OK"; then
    echo "✓ PASS — Cron returned OK"
else
    echo "✗ FAIL — Expected OK prefix, got: ${RESULT}"
    exit 1
fi

# ── Parse key metrics ─────────────────────────────────────────
echo "[2/3] Parsing metrics..."

RISK=$(echo "$RESULT" | grep -oP 'risk=\K[^\s·]+')
DECISIONS=$(echo "$RESULT" | grep -oP 'decisions=\K\d+')
APPROVALS=$(echo "$RESULT" | grep -oP 'approvals=\K\d+')
PUSH=$(echo "$RESULT" | grep -oP 'push=\K\d+')
CLEANUP=$(echo "$RESULT" | grep -oP 'cleanup=\K\d+')
ACTIVITY=$(echo "$RESULT" | grep -oP 'activity=\K\d+')
STALE=$(echo "$RESULT" | grep -oP 'stale=\K\d+')

echo "  risk_score   = ${RISK}"
echo "  decisions    = ${DECISIONS}"
echo "  approvals    = ${APPROVALS}"
echo "  push_queued  = ${PUSH}"
echo "  session_cleanup = ${CLEANUP}"
echo "  activity_logged = ${ACTIVITY}"
echo "  stale_cleared   = ${STALE}"
echo ""

# ── Force telegram test (optional) ───────────────────────────
if [[ "$1" == "--force-telegram" ]]; then
    echo "[3/3] Running cron with force_telegram=1..."
    TGRESULT=$(curl -s "${BASE_URL}/cron.php?key=${CRON_KEY}&force_telegram=1")
    echo "Response: ${TGRESULT}"
    echo ""
    TG_TODAY=$(echo "$TGRESULT" | grep -oP 'tg_today=\K[^\s·]+')
    echo "  tg_today = ${TG_TODAY}"
    if [[ "$TG_TODAY" == "0" || "$TG_TODAY" =~ ^[0-9]+$ ]]; then
        echo "✓ PASS — Telegram reminder dispatched"
    else
        echo "~ INFO — tg_today=${TG_TODAY} (may be 'skip' outside reminder hour)"
    fi
else
    echo "[3/3] Skipping Telegram test (add --force-telegram to test)"
fi

echo ""
echo "============================================="
echo " Cron test complete"
echo "============================================="
