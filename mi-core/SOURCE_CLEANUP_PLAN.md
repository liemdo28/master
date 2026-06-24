# SOURCE_CLEANUP_PLAN.md
> Remove candidates: business impact, RAM/CPU, risk level.
> No deletions in this document — plan only.
> Updated: 2026-06-18

---

## Rule: Do Not Delete Yet

This is a PLAN. No rm commands run. CEO approves before any deletion.

---

## P0 — Remove Immediately (Zero Risk)

### qwen3:1.7b
- **Type:** Ollama model
- **RAM impact:** 1.4 GB disk freed, ~1.5 GB VRAM freed during use
- **CPU impact:** None
- **Business impact:** None. No department uses it. qwen3:8b handles all tasks this was considered for.
- **Risk:** Low. Only impact: model fuzzy-match selector no longer picks this by accident (positive side effect).
- **Removal command:** `ollama rm qwen3:1.7b`
- **Verification:** `ollama list` should not show qwen3:1.7b

### deepseek-r1:14b
- **Type:** Ollama model
- **RAM impact:** 9.0 GB disk freed, ~9.0 GB VRAM freed during use
- **CPU impact:** None
- **Business impact:** None. Used once in 7 days in tests only. qwen3:14b covers all deep_reasoning tasks with better throughput.
- **Risk:** Low. Zero departments reference it in brain-registry.ts.
- **Removal command:** `ollama rm deepseek-r1:14b`
- **Verification:** `ollama list` should not show deepseek-r1:14b

**Total P0 savings: 10.4 GB disk, ~10.5 GB VRAM reclaimed**

---

## P1 — Deprecate / Archive (Low Risk, Review First)

### Agent/antigravity-gateway.zip + antigravity-gateway-package.zip
- **Type:** Zip archive files
- **Business impact:** None — gateway is live at Agent/agent-coding-api-keys/ (same project, already running)
- **Risk:** Low. Zip is redundant — the live folder is the source of truth.
- **Action:** Move to _archive/ after confirming live gateway is stable
- **RAM/CPU impact:** ~50-200MB disk

### Agent/review-management-mcp/
- **Type:** Agent (dev paused)
- **Business impact:** None active. If review-automation-system MCP integration ever needed, recreate from scratch.
- **Risk:** Low. No services call this.
- **Action:** Move to _archive/

### Agent/shared-workspace/
- **Type:** Staging data
- **Business impact:** None — verify no active process reads from here
- **Action:** Verify then move to _archive/

---

## P2 — Evaluate (Medium Risk, Needs Investigation)

### Bakudan/growth-dashboard/
- **Classification:** UNKNOWN
- **Business impact:** Unknown — may contain active business data
- **Action:** CEO review — is this used by any team member?
- **Risk:** Medium until investigated

### Other/
- **Classification:** UNKNOWN
- **Business impact:** Unknown
- **Action:** Open folder, classify contents

### _transfer_packages/
- **Classification:** SHADOW
- **Business impact:** May contain packages needed by field laptops
- **Action:** Verify no active transfer pending, then move contents to _archive/

---

## P3 — Keep But Monitor

### mi-core-backups/
- **Reason:** Operational safety. Keep 30 days, auto-prune older.
- **Action:** Add cron job to prune backups older than 30 days

### qb-ops-agent (on laptop1)
- **Reason:** QB Desktop must run somewhere. Not removable without replacing QB.
- **Action:** Ensure heartbeat is monitored. Alert if offline > 24h.

---

## Impact Summary

| Priority | Item | Disk | VRAM | Risk |
|----------|------|------|------|------|
| P0 | qwen3:1.7b | 1.4 GB | 1.5 GB | Low |
| P0 | deepseek-r1:14b | 9.0 GB | 9.0 GB | Low |
| P1 | Zip archives | ~200 MB | 0 | Low |
| P1 | agent-review-mcp | ~10 MB | 0 | Low |
| **Total P0** | | **10.4 GB** | **10.5 GB** | **Low** |

---

## Execution Checklist (CEO approves before each step)

```
[ ] CEO approves P0 removals
[ ] ollama rm qwen3:1.7b
[ ] ollama rm deepseek-r1:14b
[ ] ollama list — verify both gone
[ ] pm2 restart mi-core — verify no model selection errors
[ ] CEO approves P1 archives
[ ] Move zip files to _archive/
[ ] Verify antigravity-gateway still running on port 3456
[ ] Document completed in REMOVE_CANDIDATES.md
```
