# Role Agent System
**Date:** 2026-06-13  
**Location:** `src/gstack/role-agents/`

---

## 7 Roles

### 1. CEO Interpreter (`ceo-interpreter.ts`)
- **Responsibility:** Translate raw CEO Vietnamese → structured scope
- **Output:** `InterpretResult` — understood request, scope list, language, confidence
- **Critical check:** Clarifications needed (stops pipeline if unclear)
- **Example:** "Mi ơi, kiểm tra Dashboard" → `{ intent: 'audit_project', target: 'dashboard', scope: ['scan source', 'identify errors', ...] }`

---

### 2. Product Manager (`product-manager.ts`)
- **Responsibility:** Define acceptance criteria; compile final CEO-facing report
- **Output:** Vietnamese WhatsApp message + full markdown report
- **Report location:** `reports/gstack/WO-YYYYMMDD-NNN.md`
- **Rules:** Always Vietnamese for CEO summary. Never expose raw stack traces.

---

### 3. Engineering Manager (`engineering-manager.ts`)
- **Responsibility:** Break work into technical tasks; execute safe (L1) tasks
- **Auto-executes:**
  - Source directory listing (8s timeout)
  - PM2 jlist
  - Error log scan
  - TypeScript compile check
- **Does NOT auto-execute:** deploys, restarts, file writes (requires release_agent + approval)

---

### 4. Developer Agent
- **Responsibility:** Code changes (safe patches only, never destructive)
- **Current capability:** Planned for Phase 2 of GStack implementation
- **Constraint:** All changes require auditor_agent verification before delivery

---

### 5. QA Agent (`qa-agent.ts`)
- **Responsibility:** Run all quality checks. No agent can claim DONE without QA Agent certification.
- **Checks run:**
  - `QA1` Regression suite (10 CEO WhatsApp cases) — in-process via `processJarvisQuery`
  - `QA2` No P0 open issues (PM2 crash-loop detection)
  - `QA3` Service health check (mi-core, whatsapp-gateway, antigravity)
  - `QA5` Build compiles (tsc --noEmit) — for deploy intents
- **Verdict scale:** PASS / PARTIAL / FAIL

---

### 6. Release Agent (`release-agent.ts`)
- **Responsibility:** Deployment readiness; rollback planning; PM2 restart execution
- **Pre-deploy checklist:**
  - QA gate cleared
  - PM2 process exists
  - dist/ build present
  - Rollback plan documented
- **All deployments:** Risk Level 3 — requires CEO approval

---

### 7. Auditor Agent (`auditor-agent.ts`)
- **Responsibility:** Independent verification. Rejects PASS reports without sufficient evidence.
- **Evidence rules (5 checks):**
  1. QA sweep must have run (BLOCKING)
  2. No crash-looping for deploy intents (BLOCKING for deploy, non-blocking for audit)
  3. At least 2 services healthy (BLOCKING)
  4. Regression suite pass for personality changes (non-blocking)
  5. Execution log from ≥2 agents (non-blocking)
- **Verdicts:** CERTIFIED / CONDITIONAL_PASS / REJECTED
- **Source scan:** Scans project files for TODO/FIXME, hardcoded credentials, missing error handling
- **Certification ID:** `CERT-WO-YYYYMMDD-NNN-XXXXXXXX` (issued on CERTIFIED or CONDITIONAL_PASS)

---

## Agent Pipeline Sequence (Full)

```
CEO Request
    │
    ▼
[tryGStack] — shouldUseGStack()? No → falls to personality engine
    │ Yes
    ▼
createWorkOrder() ─── WO-YYYYMMDD-NNN created
    │
    ▼ (parallel)
[CEO Interpreter] + [Engineering Manager]
    │
    ▼ (sequential)
[QA Agent] — runs health + regression + P0 + build checks
    │
    ▼
[Auditor Agent] — verifies evidence, issues cert or rejects
    │
    ▼ (if deploy)
[Release Agent] — readiness check, rollback plan
    │
    ▼
[Product Manager] — compile CEO report (Vietnamese)
    │
    ▼
WO status: delivered / approval_pending
```
