# EVIDENCE_GATE_CERTIFICATION.md
> Phase 4 — Evidence Gate (Updated from Phase 1)
> Date: 2026-06-18
> Target: QA_GATE_OPERATIONAL

---

## Phase 4 Additions

| Addition | Status |
|----------|--------|
| Evidence chain completeness check (dept_id + started_at) | ✅ Check 10 in qa-gate.ts |
| QA verdict written to all steps via setQaVerdict() | ✅ |
| Regression risk scan on all step outputs | ✅ Check 9 |
| Source truth validation vs VALID_DEPARTMENTS | ✅ Check 7 |
| Business requirement alignment check | ✅ Check 8 |

---

**Phase:** 4 — Evidence Gate (Full)
**Generated:** 2026-06-18
**Audit Method:** Full code trace of all execution paths
**Target:** EVIDENCE_GATE_ENFORCED
**Verdict:** EVIDENCE_GATE_PARTIAL — NOT YET ENFORCED

---

## Audit Scope

Every response Mi produces must pass through SOURCE → EVIDENCE → DECISION → ACTION.
This audit verifies whether the Evidence Gate is actually enforced across all execution paths.

---

## Execution Paths Audited

### Path 1: ActionPlanner.mjs (WhatsApp Intent → Action)
| Step | Evidence Gate Present? | Status |
|------|----------------------|--------|
| Intent classification (regex) | No classification step | MISSING |
| Action planning | No evidence check before plan | MISSING |
| Response generation | No evidence tag attached | MISSING |

**Finding:** ActionPlanner.mjs jumps directly from regex match → action execution. There is no `classifyEvidence()` call anywhere in this path. The Evidence Gate described in `EVIDENCE_GATE_REPORT.md` is NOT wired into the local-agent action layer.

### Path 2: DashboardVisibilityConnector.mjs (Dashboard Data)
| Step | Evidence Gate Present? | Status |
|------|----------------------|--------|
| Live status check | `ping()` function checks reachability | ✅ CONFIRMED |
| Cache fallback | `getCacheSnapshot()` reads cache + age | ✅ STALE detected |
| Response | Includes `source: 'cache'` + `warning` field | ✅ Classification present |

**Finding:** Dashboard connector correctly classifies data freshness. When live is down and cache exists, it returns `warning: 'Using cached data'`. This is the ONLY connector with proper evidence classification.

### Path 3: ConnectorRegistry.mjs (Platform Connectors)
| Connector | auth_status | health_status | Evidence State |
|-----------|------------|---------------|----------------|
| local-projects | connected | healthy | CONFIRMED |
| dashboard-bakudan | connected | unknown | UNCONFIRMED |
| asana | not_configured | unknown | MISSING |
| gmail | not_configured | unknown | MISSING |
| google-calendar | not_configured | unknown | MISSING |
| google-drive | not_configured | unknown | MISSING |
| health-export | not_configured | unknown | MISSING |
| website-raw | connected | unknown | UNCONFIRMED |
| website-bakudan | connected | unknown | UNCONFIRMED |
| integration-system | connected | unknown | UNCONFIRMED |
| whatsapp-api | connected | unknown | UNCONFIRMED |

**Finding:** 5 of 11 connectors are MISSING. 5 of 6 connected connectors have unknown health. Only 1 (local-projects) is CONFIRMED healthy.

### Path 4: DecisionMemory.mjs (CEO Decision Context)
| Step | Evidence Gate Present? | Status |
|------|----------------------|--------|
| Load decisions | JSON file read | No freshness check |
| Search | Text match only | No evidence tag |
| Add decision | Timestamp added | No classification |

**Finding:** Decision memory stores timestamps but never classifies evidence freshness. Stale decisions can be served as current.

### Path 5: WebsiteActionService.mjs (Content Publishing)
| Step | Evidence Gate Present? | Status |
|------|----------------------|--------|
| Create draft | Draft saved to file | No image existence check |
| Approval gate | ApprovalRequiredAction wraps | No evidence verification |
| Publish status | Returns 'pending_approval' | No file verification |

**Finding:** FALSE_DECISION_REPORT #3 confirmed: no `existsSync()` check before claiming "image ready." The content publishing path has NO evidence gate.

### Path 6: Server-Side Evidence Gate (Documented)
The Evidence Gate code exists at `server/src/jarvis/phase30-jarvis/evidence-gate.ts`:
- `classifyEvidence()` function — properly implements CONFIRMED/UNCONFIRMED/MISSING/STALE
- Freshness thresholds defined (finance: 24h, dashboard: 1h, tasks: 4h)
- Block logic for MISSING + numeric data

**Finding:** The code is documented but integration evidence is missing. The pipeline position `Intent Router → Evidence Gate → Decision Gate → Response Builder → Send` is described but NOT verified in actual server route files.

---

## Evidence Classification Across All Sources

| Source | Data Available? | Fresh? | Checksum? | Correct Classification |
|--------|----------------|--------|-----------|----------------------|
| QB Finance | Stale (>24h) | No | Yes | STALE |
| Dashboard | Cache available | Minutes | No | UNCONFIRMED |
| Tasks | Unknown | Unknown | No | UNCONFIRMED |
| Memory | File-based | Always current | No | CONFIRMED |
| Contacts | File-based | Always current | No | CONFIRMED |
| Websites | Local repos | Unknown | No | UNCONFIRMED |
| Gmail | Not connected | N/A | N/A | MISSING |
| Calendar | Not connected | N/A | N/A | MISSING |
| Drive | Not connected | N/A | N/A | MISSING |
| Health | Not connected | N/A | N/A | MISSING |
| Asana | Not connected | N/A | N/A | MISSING |

---

## Critical Evidence Gate Failures

### F1: ActionPlanner Bypasses Evidence Gate
**Code Path:** `ActionPlanner.planAction()` → regex match → direct execution
**Expected:** `planAction()` → `classifyEvidence()` → check classification → proceed/block
**Impact:** Any action can execute without evidence verification

### F2: Finance Truth Returns Fabricated Numbers
**Evidence:** FINANCE_TRUTH_CERTIFICATION.md — 2 of 20 queries returned fabricated answers
**Code Path:** Finance source unavailable → LLM completion layer fills in numbers
**Impact:** CEO receives false financial data

### F3: No File Existence Verification for Content
**Code Path:** `WebsiteActionService.createDraft()` → saves schedule → no `existsSync()`
**Impact:** CEO told "image ready" when image doesn't exist

### F4: DecisionMemory Never Refreshes
**Code Path:** `DecisionMemory.getRecent()` → reads JSON → returns as-is
**Impact:** Old decisions presented as current context

---

## Acceptance Criteria Audit

| Criterion | Required | Actual | Pass? |
|-----------|----------|--------|-------|
| Every response carries evidence classification tag | Yes | No — only Dashboard connector does this | ❌ |
| MISSING classification blocks ALL numeric responses | Yes | Partially — finance layer blocks but LLM can override | ❌ |
| STALE classification triggers mandatory freshness warning | Yes | Only in Dashboard connector | ❌ |
| Unclassified responses are rejected by pipeline | Yes | No enforcement found | ❌ |
| Evidence classification is logged for audit trail | Yes | ActionAuditLog exists but doesn't log evidence class | ❌ |
| False CONFIRMED rate ≤ 1% | Yes | Unknown — not tested | ❌ |
| False MISSING rate ≤ 1% | Yes | Unknown — not tested | ❌ |

---

## Certification Result

```
EVIDENCE_GATE_CERT: PARTIAL
├── Classification logic: DESIGNED ✅ (evidence-gate.ts)
├── Classification enforcement: NOT WIRED ❌ (ActionPlanner bypasses)
├── All responses tagged: NO ❌
├── Numeric block on MISSING: PARTIAL ⚠️
├── Freshness warning on STALE: PARTIAL ⚠️
├── Audit trail: MISSING ❌
└── Verdict: NOT ENFORCED

Required for ENFORCED:
1. Wire classifyEvidence() into ActionPlanner.planAction()
2. Add evidence classification to EVERY response path
3. Block numeric output when classification = MISSING
4. Add evidence class to ActionAuditLog entries
5. Verify server pipeline actually runs Evidence Gate before Response Builder
```

---

**CERTIFICATION STATUS:** EVIDENCE_GATE_PARTIAL
**GATE STATUS:** BLOCKED — Cannot certify production readiness without evidence enforcement
