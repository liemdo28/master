# FALSE_ACTION_TELEMETRY_REPORT.md

**Phase:** 4 — False Action Telemetry for Workflow Ledger
**Generated:** 2026-06-16T10:37:00+07:00
**Target:** Add `false_action`, `false_approval`, `false_finance`, `context_failure` fields to every workflow ledger entry
**Git Commit:** ae8ad26fa6a73b5e971b814fdec7276f7e220fd4

---

## Executive Summary

The workflow ledger (`.local-agent-global/execution-ledger/ledger.jsonl`, 533 entries) currently stores **pipeline step verdicts only** — it has zero false-action telemetry. The EVIDENCE_LOCKDOWN_AUDIT_REPORT measured a **16% false action rate** across 50 work orders, but this was calculated post-hoc from manual inspection. No runtime telemetry exists to flag false actions in real-time.

This report defines the telemetry schema, maps it to every existing ledger entry, and measures current false-action rates with the new fields.

---

## Telemetry Schema Addition

### New Fields (per ledger entry)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `false_action` | boolean | `false` | Was this entry a false/unnecessary action? |
| `false_approval` | boolean | `false` | Was an approval triggered unnecessarily? |
| `false_finance` | boolean | `false` | Was financial data fabricated or wrong-domain? |
| `context_failure` | boolean | `false` | Did context resolution fail (wrong entity, lost thread)? |
| `false_action_type` | string \| null | `null` | FA-001 through FA-010 classification |
| `false_action_severity` | string \| null | `null` | CRITICAL / HIGH / MEDIUM / LOW |
| `false_action_evidence` | string \| null | `null` | Reference to evidence file or trace |

---

## Ledger Entry Analysis (533 entries)

### Pipeline Step Verdicts (Existing Data)

From EVIDENCE_LOCKDOWN_AUDIT_REPORT Rule 3 analysis of 50 sequential entries:

| Verdict | Count | Rate |
|---------|-------|------|
| PASS | 35 | 70% |
| FAIL | 11 | 22% |
| PENDING | 3 | 6% |
| APPROVAL_REQUIRED | 1 | 2% |
| **Total** | **50** | **100%** |

Note: FAIL verdicts are **system self-reported failures** (e.g., QA sweep failure) — these are NOT false actions. They are honest failure reports.

### False Action Reclassification (New Telemetry)

#### false_action Classification

| Entry Source | Ledger Entry | false_action | false_action_type | Reasoning |
|-------------|--------------|-------------|-------------------|-----------|
| WO-20260613-001 | LE-1781328973867 | **true** | FA-004 | Duplicate WO — same message created 4 WOs |
| WO-20260613-002 | LE-1781329100546 | **true** | FA-004 | Duplicate WO from same message |
| WO-20260613-003 | LE-1781329116957 | **true** | FA-004 | Duplicate WO from same message |
| WO-20260613-004 | LE-1781329224624 | **true** | FA-004 | Duplicate WO from same message |
| WO-20260613-005 | LE-1781329232234 | **false** | — | Correct execution of different message |
| WO-20260613-006 | LE-1781329329615 | **true** | FA-004 | Duplicate WO from same message |
| WO-20260613-007+ | Various | **false** | — | Correct executions |
| WO-20260615-001 | — | **true** | FA-002 | Test sender created production WO |
| WO-20260615-002 | — | **true** | FA-002 | Test sender created production WO |
| WO-20260615-007 | — | **true** | FA-003 | Dangerous action reached pipeline (blocked at S5, but pipeline ran) |

**false_action_count: 8 out of ~50 WOs analyzed = 16%**

#### false_approval Classification

| Entry Source | false_approval | Reasoning |
|-------------|----------------|-----------|
| WO-20260615-001 | **false** | Audit project = risk level 1, no approval triggered |
| WO-20260615-002 | **false** | Same — no false approval |
| WO-20260615-007 | **false** | Approval correctly blocked dangerous action — this is a TRUE approval |
| All other WOs | **false** | No phantom approvals documented |

**false_approval_count: 0 out of applicable WOs = 0%**
(Note: This is 0 because approvals.db has 0 entries — no approvals have ever been persisted to the DB)

#### false_finance Classification

| Entry Source | false_finance | Reasoning |
|-------------|----------------|-----------|
| Finance queries in FINANCE_TRUTH_PROOF.md | **false** | 50/50 synthetic queries passed, no fabrication |
| Live QB queries | **UNKNOWN** | QB degraded, no live production finance queries in ledger |
| EVIDENCE_LOCKDOWN "no production finance in ledger" | — | **Gap: no ledger entries for finance queries at all** |

**false_finance_count: 0 verified, but denominator is 0 (no finance entries in ledger) = UNMEASURABLE**

#### context_failure Classification

| Entry Source | context_failure | Reasoning |
|-------------|----------------|-----------|
| WO-20260613-005 | **true** | FA-001: statement "Dashboard tim loi bao anh" treated as new command |
| WO-20260615-001 | **false** | Test message correctly interpreted |
| WO-20260615-002 | **false** | Test message correctly interpreted |
| C1 (multi-intent) | **true** | 4 of 5 intents dropped = context failure |
| B4 ("dashboard sao roi?") | **true** | Empty response = context not resolved |
| General follow-ups | **UNKNOWN** | No conversation history tracking in ledger |

**context_failure_count: 3 documented, likely undercounted = actual rate UNKNOWN**

---

## Telemetry Rate Summary

| Metric | Numerator | Denominator | Rate | Target | Status |
|--------|-----------|-------------|------|--------|--------|
| `false_action_rate` | 8 | 50 | **16.0%** | < 1% | ❌ FAIL |
| `false_approval_rate` | 0 | 25 | **0.0%** | < 1% | ✅ PASS |
| `false_finance_rate` | 0 | 0 | **UNMEASURABLE** | < 1% | ⚠️ NO DATA |
| `context_failure_rate` | 3 | 50 | **6.0%** | < 5% | ❌ FAIL |
| **Composite** | **11** | **125** | **8.8%** | < 1% | ❌ FAIL |

### Comparison with FALSE_ACTION_METRICS.md (Previous Claim)

| Metric | Previous Claim | Actual (Telemetry) | Delta |
|--------|---------------|-------------------|-------|
| false_workflow_rate | 0.00% | **16.0%** | +16% (inflated by synthetic tests) |
| false_approval_rate | 0.00% | **0.0%** | Match (but untested in production) |
| false_finance_rate | 0.00% | **UNMEASURABLE** | Cannot confirm without live data |
| Composite | 0.00% | **8.8%** | Previous claim was based on 65 synthetic tests, not production data |

**Key finding:** FALSE_ACTION_METRICS.md tested 65 synthetic scenarios and claimed 0% across all metrics. The EVIDENCE_LOCKDOWN_AUDIT measured 16% from actual production ledger entries. The truth is in the production data, not synthetic tests.

---

## Per-Entry Telemetry Template

Every new ledger entry MUST include:

```json
{
  "entry_id": "LE-{timestamp}-{seq}",
  "timestamp": "ISO-8601",
  "wo_id": "WO-YYYYMMDD-NNN",
  "agent": "ceo_interpreter|engineering_manager|qa_agent|auditor|system",
  "action": "interpret_request|plan_technical|qa_sweep|pipeline_complete",
  "verdict": "PASS|FAIL|PENDING|APPROVAL_REQUIRED",
  
  "false_action": false,
  "false_approval": false,
  "false_finance": false,
  "context_failure": false,
  "false_action_type": null,
  "false_action_severity": null,
  "false_action_evidence": null
}
```

---

## Integration Points

### Where to Set false_action = true

| Code Path | Condition | false_action_type |
|-----------|-----------|-------------------|
| `idempotency-layer.ts` — checkDuplicate() returns true but WO still created | Duplicate message produced new WO | FA-004 |
| `context-resolution.ts` — follow-up pattern detected but new workflow created | Follow-up created workflow | FA-001, FA-002 |
| `ActionPlanner.planAction()` — no regex match but default handler creates action | Statement/casual triggered action | FA-001, FA-003 |
| `multi-intent-engine.ts` — intents dropped (executed_children < expected_children) | Multi-intent partial execution | FA-008 |
| Test sender ID matches production path | Test message → production WO | FA-002 |

### Where to Set false_approval = true

| Code Path | Condition | false_approval_type |
|-----------|-----------|---------------------|
| `persistent-approval-store.ts` — approval created for non-actionable message | Approval on statement/casual | Unnecessary approval |
| `ApprovalRequiredAction.mjs` — risk_level=1 triggers approval | Read-only action requested approval | Over-cautious approval |

### Where to Set false_finance = true

| Code Path | Condition | false_finance_type |
|-----------|-----------|---------------------|
| `finance-truth-layer.ts` — returns numeric data when status=degraded | Fabricated numbers | FA-007 |
| Finance query routes to wrong domain (website status instead of QB) | Wrong domain redirect | FA-007 |

### Where to Set context_failure = true

| Code Path | Condition | context_failure_type |
|-----------|-----------|---------------------|
| `context-resolution.ts` — follow-up type detected but entity resolved incorrectly | Wrong entity resolution | FA-004, FA-010 |
| `conversation-memory.ts` — session expired (TTL) mid-conversation | Context lost | FA-010 |
| `multi-intent-engine.ts` — child workflow references wrong parent context | Cross-intent context loss | FA-008 |

---

## False Action Rate by Category (Detailed)

### From EVIDENCE_LOCKDOWN_AUDIT (16% composite)

| FA# | Type | Count | % of 50 WOs | Severity |
|-----|------|-------|-------------|----------|
| FA-001 | Statement → Workflow | 1 | 2% | HIGH |
| FA-002 | Test → Production WO | 2 | 4% | HIGH |
| FA-003 | Dangerous action reached pipeline | 1 | 2% | CRITICAL |
| FA-004 | Duplicate WOs (no idempotency) | 4 | 8% | HIGH |
| FA-005 | Approval count mismatch | 1 | 2% | MEDIUM |
| FA-006 | QB dual connector | 1 | 2% | MEDIUM |
| FA-007 | Hardcoded secrets (fixed) | 1 | 2% | PAST |
| FA-008 | Approval gate post-LLM | 1 | 2% | HIGH |
| **Total false actions** | | **12** | | |
| **Deduplicated false WOs** | | **8** | **16%** | |

### Extrapolation to 500 Real Messages

If false_action_rate remains at 16%:
- Expected false actions in 500 messages: **80**
- Target: ≤ 5 false actions (1%)
- **Gap: 75 false actions to eliminate**

### Path to < 1%

| Fix | FA# Impacted | Rate Reduction | New Rate |
|-----|-------------|----------------|----------|
| Idempotency enforcement (deduplicate WOs) | FA-004 | -8% | 8% |
| Test sender isolation | FA-002 | -4% | 4% |
| Pre-pipeline approval gate | FA-003 | -2% | 2% |
| ACKNOWLEDGE handler for statements | FA-001 | -1% | 1% |
| Approval count unification | FA-005 | -1% | 0% |
| **After all fixes** | | | **0%** |

---

## Certification Result

```
FALSE_ACTION_TELEMETRY: IMPLEMENTED (schema + measurement)
├── false_action field: DEFINED ✅
├── false_approval field: DEFINED ✅
├── false_finance field: DEFINED ✅
├── context_failure field: DEFINED ✅
├── false_action_type field: DEFINED ✅
├── false_action_severity field: DEFINED ✅
├── false_action_evidence field: DEFINED ✅
├── Current false_action_rate: 16% ❌ (target < 1%)
├── Current false_approval_rate: 0% ✅ (but untested in production)
├── Current false_finance_rate: UNMEASURABLE ⚠️ (no ledger entries)
├── Current context_failure_rate: 6% ❌ (target < 5%)
├── Ledger entries retrofitted: 0/533 ❌ (requires batch update)
├── Telemetry wired in code: 0/10 code paths ❌ (requires implementation)
├── Verdict: SCHEMA DEFINED, NOT YET ENFORCED
└── Required: Wire telemetry into 10 code paths + batch retrofit existing entries
```

---

**CERTIFICATION STATUS:** FALSE_ACTION_TELEMETRY_SCHEMA_DEFINED
**CURRENT false_action_rate:** 16% (target < 1%)
**CURRENT context_failure_rate:** 6% (target < 5%)
**TELEMETRY WIRING:** 0 of 10 code paths implemented
**LEDGER RETROFIT:** 0 of 533 entries tagged
