# V4 BURN-IN PROTOCOL

**Started:** 2026-06-15
**Target:** CEO_READY_V4_STABLE (7 consecutive clean days)
**Current Status:** CEO_READY_V4_CONDITIONAL (Score: 92/100)
**Baseline Score:** 81/100 (CEO_READINESS_CERTIFICATION)

---

## DAILY ROUTINE

### Morning Health Check (run once per day)

```
node v4-burn-in-monitor.mjs
```

This checks all 8 tracked metrics and produces:
- `V4_BURNIN_REPORT_YYYY-MM-DD.md` — daily evidence
- `.local-agent-global/burn-in/YYYY-MM-DD.json` — structured data
- `.local-agent-global/burn-in/history.json` — rolling 30-day history

### What It Tracks

| # | Metric | Check Method | Points |
|---|--------|-------------|--------|
| 1 | mi-core restart count | PM2 jlist + crash detection | 15 |
| 2 | whatsapp-ai-gateway restart count | PM2 jlist + crash detection | (part of PM2) |
| 3 | QB freshness | Data file age < 48h | 10 |
| 4 | Connector truth | Registry vs cache reality | 10 |
| 5 | Approval persistence | SQLite DB alive | 15 |
| 6 | Workflow execution | File count + JSON validity | 10 |
| 7 | Memory recall | conversations.db alive | 15 |
| 8 | Multi-intent execution | Trace file integrity | 10 |
| — | Port health | HTTP probe 3 services | 10 |
| — | Security | Secret scan | 5 |
| | **TOTAL** | | **100** |

### Reading the Report

- **Score 90+** = PASS
- **Score 70-89** = WARN (investigate)
- **Score <70** = FAIL (immediate action)

---

## ESCALATION RULES

### P0 — IMMEDIATE STOP AND FIX

| Trigger | Action |
|---------|--------|
| Security: hardcoded secrets found | Stop, remove, rotate |
| Approval DB dead | Investigate, restore backup |
| Conversation DB dead | Investigate, restore backup |
| Process in crash loop | Diagnose, fix, restart |

**Response time:** Immediately upon detection.

### P1 — FIX SAME DAY

| Trigger | Action |
|---------|--------|
| No workflows on disk | Check disk space, file permissions |
| 3+ connectors stale cache | Trigger re-sync |
| QB data stale > 48h | Coordinate with Dev1 |
| Process missing from PM2 | Restart via pm2 start |

**Response time:** Same calendar day.

---

## 7-DAY STREAK RULES

1. Each daily run records `p0` and `p1` counts in `history.json`
2. A "clean day" = 0 P0 events AND 0 P1 events
3. Streak counts consecutively from most recent day backwards
4. Any P0 or P1 resets the streak to 0
5. After 7 consecutive clean days → eligible for CEO_READY_V4_STABLE

### Streak Check

```
node v4-burn-in-monitor.mjs --json | findstr "consecutive"
```

---

## CURRENT BASELINE (2026-06-15)

| Category | Score | Max | Status |
|----------|-------|-----|--------|
| PM2 Stability | 15 | 15 | 5/5 online |
| Port Health | 10 | 10 | 3/3 responding |
| QB Freshness | 10 | 10 | ~8h old |
| Connector Truth | 7 | 10 | 4 unverified (honest) |
| Approval Persistence | 10 | 15 | DB alive, count unknown (no sqlite3 CLI) |
| Workflow Execution | 10 | 10 | 5000+ workflows |
| Memory Recall | 15 | 15 | 156KB DB alive |
| Multi-Intent | 10 | 10 | 219 traces valid |
| Security | 5 | 5 | Clean |
| **TOTAL** | **92** | **100** | |

### Known Limitations

1. **Approval count 0**: sqlite3 CLI not installed; DB is alive but count can't be queried. DB alive = sufficient.
2. **4 unverified connectors**: accounting, quickbooks, dashboard-bakudan, food-safety have `unknown` health_status. This is honest — they haven't been probed yet.
3. **mi-core high restart count** (145): historical, not current crash loop. Current status: stable.

---

## FILES

| File | Purpose |
|------|---------|
| `v4-burn-in-monitor.mjs` | Monitoring script |
| `V4_BURNIN_REPORT_YYYY-MM-DD.md` | Daily evidence (auto-generated) |
| `.local-agent-global/burn-in/history.json` | Rolling streak history |
| `.local-agent-global/burn-in/YYYY-MM-DD.json` | Daily structured scan data |
| `V4_BURNIN_PROTOCOL.md` | This document |

---

## SUCCESS CRITERIA

7 consecutive days with:
- [ ] No security incidents
- [ ] No workflow loss
- [ ] No approval loss
- [ ] No memory loss
- [ ] No silent task drop
- [ ] No WhatsApp crash loop

**Target status:** CEO_READY_V4_STABLE
