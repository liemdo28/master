# MI MASTER — PHASE 1 AUDIT COMPLETE (Continuation Document)
**Append to:** `MI_MASTER_ARCHITECTURE_AUDIT.md` and `MI_MASTER_ARCHITECTURE_AUDIT_CONTINUATION.md`

---

## 7. OPEN-SOURCE INTEGRATION AUDIT

The prompt lists ~40 open-source repos to evaluate. Before evaluating, audit existing implementations:

| Project | Category | Current Equivalent | Recommendation |
|---------|----------|-------------------|----------------|
| spec-kit (GitHub) | spec/workflow | `game-division/` + `company-os/` have built-in spec | EVALUATE: check if spec-kit adds unique value |
| openai/skills | skills | `gstack/skills/` already exists | EVALUATE |
| cocoindex | code understanding | Not currently integrated | EVALUATE |
| engram | memory | `operational-memory/` + `self-improving-memory/` exist | EVALUATE |
| headroom | UI governance | Not integrated | EVALUATE |
| auto-browser | browser control | `browser/` + Playwright agents exist | EVALUATE |
| goose (aaif-goose) | coding worker | Not integrated | BENCHMARK ONLY |
| OpenHands | coding worker | Not integrated | BENCHMARK ONLY |
| LocalAI | local AI | Ollama already running (qwen3:8b/14b) | NO CHANGE NEEDED |

**Rule:** Do NOT clone open-source repos into mi-core directly. All integrations must use adapters.

---

## 8. MIGRATION PLAN (Priority Order)

### Phase A — MUST DO FIRST (unblocks all others)
1. **Start Mi-Core + WhatsApp Gateway** — PM2 restart. This is the P0 blocker.
   - `cd mi-core && pm2 startOrRestart ecosystem.config.js`
   - Verify: `curl http://127.0.0.1:4001/api/health`
   - Verify WhatsApp: check session status at `services/whatsapp-ai-gateway/`

### Phase B — CRITICAL GAPS (enable CEO workflow)
2. **Implement repair loop** — `game-orchestrator.ts` needs:
   - On QA FAIL: return structured `QA_REPORT.json` to Game Dept
   - Game Dept fixes specific issues listed in report
   - Build v2 → submit to QA again
   - Loop until score ≥ 95% or escalation
3. **Refactor QA as independent call** — extract `runGameQA()` out of orchestrator, make it a callable HTTP service or direct import with clear contract
4. **Add job state machine** — `job-state.json` with 18 states, versioned builds (builds/v1, v2...)
5. **Implement ArtifactContract** — backend returns structured object, not string
6. **Implement ChatMi artifact card** — UI renders Play/Report/Publish buttons from contract
7. **Add spec step** — before build, generate `specification.md` with acceptance criteria

### Phase C — IMPROVEMENTS (non-blocking)
8. **Escalation/loop protection** — cycle counter, cycle-3 warning, CEO decision at cycle-5
9. **Report Department** — `reporting-department.ts` generates FINAL_REPORT.json/md/QA_SUMMARY.json
10. **Job timeline API** — observability endpoint + AgenView panel
11. **Auth fix investigation** — audit old dist + mi-chat.html auth layer
12. **Idempotency** — job locks in chat router

### Phase D — OPEN-SOURCE INTEGRATION (after Phase B+C validated)
13. Evaluate each listed open-source project against existing implementations
14. Add adapters for approved projects — never embed directly in mi-core
15. Create governance records in `_governance/`

### Phase E — CLEANUP (after Phase A verified safe)
16. Run cleanup plan (see MASTER_CLEANUP_PLAN.md)
17. Archive stale directories (root `server/`, `ui/`, `mi-core/mi-core/`, nested repos)

---

## 9. RISK MATRIX

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PM2 restart fails | Medium | Critical | Check dist/ compiled, check port conflicts |
| WhatsApp session expired | Medium | High | Re-auth via WhatsApp web QR flow |
| Moving mi-core files breaks imports | High | Critical | DO NOT move files — logical organization only |
| Open-source integration breaks existing QA | Medium | High | Test with QA disabled before enable |
| Nested git repos cause conflicts | Low | Medium | Quarantine inner copies before action |
| Cleaning logs loses audit trail | Low | High | Archive before delete, verify evidence preserved |
| Auth fix weakens security | Low | Critical | Never bypass auth — only fix session persistence |

---

## 10. ROLLBACK PLAN

| Action | Rollback Method |
|--------|----------------|
| PM2 restart | `pm2 kill && git checkout <old_commit> && pm2 start` |
| Game orchestrator changes | `git checkout HEAD -- game-orchestrator.ts` |
| New QA service | Disable flag → revert to inline QA call |
| Artifact contract | Revert chat route to history-extraction logic |
| Open-source adapter | Set `ENABLED=false` env flag |
| File deletions | All deletions go to `_quarantine/<date>/` first, permanent delete after 30 days |

---

## 11. AUTH FIX INVESTIGATION FINDINGS

**"Unauthorized — login with PIN"** error string:
- Searched `mi-core/server/src/` — **NOT FOUND** in TypeScript source
- Searched `mi-core/` (full) — **NOT FOUND** anywhere in source
- Likely source: old compiled `dist/` files, or `mi-chat.html` / `mobile.html` web UI auth layer
- Chat route (`routes/chat.ts`) has **NO auth middleware** — the POST /api/chat endpoint is completely open (no session check, no PIN, no cookie)
- The "Unauthorized — login with PIN" message is NOT in the TypeScript source — it may come from:
  - Old compiled dist/ (if server hasn't been recompiled after auth removal)
  - Web UI files (`mobile.html`, `mi-chat.html`) — which may have their own auth check
  - WhatsApp Gateway (separate process on 3211)
- Next step: check `mi-core/ui/mobile.html` and `mi-core/services/whatsapp-ai-gateway/` for auth logic, and verify `dist/` vs `src/` alignment

---

## 12. MANDATORY CEO WORKFLOW — WHAT MUST WORK

The mandatory "Mi ơi, tạo 1 game Flappy Bird." flow with full QA loop:

```
CEO (WhatsApp/iPhone)
    ↓
WhatsApp Gateway (3211) → Mi-Core (4001)
    ↓
intent-router.ts: classifyIntent("tạo game Flappy Bird") → "create_game" / game department
    ↓
game-orchestrator.ts: orchestrateGameTask()
    ├── SPEC STEP: generate specification.md (acceptance criteria)
    ├── BUILD v1: executeGame() → HTML5 game file
    ├── JOB STATE: RECEIVED → SPECIFYING → BUILDING → DEPARTMENT_TESTING
    ├── QA SUBMIT: runGameQA() [NOW: independent call, not inline]
    │   → Job state: SUBMITTED_TO_QA → QA_RUNNING
    │
    ├── QA RESULT: score >= 95, blockers == 0
    │   → Game Dept: DELIVERED
    │   → ArtifactContract returned
    │   → Report Dept generates FINAL_REPORT.json/md
    │   → Job state: REPORTING → READY_FOR_CEO
    │   → Mi response: "Game Flappy Bird đã hoàn thành và đạt QA 97%..."
    │   → ChatMi: artifact card with Play/Report/Publish buttons
    │
    └── QA RESULT: score < 95 OR blockers > 0
        → Job state: REVISION_REQUIRED
        → QA Dept returns structured QA_REPORT.json:
        │   {
        │     "job_id": "JOB-...",
        │     "build_version": "v1",
        │     "score": 88,
        │     "threshold": 95,
        │     "status": "revision_required",
        │     "critical_blockers": [],
        │     "failed_checks": [...]
        │   }
        → Game Dept reads report, generates fix plan
        → BUILD v2: fixes specific issues
        → DEPARTMENT_TESTING
        → QA RE-TEST
        → Loop until score >= 95 or escalation (cycle 5)
        → Cycle 3: escalation warning to CEO
        → Cycle 5: CEO decision gate (Senior Dev or CEO decides: continue or abort)
```

---

## 13. REQUIRED TEST SCENARIOS

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| A: Direct pass | CEO → Flappy Bird → QA ≥95% first attempt | Artifact card delivered |
| B: Repair loop | Introduce controlled defect → QA <95% → fix → retest | v3 achieves ≥95% |
| C: Critical blocker | QA blocks despite numeric score (invalid URL) | Department repairs, QA passes |
| D: Auth | Valid session: success; expired: safe fail; re-login: restores | No unauthorized access |
| E: External down | Ollama offline during game build | Controlled error, no crash |
| F: Restart | PM2 restart mid-job | Job state recovered from job-state.json |

---

## 14. FINAL DECISION: PHASES vs IMPLEMENTATION STATUS

### WHAT EXISTS (verified working):
- Intent router with Vietnamese NLP ✅
- 20 departments with dispatch ✅
- Game worker (LLM → HTML5) ✅
- QA agent with weighted scoring ✅
- Approval gate ✅
- SQLite conversation store ✅
- Ollama model routing ✅

### WHAT IS MISSING (P0 gaps):
- No repair loop ❌
- QA inline not independent ❌
- No versioned builds ❌
- No job state machine ❌
- No artifact card ❌
- Services DOWN ❌

### FINAL GATE: GO or NO-GO

**Status: NO-GO for live CEO workflow**

Reason: P0 — Mi-Core and WhatsApp Gateway are NOT RUNNING. The mandatory CEO→Mi workflow cannot be tested. Additionally, the core P0 gaps (repair loop, independent QA, versioned builds, artifact card) are not implemented.

**Path to GO:**
1. Start services (Phase A) — verify live
2. Implement repair loop (Phase B) — enables mandatory workflow
3. Test Scenarios A+B from table above
4. Document evidence in `MI_RUNTIME_VALIDATION.md`
5. Final gate review

**Files produced in this audit session:**
- `MI_MASTER_BASELINE_20260706_0948/` — 11 evidence files
- `MI_MASTER_ARCHITECTURE_AUDIT.md` — architecture, gaps, preserve list
- `MI_MASTER_ARCHITECTURE_AUDIT_CONTINUATION.md` — target structure, duplicates
- `MI_MASTER_ARCHITECTURE_AUDIT_PHASE2.md` — migration plan, risk, rollback, auth findings, test plan, gate decision

