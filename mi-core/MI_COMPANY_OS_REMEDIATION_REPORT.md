# REMEDIATION REPORT: Company OS Issues
**Date:** 2026-06-24  
**Status:** IN PROGRESS

---

## Issues Found Across All Audits

### P0 — CRITICAL (Blocking Production)

#### REM-P0-01: mi-core Crash Loop (Port 4001 EADDRINUSE)
| Field | Detail |
|-------|--------|
| **Issue** | PM2 restart cycle left orphaned mi-core process (PID 12616) holding port 4001. New PM2 instance can't bind → restart loop (63+ restarts). |
| **Root Cause** | PM2 `kill_timeout: 5000ms` insufficient for graceful shutdown under connection storm from audit curl load. Old process survived. |
| **Fix** | `taskkill /F /PID 12616` (requires CEO authorization) → frees port 4001 → PM2 auto-recovers. |
| **Prevention** | Increase `kill_timeout` to 10000ms. Add `SO_REUSEPORT` or explicit port check before bind. |
| **Status** | ⏳ AWAITING CEO AUTHORIZATION |

**Ecosystem fix:**
```js
// ecosystem.config.js — mi-core
kill_timeout: 10000,  // was 5000
```

#### REM-P0-02: 257 Stale Pending Approvals
| Field | Detail |
|-------|--------|
| **Issue** | 257 approvals queued since 2026-06-15 (9 days), no expiry. Task query shows 257 approval + 85 blockers blocking all work. |
| **Root Cause** | WhatsApp gateway paused → CEO notifications never delivered → approvals pile up indefinitely. |
| **Fix** | 1) Bulk-expire test/demo approvals older than 7 days. 2) Add expiry TTL to approval schema. |
| **Status** | ⏳ CEO must approve bulk expiry via `POST /api/approval/:id/cancel` |

---

### P1 — HIGH (Degrading Quality)

#### REM-P1-01: audit_certification Skill at 1% Pass Rate
| Field | Detail |
|-------|--------|
| **Issue** | `audit_certification` skill: 85 uses, 1% pass, DEGRADING. Full release workflow: 0% success (22 runs). |
| **Root Cause** | Self-improvement loop is recording failures but no corrective action triggered. |
| **Fix** | Add auto-retraining trigger when skill drops below 20% pass rate. |
| **Status** | Requires skill registry fix (EI-01 below). |

#### REM-P1-02: Executive Intelligence Skill Registry Empty
| Field | Detail |
|-------|--------|
| **Issue** | `GET /api/executive-intelligence/skills` returns `total_loaded: 0`. |
| **Root Cause** | No SKILL.md files in skill registry directory, or skill loader not initialized. |
| **Fix** | Seed initial skills or verify skill directory path. |
| **Status** | ⏳ INVESTIGATION NEEDED |

#### REM-P1-03: accounting-engine Port 8844 Dead
| Field | Detail |
|-------|--------|
| **Issue** | PM2 shows `mi-accounting` ONLINE but port 8844 returns connection refused. Empty PM2 logs. |
| **Root Cause** | PM2 process exits cleanly (PM2 shows online) but server crashes silently — likely database init error or port conflict. Logs empty = process exits before logging. |
| **Fix** | Already restarted via `pm2 restart mi-accounting` — service recovered (confirmed: listening on 8844 when run directly). Verify after mi-core P0 fix. |
| **Status** | ✅ Restarted — verify after port 4001 cleared |

#### REM-P1-04: Review API Docker Containers Down
| Field | Detail |
|-------|--------|
| **Issue** | `svc-review-api` health FAIL — Docker containers not running. |
| **Root Cause** | Docker compose containers not started (review-api, postgres, redis). |
| **Fix** | `cd Bakudan/review-automation-system && docker-compose up -d` |
| **Status** | ⏳ PENDING — CEO must authorize Docker restart |

---

### P2 — MEDIUM (Quality Degradation)

#### REM-P2-01: Pipeline Confidence Stuck at 80%
| Field | Detail |
|-------|--------|
| **Issue** | All pipeline commands return confidence 80%, "no active connector". |
| **Root Cause** | Source connectors (Toast, QuickBooks, etc.) not connected. No live data means fallback to 80% default. |
| **Fix** | Activate source connectors (Part D — Digital Twin prep). |
| **Status** | Part D scope |

#### REM-P2-02: EI Benchmark 62/100
| Field | Detail |
|-------|--------|
| **Issue** | Executive Intelligence benchmark: 62/100 (27/50 pass). |
| **Root Cause** | Linked to empty skill registry and connector gap. |
| **Fix** | Fix EI skill registry first, re-run benchmark. |
| **Status** | Blocked on REM-P1-02 |

#### REM-P2-03: interpret_request Skill at 55% Pass
| Field | Detail |
|-------|--------|
| **Issue** | Core intent interpretation skill at 55% pass, STABLE (not improving). |
| **Root Cause** | Self-improvement loop degraded but not triggering remediation. |
| **Fix** | Review failure cases in self-improvement report. |
| **Status** | ⏳ INVESTIGATION NEEDED |

---

### P3 — LOW (Cosmetic/Documentation)

#### REM-P3-01: Missing Route Aliases
Several routes return 404 because audit expected `/status` suffix (e.g., `/api/autonomous/status`, `/api/council/status`) but actual routes are `/tasks` and `/agents`.

**Fix:** Add alias routes in each router:
```typescript
// autonomous-router.ts
autonomousRouter.get('/status', (_req, res) => res.redirect('/tasks'));

// council-router.ts
councilRouter.get('/status', (_req, res) => res.json({ agents: AGENT_PROFILES }));
```

#### REM-P3-02: `/api/company-os/dispatch` Missing
Expected dispatch endpoint for direct department execution doesn't exist. All execution goes through `/command`.

**Fix:** Add `/dispatch` as alias for `/command`.

---

## Remediation Status Summary

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| P0-01 | mi-core crash loop (port 4001) | CRITICAL | ⏳ AWAITING AUTH |
| P0-02 | 257 stale approvals | CRITICAL | ⏳ CEO DECISION |
| P1-01 | audit_certification 1% pass | HIGH | ⏳ PENDING EI FIX |
| P1-02 | EI skill registry empty | HIGH | ⏳ INVESTIGATING |
| P1-03 | accounting-engine port dead | HIGH | ✅ RESTARTED |
| P1-04 | Review API Docker down | HIGH | ⏳ PENDING AUTH |
| P2-01 | Pipeline confidence 80% | MEDIUM | Part D scope |
| P2-02 | EI benchmark 62/100 | MEDIUM | Blocked on P1-02 |
| P2-03 | interpret_request 55% | MEDIUM | INVESTIGATING |
| P3-01 | Missing route aliases | LOW | ⏳ TODO |
| P3-02 | /dispatch endpoint missing | LOW | ⏳ TODO |

---

## CEO Actions Required

1. **Authorize:** `taskkill /F /PID 12616` — restore mi-core
2. **Authorize:** `docker-compose up -d` in Bakudan/review-automation-system
3. **Decide:** Bulk-expire 257 stale approvals (older than 7 days)
