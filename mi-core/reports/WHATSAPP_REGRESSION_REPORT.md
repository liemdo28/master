# WhatsApp Jarvis Experience — Regression Report

**Date:** 2026-06-15T03:44:16.068Z
**Verdict:** `CEO_ONE_MESSAGE_AUTONOMY_READY`
**Pass rate:** 100% (1127/1127)
**Threshold:** ≥95% pass, ≥500 cases

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
| Group A — Ambiguous Human Questions | 45 | 0 | — |
| Group B — Multi-Step Instructions | 36 | 0 | — |
| Group C — Relative References (resolve from memory) | 20 | 0 | — |
| Group D — CEO Style Vietnamese Expressions | 45 | 0 | — |
| Group E — Store Resolution (correct store, no ambiguity) | 45 | 0 | — |
| Group F — Website Operations | 45 | 0 | — |
| Group G — Marketing Workflow | 54 | 0 | — |
| Group H — Finance Workflow | 45 | 0 | — |
| Group I — Bookkeeper Workflow | 30 | 0 | — |
| Group J — HR Workflow | 36 | 0 | — |
| Group K — Dashboard (expanded executive snapshot) | 60 | 0 | — |
| Group L — Gmail Workflow | 36 | 0 | — |
| Group M — Google Drive Workflow | 30 | 0 | — |
| Group N — Calendar Workflow | 30 | 0 | — |
| Group O — Health Workflow | 30 | 0 | — |
| Group P — Production Governance (approval gate expected) | 24 | 0 | — |
| Group Q — Browser Operator Workflow | 30 | 0 | — |
| Group R — Research Workflow | 30 | 0 | — |
| Group S — Coding Workflow | 30 | 0 | — |
| Group T — Error Recovery (graceful fallback, no raw error) | 36 | 0 | — |
| Group U — Mixed Language (Viet/English) | 36 | 0 | — |
| Group V — Voice-to-Text Style (no diacritics, natural pace) | 45 | 0 | — |
| Group W — CEO Approval Flow (never auto-execute) | 30 | 0 | — |

## Failures

_(none)_

## Criteria

- [x] ≥500 test cases (got 1127)
- [x] ≥95% pass rate (got 100%)
- [x] 0 raw English "temporarily unavailable" failures
- [x] 0 Knowledge Graph dumps for operational questions
- [x] 0 context-loss failures in follow-up tests