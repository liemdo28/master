# CEO WIDGET SPEC — Dashboard.bakudanramen.com
**Widget-by-widget specification for the CEO Dashboard (Phase 7).**
*Last updated: 2026-06-04 16:20 (Asia/Saigon, UTC+7)*

---

## Widget 1: Projects

**Purpose:** Show all tracked projects and their current status.

| Field | Value |
|-------|-------|
| Title | PROJECTS |
| Data source | `docs/AGENT_OS/PROJECT_BRAIN.md` §7 (Phase Roadmap) |
| Refresh | Manual (agent updates on each sprint) |
| Layout | Horizontal scrollable cards |
| Card fields | Name, Phase, Status badge, Commit hash |

**Status badge colors:**
- 🟢 DONE — green background, white text
- 🟡 IN PROGRESS — yellow background, dark text
- ⏳ PENDING — blue background, white text
- 🔴 BLOCKED — red background, white text

---

## Widget 2: Active Projects

**Purpose:** Show currently active work items.

| Field | Value |
|-------|-------|
| Title | ACTIVE PROJECTS |
| Data source | `git log --oneline -10` (recent commits) |
| Filter | Only commits from last 7 days |
| Layout | Vertical list, max 5 items |
| Item fields | Commit hash, message, author, time ago |

---

## Widget 3: Duplicates

**Purpose:** Detect duplicate project folders or files.

| Field | Value |
|-------|-------|
| Title | DUPLICATES |
| Data source | `git status --short` (untracked + uncommitted files) |
| Trigger | Files listed in `.gitignore` or `DESKTOP.INI` |
| Layout | List of duplicate/dangling files |
| Warning | 🟡 YELLOW if > 0, 🟢 GREEN if clean |

**Rule:** No files on Desktop. No duplicate project folders.
CEO directive: `Do NOT create duplicate projects. Do NOT build on Desktop.`

---

## Widget 4: Failed QA

**Purpose:** Show last QA run result.

| Field | Value |
|-------|-------|
| Title | FAILED QA |
| Data source | `npm run qa` last exit code |
| Trigger | Exit code != 0 |
| Layout | Single line: "✅ X PASS, 🔴 Y FAIL" |
| Click action | Opens `qa/reports/html/index.html` |

---

## Widget 5: Pending QA

**Purpose:** Show un-reviewed QA artifacts.

| Field | Value |
|-------|-------|
| Title | PENDING QA |
| Data source | `qa/artifacts/` directory scan |
| Count | Unread reports in `qa/reports/` |
| Layout | Badge count + list of unreviewed reports |

---

## Widget 6: Production Deploys

**Purpose:** Show deployment history.

| Field | Value |
|-------|-------|
| Title | PRODUCTION DEPLOYS |
| Data source | `deploy.php` log or `git log --oneline production-*` |
| Layout | Last 5 deploys: date, commit, deployer |
| Status | 🟢 LIVE if last deploy < 24h ago |

---

## Widget 7: Recent Errors

**Purpose:** Show PHP errors from last 24h.

| Field | Value |
|-------|-------|
| Title | RECENT ERRORS |
| Data source | `logs/errors/php-errors.log` (last 10 entries) |
| Grouping | By error type + count |
| Layout | Grouped list: "Fatal: 0 | Warning: 2 | Notice: 5" |
| Color | 🟢 GREEN if 0 fatal; 🟡 if warnings exist; 🔴 if fatal exist |

---

## Widget 8: Recent Builds

**Purpose:** Show recent git activity.

| Field | Value |
|-------|-------|
| Title | RECENT BUILDS |
| Data source | `git log --oneline -10` |
| Layout | Commit hash + message + author |
| Link | Click hash → GitHub commit page |

---

## Widget 9: Recent Tasks

**Purpose:** Show tasks needing CEO attention.

| Field | Value |
|-------|-------|
| Title | RECENT TASKS |
| Data source | `/api/workflow/command-center` → critical_today + blocked |
| Layout | Table: ID, Title, Due, Status, Assignee |
| Color rules | Overdue = 🔴 RED row, Due today = 🟡 YELLOW row, Done = 🟢 GREEN row |

---

## Global Styling Rules

1. **No dark gray text** — all text must be one of: white, light-gray, green, yellow, or red
2. **Readable at 2K resolution** — min font size 14px for body, 20px for titles
3. **Card spacing** — min 12px gap between cards
4. **Color consistency** — use CSS custom properties:
   - `--health-green: #10b981`
   - `--health-yellow: #f59e0b`
   - `--health-red: #ef4444`
5. **Blue theme** — background `#0b1220`, cards `#11224a`, accent `#60a5fa`
6. **Cards must not be solid black** — minimum card background: `#11224a`