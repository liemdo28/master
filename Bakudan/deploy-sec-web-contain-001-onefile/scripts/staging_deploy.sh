#!/bin/bash
# Phase 11 — Staging Deploy Script
# Run this ON the DreamHost server (SSH)
# Usage: ./scripts/staging_deploy.sh

set -e

BRANCH="phase11-business-execution-platform"
DEPLOY_DIR="/home/liemdo0208/preview.dashboard.bakudanramen.com"

echo "============================================"
echo "Phase 11 — Staging Deploy"
echo "Branch: $BRANCH"
echo "Target: $DEPLOY_DIR"
echo "Date: $(date)"
echo "============================================"
echo ""

# ─── Step 1: Checkout branch ─────────────────────────────────────────────────
echo "[1/4] Checking out branch..."
cd "$DEPLOY_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
echo "  ✓ Branch: $(git branch --show-current)"
echo "  ✓ Commit: $(git rev-parse --short HEAD)"
echo ""

# ─── Step 2: Verify .env.preview ─────────────────────────────────────────────
echo "[2/4] Verifying .env.preview..."
if [ -f ".env.preview" ]; then
  echo "  ✓ .env.preview exists"
  grep -q "APP_ENV=staging" .env.preview && echo "  ✓ APP_ENV=staging" || { echo "  ✗ APP_ENV=staging missing"; exit 1; }
  grep -q "DB_NAME=bakudan_preview" .env.preview && echo "  ✓ DB_NAME=bakudan_preview" || { echo "  ✗ DB_NAME must be bakudan_preview"; exit 1; }
  grep -q "DB_HOST=" .env.preview && echo "  ✓ DB_HOST configured" || { echo "  ✗ DB_HOST missing"; exit 1; }
else
  echo "  ✗ .env.preview NOT FOUND — preview cannot run without isolated DB config"
  exit 1
fi
echo ""

# ─── Step 3: Run migrations + seed ───────────────────────────────────────────
echo "[3/4] Running migrations + seed..."
export APP_ENV_FILE="$DEPLOY_DIR/.env.preview"
php preview_db_health.php
php migrate.php
php seed_phase11.php
echo ""

# ─── Step 4: Verify ──────────────────────────────────────────────────────────
echo "[4/4] Quick verification..."
php -r "
require_once 'config/database.php';
\$db = Database::getInstance();
\$tables = ['shifts','employees','training_modules','procurements','documents','calendar_events','incident_playbooks'];
foreach (\$tables as \$t) {
    \$r = \$db->fetch(\"SELECT COUNT(*) as c FROM \$t\");
    echo \"  \$t: \" . (\$r['c'] ?? 0) . \" rows\n\";
}
"

echo ""
echo "============================================"
echo "✅ Staging deploy complete"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Visit preview URL in browser"
echo "  2. Run: BASE_URL=https://preview.dashboard.bakudanramen.com ./scripts/verify_staging.sh"
echo "  3. Take screenshots"
echo "  4. Run Playwright: cd qa && BASE_URL=... npx playwright test"
