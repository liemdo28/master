# SOURCE_TRUTH_BURNIN_REPORT.md

## CEO Directive: SOURCE_TRUTH_STABILITY_CERTIFICATION

## PHASE 4 — BURN-IN INTEGRATION

**Classification:** CEO EYES ONLY — OPERATIONAL CERTIFICATION

**Test Status:** 🔴 NOT STARTED — REQUIRES ENGINEERING IMPLEMENTATION

**Purpose:** Integrate Source Truth metrics into the existing Burn-In monitoring system and make stability tracking continuous.

---

## Executive Summary

Source Truth is not a one-time certification — it's a **continuous operation**. Phase 4 integrates Source Truth metrics into the burn-in monitor so that every CEO interaction is tracked, measured, and alerted in real-time.

This is the difference between "we passed a test" and "we know our current status."

---

## Critical Finding: Existing Burn-In is Broken

From DEV4's `BURNIN_MONITOR_VALIDATION_REPORT.md` (2026-06-15):

| Metric | Claimed | Actual | Status |
|--------|---------|--------|--------|
| M1 Restart | ~good | 1162 lifetime restarts, crash loops on Jun 13-14 | INFLATED |
| M2 Memory | VALID | VALID (conversations.db, KB, federated) | OK |
| M3 Workflow | 81.3% | 0% (no execution ledger found) | FABRICATED |
| M4 Approval | VALID | PARTIAL (count mismatch: 0 vs 19) | INFLATED |
| M5 Connector Truth | VALID | PARTIAL (wrong route prefix) | INFLATED |

**Original Score: 66.5/100 → Corrected: 57.5/100**

**Three of five metrics are inflated.** The burn-in monitor was reporting good health when reality was failing.

Phase 4 must fix this. Source Truth must be built into the foundation, not bolted on.

---

## Source Truth Metrics for Burn-In

### New Metrics (M6-M9)

These Source Truth metrics must be added to the burn-in monitor alongside the existing M1-M5:

| Metric | Name | Description | Source | Target | Alert |
|--------|------|------------|--------|--------|-------|
| M6 | false_action_rate | % CEO messages triggering false workflows | Execution ledger | 0% | >0% |
| M7 | false_approval_rate | % approval triggers without evidence | Approval store | 0% | >0% |
| M8 | finance_truth_violations | % finance queries returning fabricated data | Finance truth lock log | 0% | >0% |
| M9 | context_resolution_failures | % multi-turn conversations losing context | Conversation tracking | <5% | >5% |

### Updated Burn-In Scoring

```
TOTAL SCORE = (M1×0.15 + M2×0.15 + M3×0.20 + M4×0.15 + M5×0.15 + M6×0.20) / 6 × 100
```

| Component | Weight | Description |
|-----------|--------|-------------|
| M1 Restart | 15% | PM2 stability |
| M2 Memory | 15% | Persistence layer |
| M3 Workflow | 20% | Execution success (FIXED — was inflated) |
| M4 Approval | 15% | Approval accuracy |
| M5 Connector Truth | 15% | Data source health |
| M6 Source Truth | 20% | FALSE ACTION RATE |

### Pass/Fail Thresholds

| Score Range | Status | Action |
|-------------|--------|--------|
| 95-100 | SOURCE_TRUTH_STABLE | Monitor only |
| 85-94 | ACCEPTABLE | Weekly review |
| 70-84 | WARNING | Daily review + CEO alert |
| <70 | CRITICAL | Immediate fix + CEO notification |

---

## Data Collection Infrastructure

### Execution Ledger Schema

Every CEO message → system action must be logged:

```typescript
interface ExecutionRecord {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  ceoMessageHash: string;        // SHA-256 of original
  whatsappMessageId: string;     // WhatsApp's message ID
  intents: Intent[];            // Detected intents
  actions: Action[];             // Actions taken
  financeDataUsed: boolean;      // Was finance data involved?
  financeSource: string;         // Which connector (QB/Sheets/etc)
  evidenceAttached: boolean;    // Screenshot/JSON included?
  approvalTriggered: boolean;    // Approval gate activated?
  approvalGiven: boolean;        // CEO approved?
  falseAction: boolean;          // Was this a false action?
  falseActionCode: string;      // CF-xxx or WF-xxx
  contextUsed: boolean;          // Did we use prior context?
  contextResolution: string;     // success/partial/failure
  responseTimeMs: number;        // Total pipeline time
  errorState: string | null;     // Any errors?
}
```

### False Action Classification

```typescript
type CriticalFailure = 
  | 'CF-001'  // False Workflow — statement treated as command
  | 'CF-002'  // False Approval — approved without evidence
  | 'CF-003'  // False Finance — fabricated financial data
  | 'CF-004'  // Context Failure — lost conversation context
  | 'CF-005'  // Image Evidence Failure — no screenshot when required
  | 'CF-006'; // Fabricated Data — hallucinated source data

type WarningFailure =
  | 'WF-001'  // Slow Response — > 30 seconds
  | 'WF-002'  // Partial Intent — dropped intents
  | 'WF-003'  // Misrouted Query — wrong source
  | 'WF-004'  // Stale Data — > 24h old
  | 'WF-005'; // Language Mismatch — wrong language response
```

### Finance Truth Violation Log

```typescript
interface FinanceTruthViolation {
  id: string;
  timestamp: string;
  ceoMessageHash: string;
  queryType: string;           // 'cost' | 'revenue' | 'payroll' | 'invoice'
  connectorUsed: string;      // 'QB' | 'Sheets' | 'Dashboard'
  connectorHealth: string;    // 'healthy' | 'degraded' | 'stale'
  lastSyncAge: number;        // minutes since last successful sync
  response: string;           // What the system said
  responseSource: string;     // 'real_qb' | 'stale_qb' | 'fabricated' | 'blocked'
  violation: boolean;         // true if fabricated or wrong-source
  violationType: string;      // 'fabricated_number' | 'stale_data' | 'wrong_domain'
  evidenceAttached: string;   // 'screenshot' | 'api_json' | 'none'
}
```

---

## Alerting System

### Alert Triggers

| Condition | Severity | Action |
|-----------|----------|--------|
| M6 (false_action_rate) > 0% | CRITICAL | Page Dev immediately, CEO WhatsApp alert |
| M7 (false_approval_rate) > 0% | CRITICAL | Page Dev immediately, CEO WhatsApp alert |
| M8 (finance_truth_violations) > 0% | CRITICAL | Page Dev immediately, full audit |
| M9 (context_failures) > 5% | WARNING | Daily review, fix within 24h |
| M5 (connector_degraded) | WARNING | Monitor, fix within 48h |
| M1 (restarts) > 5 in 1 hour | CRITICAL | Page Dev immediately |

### CEO Alert Format (WhatsApp)

```
🚨 SOURCE TRUTH ALERT

Metric: false_action_rate
Value: 2.3%
Trigger: CEO message "K" → Asana task created
Time: 2026-06-XX HH:MM
Action: Dev team notified, false action blocked
```

### Daily Summary Format

```
📊 SOURCE TRUTH DAILY — 2026-06-XX

CEO Messages: XX
False Actions: 0 (0.0%) ✅
False Approvals: 0 (0.0%) ✅
Finance Violations: 0 (0.0%) ✅
Context Failures: X (X%) ✅
Avg Response: X.Xs

M1 Restart: X
M2 Memory: OK ✅
M3 Workflow: XX% ✅
M4 Approval: XX% ✅
M5 Connector: OK ✅
M6 Source Truth: 0.0% ✅

OVERALL: 100/100 ✅ SOURCE_TRUTH_STABLE
```

---

## Implementation Requirements

### Phase 4a: Execution Ledger (Priority: CRITICAL)

The burn-in monitor claims 81.3% workflow success but DEV4 found **zero execution records exist**. This must be fixed:

```
File: server/src/services/execution-ledger.ts (new)
  - logExecution(record: ExecutionRecord): void
  - getMetrics(window: TimeWindow): BurnInMetrics
  - getFalseActions(since: Date): FalseAction[]
  - getFinanceViolations(since: Date): FinanceViolation[]
```

**Current Status:** NOT IMPLEMENTED — This is the #