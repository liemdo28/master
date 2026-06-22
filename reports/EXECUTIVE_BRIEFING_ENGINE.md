# Executive Briefing Engine — Architecture
**Phase 17**
**Date: 2026-06-13**

---

## Purpose

Mi proactively reports to CEO at 07:00 Vietnam time every morning via WhatsApp. No prompt needed. No manual trigger required. The briefing answers all 5 operational questions in a single message.

---

## Questions Answered

| # | Question | Section |
|---|----------|---------|
| 1 | Hôm nay có gì mới? | 1️⃣ Tasks |
| 2 | Có gì cần duyệt? | 2️⃣ Approvals |
| 3 | Có blocker nào? / Có gì đáng lo? | 3️⃣ Risk (Graph Intelligence) |
| 4 | Team đang làm gì? | 4️⃣ Team |
| 5 | Hệ thống khỏe không? | 5️⃣ System Health |

---

## Architecture

```
07:00 Vietnam time
      ↓
startDailyBriefingScheduler() — checks every 60s
      ↓ fires once per day
sendDailyBriefing()
      ↓
generateExecutiveDailyBriefing()
      ↓
  ┌─────────────────────────────────┐
  │  buildSnapshot()  (Phase 16)   │  ← work_orders, incidents, approvals,
  │                                 │     certifications, reminders, graph.db
  └────────────────┬────────────────┘
                   ↓
  ┌────────────────────────────────────────┐
  │  Section builders                      │
  │  buildTasksSection(snap)               │
  │  buildApprovalsSection(snap)           │
  │  buildRiskSection(snap)                │  ← reads graph_risks / SPOFs
  │  buildTeamSection(snap)                │
  │  buildSystemHealthSection()            │  ← getSystemHealthSnapshot() Phase 15
  └────────────────┬───────────────────────┘
                   ↓
  buildRecommendation(sections, snap)
                   ↓
  full_text (WhatsApp-ready string)
                   ↓
  saveCache() → last-briefing.json
                   ↓
  queueToCeo(full_text) → WhatsApp Gateway
```

**No LLM required. All data-driven. < 200ms.**

---

## Data Sources

| Source | Phase | What it provides |
|--------|-------|-----------------|
| `work-orders/*.json` | 16 | Open work orders + status |
| `operational-memory/memory.db` | 15 | Open incidents (blockers), owner actions |
| `graph/graph.db` | 14 | SPOF detection, criticality scores |
| Approval gate (in-memory) | 14 | CEO-level approvals pending |
| `skills/certifications.json` | 16 | BETA skills ready for promotion |
| `execution-ledger/ledger.jsonl` | 15 | 24h team activity |
| `memory.db → period_summaries` | 15 | Week/month success rate trends |

---

## Briefing Format

```
🌅 *Báo cáo Sáng — Mi*
📅 Thứ Hai, 13/06/2026 | ⏰ 07:00 ICT
🟡 Status tổng thể: WARN

─────────────────────────

*1️⃣ Tasks — N đang mở*
📋 N work orders
🔴 N blockers
  🟠 P1 [WORK_ORDER] <title>
  ↳ <project> (Nh)

*2️⃣ Approvals — N chờ duyệt*
✋ N approval đang chờ anh:
  🟠 P1 <approval title>

*3️⃣ Risk — N SPOF*
🕸️ N Single Point of Failure:
  🔴 *Mi-Core* — 5 phụ thuộc (score: 100/100)

*4️⃣ Team — N actions/24h*
👤 Dev1 — N actions (N PASS) | fix_deployment
👤 QA — N actions (N PASS) | qa_sweep

*5️⃣ System Health*
✅ Tuần này: 84% success (12 execs)
📈 Xu hướng: IMPROVING

─────────────────────────

💡 *Recommendation:*
🔴 Priority 1 — Giảm phụ thuộc vào Mi-Core
✋ Priority 2 — Duyệt N approval trước 09:00

─────────────────────────
_Mi | 07:00 ICT | Phase 17_
```

---

## Severity Logic

| Condition | Severity |
|-----------|----------|
| Any P0 item | `critical` |
| SPOF detected OR open blockers OR pending approvals | `warn` |
| Nothing open, no SPOF, health ≥ 80% | `ok` |

Status icons: `critical` → 🔴 | `warn` → 🟡 | `ok` → ✅

---

## Recommendation Engine

Rules evaluated in order:
1. If SPOF detected → "Lên kế hoạch giảm phụ thuộc vào {SPOF names}"
2. If approvals pending → "Duyệt N approval trước 09:00"
3. If blockers > 24h → "N blocker tồn tại hơn 24h — cần xử lý ngay"
4. If health trend DEGRADING → "Kiểm tra workflow hiệu quả"
5. If none → "Hệ thống ổn định. Tập trung vào roadmap hôm nay."

---

## Files

| File | Role |
|------|------|
| `server/src/executive-briefing/briefing-engine.ts` | Core engine — 5 section builders + recommendation + cache |
| `server/src/executive-briefing/briefing-router.ts` | REST API — `/latest`, `/generate`, `/status` |
| `server/src/jarvis/daily-briefing-scheduler.ts` | Cron — fires at 07:00 ICT via 60s polling |
| `.local-agent-global/executive-briefing/last-briefing.json` | Cached last briefing |

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/briefing/latest` | Retrieve last generated briefing |
| POST | `/api/briefing/generate` | Generate + send now (manual trigger) |
| GET | `/api/briefing/status` | Scheduler status, last sent date |

---

## Scheduler Integration

`daily-briefing-scheduler.ts` (pre-existing) upgraded from calling `generateExecutiveBriefing()` (old connector) to `generateExecutiveDailyBriefing()` (Phase 17 engine). Backward-compatible — same scheduler, same `startDailyBriefingScheduler()` call in `index.ts`. Mute check preserved.

---

## Critical Constraints (inherited)

- **Advisory only** — graph layer read-only
- **No LLM** — all data-driven
- **No modification** to Phase 14 graph, Phase 15 memory schema, Phase 16 task engine

---

**EXECUTIVE_BRIEFING_ENGINE — Phase 17 Architecture Document**
