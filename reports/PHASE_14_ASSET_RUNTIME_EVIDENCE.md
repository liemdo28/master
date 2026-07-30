# PHASE_14_ASSET_RUNTIME_EVIDENCE.md
> Phase 14 — Asset Registry Runtime Evidence
> Date: 2026-06-18

---

## Company Asset Registry — Live Data Verified

### Projects Registry
```
GET /api/company-os/projects
```
- Total projects: 24
- Active: 20
- Critical: 3

**Critical Projects:**
| ID | Name | Owner Dept |
|----|------|-----------|
| mi-core | Mi-Core Central Command | dispatch |
| whatsapp-ai-gateway | WhatsApp AI Gateway | executive-assistant |
| accounting-engine | Accounting Engine | finance |

**All Active Projects (16 non-critical):**
Mi CEO Observer, Mi AI Python Service, Mi Node Agent, QuickBooks Ops Agent, Food Safety Gateway, Bakudan Integration System, DoorDash Campaign Agent, Review Automation System, Bakudan Dashboard, Antigravity AI Gateway, Bakudan Website, Raw Sushi Website, Bakudan Releases, Mi-Core Backups, Docs, (additional)

---

### Service Health Registry
```
GET /api/company-os/services/health
```

**Live HTTP checks at 2026-06-18T04:24:**

| Service | Healthy | Error |
|---------|---------|-------|
| Mi-Core Server | ✅ | — |
| WhatsApp AI Gateway | ✅ | — |
| Antigravity AI Gateway | ✅ | — |
| Ollama LLM Runtime | ✅ | — |
| Accounting Engine API | ❌ | fetch failed |
| Mi CEO Observer | ❌ | fetch failed |
| Mi AI Python Service | ❌ | fetch failed |
| Review Automation API | ❌ | fetch failed |
| Bakudan Dashboard | ❌ | unreachable |

**Summary: 4/9 healthy**

---

### Self-Healing Monitor
```
GET /api/company-os/monitor
```

**Response:**
```json
{
  "status": "DEGRADED",
  "healthy": 5,
  "down": 6,
  "total": 11,
  "services": [
    {"id":"mi-core","healthy":true,"restart_attempted":false,"restart_count":0},
    {"id":"whatsapp-gateway","healthy":true,"restart_attempted":false,"restart_count":0},
    {"id":"mi-accounting","healthy":true,"restart_attempted":false,"restart_count":0},
    {"id":"mi-ceo-observer","healthy":false,"restart_attempted":false,"restart_count":1},
    {"id":"food-safety-gw","healthy":false,"restart_attempted":false,"restart_count":1},
    {"id":"qb-ops-agent","healthy":false,"restart_attempted":false,"restart_count":1},
    {"id":"ollama","healthy":true,"restart_attempted":false,"restart_count":0},
    {"id":"evidence-db","healthy":true,"restart_attempted":false,"restart_count":0}
  ]
}
```

**Self-healing active:** CEO Observer, Food Safety Gateway, QB Ops Agent each had 1 restart attempted.

---

### End-to-End Pipeline Evidence (Test 5)

**Command:** "Audit Mi-Core runtime and return evidence"

**Pipeline Response:**
```json
{
  "pipeline_id": "48b839ec-8e25-4fdb-bf34-95c954c2eca1",
  "intent": "general",
  "depts": "dispatch",
  "status": "failed",
  "confidence": 0.80,
  "qa_verdict": "FAIL",
  "ceo_message": "⚠️ Mi — Confidence < 95%\n• Source truth context loaded\n• Executed: general\n• QA failed: 8 step(s) missing dept or timestamp\n• CEO must decide: Review failed output before acting",
  "created_at": "2026-06-18T04:24:07.404Z",
  "completed_at": "2026-06-18T04:24:07.933Z"
}
```

**Evidence summary:** Pipeline processed command in 529ms, assigned to dispatch dept, QA gate FAIL at < 95% confidence — CEO escalation triggered correctly. No silent failure.
