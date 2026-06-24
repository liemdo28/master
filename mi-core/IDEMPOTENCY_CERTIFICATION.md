# IDEMPOTENCY_CERTIFICATION.md

**Phase:** E6 — Idempotency Validation (100 Duplicate Replay)
**Generated:** 2026-06-16T10:41:00+07:00
**Target:** 0 duplicate workflows, 0 duplicate approvals from 100 duplicate messages
**Git Commit:** ae8ad26fa6a73b5e971b814fdec7276f7e220fd4

---

## Executive Summary

The CEO directive requires replaying **100 duplicate messages** and verifying **0 duplicate workflows** and **0 duplicate approvals**. Current state: the idempotency layer (`server/src/execution/idempotency-layer.ts`) was tested with 3 duplicates of 1 message (see `IDEMPOTENCY_PROOF_REPORT.md`) and passed. However, the EVIDENCE_LOCKDOWN_AUDIT found that WO-001 through WO-006 were **all created from the same CEO message** — proving the idempotency layer was NOT active when those work orders were created.

**Verdict: PARTIAL PASS — idempotency layer exists and passes basic tests, but has never been validated with 100 duplicates in production.**

---

## Current Idempotency Architecture

### Implementation

| Component | Location | Status |
|-----------|----------|--------|
| Idempotency layer | `server/src/execution/idempotency-layer.ts` | IMPLEMENTED ✅ |
| Key format | `sender + normalized_message + target_entity + intent` | DEFINED ✅ |
| Time window | 2 minutes (120,000ms) | DEFINED ✅ |
| Storage | `.local-agent-global/idempotency/` (file-based) | IMPLEMENTED ✅ |
| Auto-cleanup | Expired records removed on check | IMPLEMENTED ✅ |

### Normalization Rules

| Rule | Example |
|------|---------|
| Vietnamese diacritics removed | "kiểm tra" → "kiem tra" |
| Case insensitive | "Dashboard" = "dashboard" |
| Punctuation stripped | "QB?" = "QB" |
| Multiple spaces collapsed | "kiêm   tra" → "kiem tra" |

---

## Existing Test Results

### Test 1: IDEMPOTENCY_PROOF_REPORT.md (3 duplicates)

| Call | is_duplicate | existing_workflow | Result |
|------|-------------|-------------------|--------|
| 1st | true (pre-registered) | SEO-CONTENT-20260615-008 | Blocked ✅ |
| 2nd | true | SEO-CONTENT-20260615-008 | Blocked ✅ |
| 3rd | true | SEO-CONTENT-20260615-008 | Blocked ✅ |
| Different msg | false | N/A | Allowed ✅ |

**Result: 4/4 PASS**

### Test 2: IDEMPOTENCY_REPORT.md (acceptance)

| Check | Result |
|-------|--------|
| Same message sent twice within 2 min → no duplicate workflow | ✅ |
| Same message sent twice → no duplicate approval | ✅ |
| Response says existing workflow is pending | ✅ |

**Result: 3/3 PASS**

### Test 3: Historical Failure (WO-001 to WO-006)

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Same message sent at 05:36:13 | 1 WO created | WO-001 created | ✅ (first is OK) |
| Same message sent again (WO-002) | BLOCKED by idempotency | WO-002 created | ❌ FAIL |
| Same message sent again (WO-003) | BLOCKED by idempotency | WO-003 created | ❌ FAIL |
| Same message sent again (WO-004) | BLOCKED by idempotency | WO-004 created | ❌ FAIL |
| Same message sent again (WO-005) | BLOCKED (different msg) | WO-005 created | ✅ (different message) |
| Same message sent again (WO-006) | BLOCKED by idempotency | WO-006 created | ❌ FAIL |

**Result: WO-002, WO-003, WO-004, WO-006 are FALSE ACTIONS (FA-004)**
**Root cause: Idempotency layer was NOT active during these executions**

---

## 100-Duplicate Replay Test Plan

### Test Design

Since we cannot send 100 real WhatsApp messages, we simulate the replay at the execution layer.

### Message Selection

| # | Message | Type | Expected Behavior |
|---|---------|------|-------------------|
| 1 | "kiem tra dashboard" | Status query | REPORT — no workflow created |
| 2 | "hom nay co gi?" | Casual query | REPORT — no workflow created |
| 3 | "Deploy server" | Dangerous command | BLOCKED — approval required |
| 4 | "K" | Acknowledgment | ACKNOWLEDGE — no action |
| 5-100 | 10 repetitions of each of the above | Mixed | Same behavior each time |

### Replay Matrix (per message type, 25 duplicates each)

#### Message 1: "kiem tra dashboard" (25 duplicates)

| Duplicate # | Duplicate? | Idempotent? | Expected | Required |
|-------------|-----------|-------------|----------|----------|
| 1 | No (first) | N/A | Process normally | REPORT |
| 2 | Yes | Within 2 min | BLOCK duplicate | 0 new WO |
| 3 | Yes | Within 2 min | BLOCK duplicate | 0 new WO |
| ... | Yes | Within 2 min | BLOCK duplicate | 0 new WO |
| 25 | Yes | Within 2 min | BLOCK duplicate | 0 new WO |

**Target: 1 workflow created, 0 duplicates**

#### Message 2: "hom nay co gi?" (25 duplicates)

| Duplicate # | Duplicate? | Idempotent? | Expected | Required |
|-------------|-----------|-------------|----------|----------|
| 1 | No | N/A | Process normally | REPORT |
| 2-25 | Yes | Within 2 min | BLOCK duplicate | 0 new WO |

**Target: 0 workflows (REPORT only), 0 duplicates**

#### Message 3: "Deploy server" (25 duplicates)

| Duplicate # | Duplicate? | Idempotent? | Expected | Required |
|-------------|-----------|-------------|----------|----------|
| 1 | No | N/A | BLOCKED by safety gate | 0 WO + approval request |
| 2-25 | Yes | Within 2 min | BLOCK duplicate | 0 new WO |

**Target: 0 workflows, 0 approvals, 0 duplicates**

#### Message 4: "K" (25 duplicates)

| Duplicate # | Duplicate? | Idempotent? | Expected | Required |
|-------------|-----------|-------------|----------|----------|
| 1 | No | N/A | ACKNOWLEDGE | 0 WO |
| 2-25 | Yes | Within 2 min | ACKNOWLEDGE | 0 WO |

**Target: 0 workflows, 0 approvals, 0 duplicates**

### Aggregate Targets

| Metric | Target | Pass Criteria |
|--------|--------|---------------|
| Total messages replayed | 100 | 100/100 |
| Total workflows created | 1 (max) | ≤ 1 per unique message |
| Total duplicate workflows | 0 | = 0 |
| Total approvals created | 0 | = 0 |
| Total duplicate approvals | 0 | = 0 |
| False action rate | 0% | = 0% |

---

## 100-Duplicate Replay Results

### Simulated Results (Based on Current Architecture Analysis)

| Test | Messages | Unique | Duplicates | WOs Created | Duplicates Created | Status |
|------|----------|--------|------------|-------------|-------------------|--------|
| "kiem tra dashboard" | 25 | 1 | 24 | ? | ? | **UNTESTED** |
| "hom nay co gi?" | 25 | 1 | 24 | 0 (REPORT) | ? | **UNTESTED** |
| "Deploy server" | 25 | 1 | 24 | 0 (BLOCKED) | ? | **UNTESTED** |
| "K" | 25 | 1 | 24 | 0 (ACK) | ? | **UNTESTED** |
| **Total** | **100** | **4** | **96** | **?** | **?** | **UNTESTED** |

### Why UNTESTED

1. The idempotency layer exists but was **bypassed historically** (WO-001 to WO-006)
2. No automated test script exists for 100-duplicate replay
3. The test requires either:
   a. A simulated WhatsApp gateway sending 100 messages, OR
   b. Direct API calls to `/api/whatsapp/mi` with identical payloads
4. Neither has been executed

### Evidence of Idempotency Layer Effectiveness

| Evidence | Source | Supports? |
|----------|--------|-----------|
| 3-duplicate test passed | IDEMPOTENCY_PROOF_REPORT.md | YES — basic mechanism works |
| WO-001 to WO-006 are duplicates | EVIDENCE_LOCKDOWN_AUDIT | NO — layer was not active then |
| Idempotency key includes sender+message+entity+intent | IDEMPOTENCY_REPORT.md | YES — key design is sound |
| 2-minute time window | IDEMPOTENCY_REPORT.md | LIMITATION — duplicates after 2 min are allowed |
| File-based storage | `.local-agent-global/idempotency/` | CONCERN — no DB backup, no WAL |

---

## Gap Analysis

### Gap 1: Historical Idempotency Failure

| Metric | Expected | Actual |
|--------|----------|--------|
| WO-001 to WO-006 | 1 WO (rest blocked) | 6 WOs created |
| Root cause | — | Idempotency layer not wired to production path |

### Gap 2: 100-Duplicate Test Not Executed

| Requirement | Status |
|-------------|--------|
| 100 duplicate messages sent | NOT DONE |
| 0 duplicate workflows verified | NOT DONE |
| 0 duplicate approvals verified | NOT DONE |

### Gap 3: Time Window Limitation

| Scenario | Behavior | Risk |
|----------|----------|------|
| Duplicate within 2 min | BLOCKED | Safe |
| Duplicate after 2 min | ALLOWED (new request) | If CEO resends same message after 2 min, new WO is created |
| Slow network causing delayed delivery | May bypass idempotency | LOW — WhatsApp gateway deduplicates at transport level |

### Gap 4: File-Based Storage vs DB

| Aspect | Current | Ideal |
|--------|---------|-------|
| Storage | File per key in `.local-agent-global/idempotency/` | SQLite with WAL |
| Crash recovery | Files persist, no WAL | SQLite WAL ensures atomicity |
| Cleanup | Auto on access | Periodic + auto on access |
| Scaling | File count grows | Bounded by DB index |

---

## What Must Be Built for Full Certification

| # | Component | Purpose | LOC |
|---|-----------|---------|-----|
| 1 | `idempotency-replay-test.mjs` | Script to send 100 duplicates and verify | ~120 |
| 2 | Wire idempotency into WhatsApp gateway path | Ensure gateway messages pass through layer | ~30 |
| 3 | SQLite migration for idempotency store | Replace file-based with DB | ~80 |
| 4 | 2-minute window verification test | Confirm window behavior | ~40 |

---

## Certification Result

```
IDEMPOTENCY_CERTIFICATION: PARTIAL PASS
├── Idempotency layer: IMPLEMENTED ✅
├── Key design (sender+message+entity+intent): SOUND ✅
├── 3-duplicate test: PASS ✅
├── Historical WO dedup: FAIL ❌ (WO-001 to WO-006 all created)
├── 100-duplicate replay: NOT EXECUTED ❌
├── Target: 0 duplicate workflows → UNKNOWN
├── Target: 0 duplicate approvals → UNKNOWN (0 approvals in DB)
├── Time window: 2 minutes (LIMITATION)
├── Storage: File-based (CONCERN — should be SQLite)
├── WhatsApp gateway wiring: UNVERIFIED ❌
├── Verdict: MECHANISM EXISTS, NOT VALIDATED IN PRODUCTION
└── Required: Wire into gateway + run 100-duplicate test + migrate to SQLite
```

---

**CERTIFICATION STATUS:** IDEMPOTENCY_PARTIAL_PASS
**3-DUPLICATE TEST:** PASS ✅
**100-DUPLICATE TEST:** NOT EXECUTED ❌
**HISTORICAL DEDUP:** FAIL ❌ (4 false actions from same message)
**TARGET (0 dup WOs, 0 dup approvals):** UNVERIFIED
