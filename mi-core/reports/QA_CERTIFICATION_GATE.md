# QA Certification Gate
**Date:** 2026-06-13  
**Modules:** `src/gstack/role-agents/qa-agent.ts` + `auditor-agent.ts`

---

## Principle

No agent can claim DONE without going through both:
1. **QA Agent** — runs objective tests, collects evidence
2. **Auditor Agent** — verifies evidence, issues certification or rejects

These are separate roles. QA runs tests. Auditor validates claims.

---

## QA Checks

| ID | Check | Blocking | Runs When |
|----|-------|----------|-----------|
| QA1 | Regression suite (10 CEO cases) | Non-blocking | All pipelines |
| QA2 | No P0 crash-looping processes | Blocking for deploy | All pipelines |
| QA3 | Service health (mi-core, gateway, antigravity) | Blocking | All pipelines |
| QA5 | TypeScript build compiles | Non-blocking | Deploy/fix intents |

### Regression Suite (QA1)
- 10 mandatory CEO WhatsApp cases (R01-R10)
- Run in-process via `processJarvisQuery` (no HTTP overhead)
- Checks: reply contains expected content, no banned patterns, no command-bot style
- Must complete in <8s per case

### P0 Check (QA2)
- Reads PM2 jlist via shell
- Flags any process with `status === 'errored'` OR `restart_time > 100`
- Non-blocking for audit intents (reports finding, doesn't reject)
- **Blocking for deploy** — cannot ship with crash-looping service

### Health Check (QA3)
- HTTP GET to ports 4001, 3211, 3456
- Checks status < 400
- Requires ≥ 2 of 3 UP for PASS

---

## Auditor Evidence Rules (5 rules)

| Rule | Blocking | Purpose |
|------|----------|---------|
| QA sweep must have run | ✅ Yes | Prevents claims without testing |
| No crash-looping (deploy only) | ✅ for deploy | Production safety gate |
| ≥2 services healthy | ✅ Yes | Runtime viability |
| Regression suite (if personality touched) | ❌ No | Catch CEO experience regressions |
| ≥2 agents logged | ❌ No | Prevents single-agent self-certification |

---

## Certification Verdicts

| Verdict | Meaning | Work Order Result |
|---------|---------|------------------|
| `CERTIFIED` | All rules pass | `DELIVERED` |
| `CONDITIONAL_PASS` | Non-blocking failures only | `PARTIAL` |
| `REJECTED` | Any blocking rule fails | `FAILED` |

---

## Certification ID

Format: `CERT-WO-YYYYMMDD-NNN-XXXXXXXXXX`

Example: `CERT-WO-20260613-007-MQBXJ33T`

Issued for `CERTIFIED` and `CONDITIONAL_PASS`. Not issued for `REJECTED`.

---

## Production Threshold

For **deployment** approval, Mi requires:
- `QA3` PASS (health check)
- `QA2` PASS (no P0)
- `QA5` PASS (build compiles)
- Auditor CERTIFIED or CONDITIONAL_PASS with no deploy-blocking failures
- CEO explicit approval (Level 3)

For **audit/report**, Mi only requires:
- At least 50% of QA checks passing
- Auditor CONDITIONAL_PASS or above

---

## Confidence Score

`confidence_score = (qa_confidence + auditor_confidence) / 2`

Where:
- `qa_confidence = (passed_checks / total_checks) * 100`
- `auditor_confidence = (confirmed_rules / total_rules) * 100`

**Target for auto-delivery:** confidence_score ≥ 70%  
**Target for deployment:** confidence_score = 100% (all checks pass)
