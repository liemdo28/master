# TOOL_ASSIGNMENT_REPORT.md
> Mi Company OS — Tool assignment per department.
> Source: `server/src/company-os/tool-registry.ts`
> Updated: 2026-06-18

---

## Tool Catalog

| Tool ID | Name | Data Source |
|---------|------|-------------|
| task-snapshot | Task Snapshot | SQLite via task-intelligence (Phase 16) |
| task-today | Today Tasks | SQLite via task-intelligence (Phase 16) |
| task-approvals | Pending Approvals | SQLite via task-intelligence (Phase 16) |
| briefing-latest | Latest Briefing | executive-briefing engine (Phase 17) |
| visibility-dashboard | Visibility Dashboard | visibility connector registry |
| pm2-status | PM2 Status | nodes API |
| node-registry | Node Registry | nodes API |
| health-intel | Health Intelligence | health-intelligence (Phase 23) |
| strategic-memory | Strategic Memory | strategic-memory engine (Phase 18) |
| agenview-snapshot | AgenView Snapshot | agenview engine (Phase 19) |
| pipeline-history | Pipeline History | evidence-store SQLite |
| dept-registry | Department Registry | departments.ts (in-memory) |
| evidence-reader | Evidence Reader | evidence-store SQLite |
| dept-definitions | Department Definitions | departments.ts (in-memory) |
| source-inventory-reader | Source Inventory | source-inventory.ts (in-memory) |

---

## Department → Tools

| Department | Tools |
|------------|-------|
| dispatch | dept-definitions, pipeline-history |
| executive-assistant | task-snapshot, task-today, task-approvals, health-intel |
| report-center | briefing-latest, visibility-dashboard, agenview-snapshot, strategic-memory, pipeline-history |
| library | dept-definitions, source-inventory-reader |
| qa | evidence-reader, pipeline-history |
| finance | visibility-dashboard, strategic-memory |
| restaurant-intelligence | visibility-dashboard |
| engineering | pipeline-history, evidence-reader |
| marketing | strategic-memory, visibility-dashboard |
| brand-creative | strategic-memory |
| technical-operations | pm2-status, node-registry, visibility-dashboard |
| rd | source-inventory-reader, dept-definitions, strategic-memory |

---

## Tool Execution Model

1. `gatherToolContext(deptId)` — runs all tools for a dept in parallel
2. Each tool has a 10s timeout; failures are captured and noted (do not abort other tools)
3. Each tool result is truncated to 2000 chars before being passed to the brain
4. `tools_used` and `tools_failed` are recorded in evidence-store for QA review
5. API tools use `MI_CORE_API_KEY` for authentication

---

## API Endpoint

`GET /api/company-os/tools/:dept_id` — returns tool list for any department.
