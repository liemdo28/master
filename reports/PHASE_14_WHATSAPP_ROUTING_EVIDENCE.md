# PHASE_14_WHATSAPP_ROUTING_EVIDENCE.md
> Phase 14 — WhatsApp → Asset Registry Routing Evidence
> Date: 2026-06-18

---

## Pipeline Route: WhatsApp → tryAnswerAssetQuery → Asset Registry

```
CEO iPhone → WhatsApp Gateway (3211) → Mi-Core (4001)
→ POST /api/whatsapp/send-test
→ response-pipeline.runPipeline()
→ tryAnswerAssetQuery(message)       ← NEW intercept (Phase 14)
→ isAssetQuery() → regex match
→ require('../company-os/project-registry')
→ Returns structured response, model: 'asset-registry'
```

**Key:** `tryAnswerAssetQuery` fires BEFORE LLM call — verified by `model: 'asset-registry'` in response (not `qwen3:8b`).

---

## Test 1 Evidence — "Project nào?"

**Request:**
```
POST /api/whatsapp/send-test
Body: {"message":"Project nào?","sender":"ceo-test"}
```

**Response:**
```json
{
  "ok": true,
  "message_id": "test-1781756540890",
  "reply": "📋 *Company Projects (20 active / 24 total)*\n\n*🔴 Critical:*\n• Mi-Core Central Command — dispatch\n• WhatsApp AI Gateway — executive-assistant\n• Accounting Engine — finance\n\n*📦 Active:*\n• Mi CEO Observer\n• Mi AI Python Service\n• Mi Node Agent\n• QuickBooks Ops Agent\n• Food Safety Gateway\n• Bakudan Integration System\n• DoorDash Campaign Agent\n• Review Automation System\n• Bakudan Dashboard\n• Antigravity AI Gateway\n• Bakudan Website\n• Raw Sushi Website\n• Bakudan Releases\n• Mi-Core Backups\n• Docs"
}
```

**Verification against directive requirement:**
- ✅ mi-core → Mi-Core Central Command
- ✅ whatsapp-ai-gateway → WhatsApp AI Gateway
- ✅ dashboard.bakudanramen.com → Bakudan Dashboard
- ✅ qb-ops-agent → QuickBooks Ops Agent
- ✅ review-system → Review Automation System
- ✅ Not LLM-generated (no hallucination of Bakudan Ramen / Raw Sushi Bar tasks)

---

## Test 2 Evidence — "Service nào down?"

**Response:**
```
🔍 *Service Health (4/9 healthy)*

🔴 Down:
• Accounting Engine API — fetch failed
• Mi CEO Observer — fetch failed
• Mi AI Python Service — fetch failed
• Review Automation API — fetch failed
• Bakudan Dashboard — unreachable

✅ Online:
• Mi-Core Server
• WhatsApp AI Gateway
• Antigravity AI Gateway
• Ollama LLM Runtime
```

**Source:** `checkAllServicesHealth()` — live HTTP checks, not cached data.

---

## Test 3 Evidence — "Dashboard thuộc phòng nào?"

**Response:**
```
🏢 *Bakudan Dashboard*
Dept: report-center
Mục đích: CEO-facing web dashboard at dashboard.bakudanramen.com. Calls mi-core /api/mi/snapshot.
```

**Source:** `PROJECTS` array in project-registry, fuzzy name match on "dashboard".

---

## Test 4 Evidence — "Toast healthy không?"

**Response:**
```
✅ *Toast POS*
Status: healthy
Credentials: CONFIGURED
```

**Source:** `DATA_SOURCES` in data-source-registry, matched by id "toast", using `last_known_health`.

---

## isAssetQuery() Normalization Proof

Input: `"Project nào?"`

```
toLowerCase()          → "project nào?"
normalize('NFD')       → "project nào?"
strip combining [̀-ͯ]   → "project nao?"
replace đ→d            → no change
strip non-ASCII chars  → no change
result                 → "project nao?"
regex match            → ✅ /\bproject\s*(nao)\b/ → 'projects'
```

Node.js direct verification:
```
normalized: "project nao?"
matches: true
```
