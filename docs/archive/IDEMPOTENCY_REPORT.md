# IDEMPOTENCY REPORT

## Phase E6 — CERTIFIED

### Module
`server/src/execution/idempotency-layer.ts`

### Problem Solved
Mi previously replied duplicate SEO Analysis twice for the same request.

### Solution
Idempotency key: `sender + normalized_message + target_entity + intent`

### Prevention Matrix

| Duplicate Type | Prevented By |
|---|---|
| duplicate reply | checkDuplicate() before processing |
| duplicate workflow | checkDuplicate() → returns existing workflow_id |
| duplicate approval | findPendingByWorkflow() checks existing |
| duplicate publish | Queue idempotency_key check |
| duplicate send | Sender+message+entity+intent key |
| duplicate deployment | Queue-level dedup |

### Time Window
- 2 minutes (120,000ms)
- Expired records auto-cleaned on check
- Same message after window = new request

### Normalization
- Vietnamese diacritics removed
- Case insensitive
- Punctuation stripped
- Multiple spaces collapsed

### Acceptance Test
Same message sent twice within 2 minutes:
- No duplicate workflow ✅
- No duplicate approval ✅
- Response says existing workflow is pending ✅

### Gates
- [x] IDEMPOTENCY_CERTIFIED
