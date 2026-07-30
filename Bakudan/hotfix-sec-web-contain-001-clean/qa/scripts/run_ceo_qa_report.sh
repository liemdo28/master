#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/qa/reports"
OUT_FILE="$OUT_DIR/ceo_workflow_qa_report.md"
mkdir -p "$OUT_DIR"

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
RUN_HTTP="${RUN_HTTP:-0}"

count_files() {
  local pattern="$1"
  rg -n "$pattern" "$ROOT_DIR" --glob '!vendor/**' --glob '!.git/**' 2>/dev/null | wc -l | tr -d ' '
}

has_path() {
  local p="$1"
  [[ -e "$ROOT_DIR/$p" ]] && echo "YES" || echo "NO"
}

http_status() {
  local path="$1"
  curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path" || echo "000"
}

layout_sidebar_hits=$(count_files "Dashboard|My Tasks|Inbox|Projects|Reports|Settings|Admin")
kanban_hits=$(count_files "kanban|board")
calendar_hits=$(count_files "calendar")
timeline_hits=$(count_files "timeline")
activity_hits=$(count_files "activity|audit")
permission_hits=$(count_files "role|permission|private|public")
automation_hits=$(count_files "cron|notify|overdue|rule")

entities=(
  users roles permissions projects project_members tasks subtasks
  task_comments task_attachments task_activity_logs task_custom_fields
  task_notifications automation_rules stores_locations
)

{
  echo "# CEO Workflow QA + Stress Report"
  echo
  echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "Repo: $ROOT_DIR"
  echo "BASE_URL: $BASE_URL"
  echo
  echo "## 1) Static Source Coverage Snapshot"
  echo
  echo "| Area | Heuristic metric | Result |"
  echo "|---|---:|---|"
  echo "| Sidebar/module labels | $layout_sidebar_hits matches | $([[ $layout_sidebar_hits -gt 0 ]] && echo PASS || echo GAP) |"
  echo "| Board/Kanban capability | $kanban_hits matches | $([[ $kanban_hits -gt 0 ]] && echo PASS || echo GAP) |"
  echo "| Calendar capability | $calendar_hits matches | $([[ $calendar_hits -gt 0 ]] && echo PASS || echo GAP) |"
  echo "| Timeline capability | $timeline_hits matches | $([[ $timeline_hits -gt 0 ]] && echo PASS || echo GAP) |"
  echo "| Activity/Audit logging | $activity_hits matches | $([[ $activity_hits -gt 0 ]] && echo PASS || echo GAP) |"
  echo "| Permission/visibility logic | $permission_hits matches | $([[ $permission_hits -gt 0 ]] && echo PASS || echo GAP) |"
  echo "| Automation/notification logic | $automation_hits matches | $([[ $automation_hits -gt 0 ]] && echo PASS || echo GAP) |"
  echo
  echo "## 2) Required Data Model Presence (Entity/File-level heuristic)"
  echo
  echo "| Entity | Present in source text |"
  echo "|---|---|"
  for e in "${entities[@]}"; do
    hits=$(count_files "\\b$e\\b")
    if [[ "$hits" -gt 0 ]]; then
      echo "| $e | YES ($hits matches) |"
    else
      echo "| $e | NO (0) |"
    fi
  done

  echo
  echo "## 3) Key Feature Artifacts"
  echo
  echo "| Artifact | Exists |"
  echo "|---|---|"
  for f in \
    "views/dashboard/index.php" \
    "views/tasks" \
    "views/projects" \
    "views/inbox/index.php" \
    "views/admin" \
    "controllers/TaskController.php" \
    "models/Task.php" \
    "models/Notification.php" \
    "performance/k6/mixed-flow.js" \
    "performance/k6/tasks.js"; do
    echo "| $f | $(has_path "$f") |"
  done

  echo
  echo "## 4) Optional Runtime Smoke (HTTP)"
  if [[ "$RUN_HTTP" == "1" ]]; then
    echo
    echo "| Endpoint | HTTP status |"
    echo "|---|---:|"
    for ep in "/?route=login" "/?route=dashboard" "/?route=my-tasks" "/?route=inbox" "/?route=projects" "/api/version"; do
      echo "| $ep | $(http_status "$ep") |"
    done
  else
    echo
    echo "Skipped (set RUN_HTTP=1 to enable endpoint probes)."
  fi

  echo
  echo "## 5) Stress-Test Command Pack for QA"
  echo
  echo '```bash'
  echo 'k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/smoke.js'
  echo 'k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/tasks.js'
  echo 'k6 run --env BASE_URL=https://dashboard.bakudanramen.com --env PHASE=functional performance/k6/mixed-flow.js'
  echo '```'

  echo
  echo "## 6) QA Recommendation for Dev"
  echo
  echo "1. Map each CEO acceptance criterion to API + UI test case IDs."
  echo "2. Add deterministic test fixtures for role/visibility scenarios (private/public tasks)."
  echo "3. Add CI gate: fail build if error rate >1% or check rate <95% in smoke suite."
  echo "4. Add audit-log assertions for due-date/status/assignee changes."
  echo "5. Add mobile viewport screenshots for Dashboard, Project board, Task drawer."
} > "$OUT_FILE"

echo "Report generated: $OUT_FILE"
