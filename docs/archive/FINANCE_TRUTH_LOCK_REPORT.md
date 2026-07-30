# FINANCE_TRUTH_LOCK_REPORT.md — P0-4 Finance Truth Lock

**Priority:** P0 — PRODUCTION BLOCKER
**Generated:** 2026-06-16T08:04:00+07:00
**Status:** IMPLEMENTED
**Owner:** Mi-Core Central Command

---

## Problem Statement

Previous behavior allowed Mi-Core to:
- Return estimated revenue numbers when QB was degraded
- Provide fabricated expense breakdowns without live data
- Mix up entity-specific data (Raw Sushi vs Raw Website)
- Present stale numbers as current without timestamp qualification

**Root Cause:** No hard lock preventing numeric responses when finance evidence is absent.

---

## Finance Truth Lock Protocol

The Finance Truth Lock is a **HARD BLOCK** on all numeric finance responses when evidence is missing.

### What Triggers the Lock

| Condition | Lock Triggered? |
|---|---|
| QB connector health: degraded | **YES** |
| QB sync: > 24 hours since last sync | **YES** |
| No QB connector configured | **YES** |
| Finance API returns empty | **YES** |
| No payroll data source connected | **YES** |
| Revenue query without verified source | **YES** |
| Expense query without verified source | **YES** |
| Checksum mismatch detected | **YES** |

### What the Lock Blocks

| Blocked Output | Allowed Alternative |
|---|---|
| Any revenue number | "Em chưa có dữ liệu thật để kết luận" |
| Any expense number | "Nguồn finance đang degraded" |
| Any profit/loss number | "Em chưa có live data" |
| Any payroll number | "Em chưa kết nối nguồn payroll" |
| Any forecast number based on missing data | "Em chưa có dữ liệu nền tảng" |
| Any comparison number without both data points | "Em chưa đủ dữ liệu để so sánh" |

---

## Allowed Responses When Lock Is Active

### Template 1: No Data Available
```
Em chưa có dữ liệu thật để kết luận.
[Source status: degraded/unavailable]
```

### Template 2: Stale Data
```
Dữ liệu finance đang stale.
Last QB sync: [timestamp].
Em chưa chắc số liệu này còn đúng.
```

### Template 3: Partial Data
```
Em chỉ có [partial info] nhưng chưa đủ để kết luận.
Thiếu: [missing fields].
```

### Template 4: Source Degraded
```
QB connector đang degraded.
Company: [company name].
Last sync: [timestamp].
Anh cần em check lại connection không?
```

---

## Blocked Responses (NEVER Allowed)

### Fabricated Numbers
```
❌ "Doanh thu Raw Sushi tháng này khoảng $50,000"
❌ "Chi phí khoảng $30,000"
❌ "Lợi nhuận ròng: $15,000"
```

### Estimated Numbers
```
❌ "Theo trend thì doanh thu khoảng..."
❌ "Dựa trên tháng trước, ước tính..."
```

### Mixed Entity Numbers
```
❌ "Doanh thu Raw Sushi: $12,000" (when data is from different entity)
```

### Unqualified Old Numbers
```
❌ "Doanh thu: $10,800" (without "last known" or timestamp)
```

---

## Implementation in Code

### Finance Truth Lock Module (New)

Location: `server/src/jarvis/phase30-jarvis/finance-truth-lock.ts`

```typescript
// Finance Truth Lock — P0-4 Implementation
// HARD BLOCK on numeric finance responses when evidence is missing

import { EvidenceClass, EvidenceGateResult } from './evidence-gate';

export type FinanceLockStatus = 'LOCKED' | 'UNLOCKED';

export interface FinanceTruthLockResult {
  status: FinanceLockStatus;
  allowedResponse: string;
  blockedReasons: string[];
}

export interface FinanceQueryContext {
  evidence: EvidenceGateResult;
  qbConnectorHealth: 'healthy' | 'degraded' | 'unreachable';
  lastSyncTimestamp: string | null;
  hasPayrollSource: boolean;
  hasRevenueSource: boolean;
  hasExpenseSource: boolean;
  requestedEntity: string;
  availableEntity: string;
}

export function evaluateFinanceLock(
  context: FinanceQueryContext
): FinanceTruthLockResult {
  const reasons: string[] = [];

  // Rule 1: Evidence is MISSING → LOCK
  if (context.evidence.classification === 'MISSING') {
    reasons.push('Evidence classification is MISSING');
  }

  // Rule 2: QB connector is degraded → LOCK
  if (context.qbConnectorHealth === 'degraded') {
    reasons.push('QB connector status: degraded');
  }

  // Rule 3: QB connector unreachable → LOCK
  if (context.qbConnectorHealth === 'unreachable') {
    reasons.push('QB connector status: unreachable');
  }

  // Rule 4: Last sync > 24 hours → LOCK
  if (context.lastSyncTimestamp) {
    const syncAge = Date.now() - new Date(context.lastSyncTimestamp).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (syncAge > TWENTY_FOUR_HOURS) {
      reasons.push(`Last QB sync: ${Math.round(syncAge / 3600000)}h ago (> 24h threshold)`);
    }
  } else {
    reasons.push('No QB sync timestamp available');
  }

  // Rule 5: No data source for requested type → LOCK
  if (context.requestedEntity === 'revenue' && !context.hasRevenueSource) {
    reasons.push('No revenue data source connected');
  }
  if (context.requestedEntity === 'expense' && !context.hasExpenseSource) {
    reasons.push('No expense data source connected');
  }
  if (context.requestedEntity === 'payroll' && !context.hasPayrollSource) {
    reasons.push('No payroll data source connected');
  }

  // Rule 6: Entity mismatch → LOCK
  if (context.requestedEntity && context.availableEntity &&
      context.requestedEntity !== context.availableEntity) {
    reasons.push(`Entity mismatch: requested '${context.requestedEntity}', available '${context.availableEntity}'`);
  }

  // Rule 7: Stale classification → LOCK
  if (context.evidence.classification === 'STALE') {
    reasons.push('Evidence classification is STALE');
  }

  // Determine lock status
  const status: FinanceLockStatus = reasons.length > 0 ? 'LOCKED' : 'UNLOCKED';

  // Build allowed response
  let allowedResponse: string;
  if (status === 'LOCKED') {
    // ONLY these responses are allowed when locked
    const entity = context.requestedEntity || 'dữ liệu finance';
    allowedResponse = `Em chưa có dữ liệu thật để kết luận về ${entity}.\n` +
      `Lý do: ${reasons.join('; ')}.\n` +
      `Anh cần em kiểm tra lại nguồn dữ liệu không?`;
  } else {
    allowedResponse = ''; // Empty = proceed with normal numeric response
  }

  return { status, allowedResponse, blockedReasons: reasons };
}
```

---

## Integration into Pipeline

```
Evidence Gate → Finance Truth Lock → Decision Gate → Response Builder
                                    ↑
                                    HARD BLOCK
                                    (stops pipeline if LOCKED)
```

The Finance Truth Lock is evaluated **specifically** when:
1. Intent category contains finance keywords (doanh thu, chi phí, revenue, expense, QB, payroll, profit)
2. The response would contain any numeric value
3. Evidence classification is not CONFIRMED

If the lock triggers, the pipeline STOPS before response generation. The system returns only the allowed response template.

---

## Verification: CEO Response Protocol

When finance data is locked, the CEO-facing response MUST:

1. **Acknowledge** the question was received
2. **State** the data is unavailable
3. **Explain** why (brief reason)
4. **Offer** an alternative action (check connection, wait for sync)
5. **NEVER** provide a number

### Example: Correct Response

**Input:** "Doanh thu Raw Sushi tháng này bao nhiêu?"
**Context:** QB connector degraded, last sync 3 days ago

**Correct Output:**
```
Em chưa có dữ liệu thật để kết luận.
QB connector đang degraded. Last sync: 3 ngày trước.
Anh cần em check lại connection không?
```

**Incorrect Output (BLOCKED):**
```
❌ "Doanh thu Raw Sushi tháng này khoảng $45,000"
❌ "Theo tháng trước thì khoảng $45,000"
❌ "Dữ liệu chưa chính xác nhưng ước tính..."
```

---

## Historical Proof

From FINANCE_TRUTH_CERTIFICATION.md (2026-06-15):
- 18/20 finance queries passed (90%)
- 2 failures: timeout (500 error) and wrong domain redirect
- No fabricated answers in passing responses
- All passing responses correctly used "degraded" + "missing" language

The Finance Truth Lock formalizes what was already partially working — but adds a HARD BLOCK that prevents regression.

---

## Acceptance Criteria

- [ ] All finance queries with MISSING/STALE evidence return "chưa có dữ liệu thật"
- [ ] Zero fabricated numbers when QB is degraded
- [ ] Zero estimated/forecast numbers without confirmed source
- [ ] Entity-specific queries don't mix data from different entities
- [ ] All blocked responses are logged in audit trail
- [ ] Lock triggers for every finance domain keyword
- [ ] Lock cannot be bypassed by rephrasing the question

---

## Acceptance Test 4: "Raw doanh thu sao rồi"

**Finance Truth Lock Step:**
1. Domain: finance (doanh thu = revenue)
2. Entity: Raw (Raw Sushi)
3. QB connector status: check health
4. Last sync: check timestamp

**If QB degraded:**
```
LOCK STATUS: LOCKED
BLOCKED: Revenue number for Raw Sushi
REASON: QB connector degraded, no live revenue data

"Em chưa có dữ liệu thật để kết luận.
Raw doanh thu: nguồn QB đang degraded, em chưa có live revenue data."
```
→ No numeric. Correct.

**If QB synced < 24h:**
```
LOCK STATUS: UNLOCKED
PROCEED: With CONFIRMED numeric response

"Raw Sushi doanh thu hôm nay: $XX,XXX
QB sync: X giờ trước."
```
→ Real data with evidence. Correct.

---

**CERTIFICATION:** FINANCE_TRUTH_LOCK_P0_4_IMPLEMENTED
