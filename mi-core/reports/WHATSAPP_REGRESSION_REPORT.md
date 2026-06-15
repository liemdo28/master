# WhatsApp Jarvis Experience — Regression Report

**Date:** 2026-06-15T03:14:35.436Z
**Verdict:** `WHATSAPP_REGRESSION_PASS`
**Pass rate:** 100% (279/279)
**Threshold:** ≥95% pass, ≥150 cases

## Section Summary

| Section | Pass | Fail | Notes |
|---------|------|------|-------|
| Engine Bootstrap | 2 | 0 | — |
| §1 Greeting — Vietnamese Jarvis style | 16 | 0 | — |
| §2 Dashboard Live Query (W3 Handler) | 45 | 0 | — |
| §3 Task Query W3 — hôm nay anh có task gì | 20 | 0 | — |
| §4 Follow-up Context W2 — conversation memory | 19 | 0 | — |
| §5 No-Diacritic Vietnamese — correct intent routing | 32 | 0 | — |
| §6 Typo / Short Message — graceful handling | 20 | 0 | — |
| §7 Action Requests — COO/workflow routing | 24 | 0 | — |
| §8 Graph Guard — operational questions must NOT produce graph dump | 12 | 0 | — |
| §9 Graph Guard — explicit graph queries may reference graph | 12 | 0 | — |
| §10 Error Policy — Vietnamese fallbacks, no English unavailable | 8 | 0 | — |
| §11 Data Consistency — HTTP vs Jarvis response | 5 | 0 | — |
| §12 Phase 17 Briefing + Phase 23 Health | 16 | 0 | — |
| §13 Phase Regression — Ph6/7/18/20/21/24/30 | 27 | 0 | — |
| §14 Conversation Store — unit tests | 11 | 0 | — |
| §15 Routing Edge Cases | 10 | 0 | — |

## Failures

_(none)_

## Criteria

- [x] ≥150 test cases (got 279)
- [x] ≥95% pass rate (got 100%)
- [x] 0 raw English "temporarily unavailable" failures
- [x] 0 Knowledge Graph dumps for operational questions
- [x] 0 context-loss failures in follow-up tests