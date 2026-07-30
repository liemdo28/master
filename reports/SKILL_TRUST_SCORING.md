# Skill Trust Scoring
**Module:** DEV3 Phase 12.2 + 12.3  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/skill-trust-score.ts`

---

## Objective

Trust Score is a composite 0-100 metric that combines QA quality, execution reliability, certification level, and failure penalty. It drives **Phase 12.3 Automatic Skill Ranking** — when multiple skills can handle an intent, the highest trust score wins.

---

## Trust Score Formula

```
trust_score = qa_component          (0–40)
            + reliability_component (0–30)
            + certification_bonus   (0–20)
            - failure_penalty       (0–10)
```

| Component | Calculation | Max |
|-----------|-------------|-----|
| qa_component | `(qa_score / 100) × 40` | 40 |
| reliability_component | `(reliability_score / 100) × 30` | 30 |
| certification_bonus | EXPERIMENTAL:0, BETA:5, CERTIFIED:12, PRODUCTION:20 | 20 |
| failure_penalty | `failure_rate × 6 + recent_failures × 1.5` (capped at 10) | -10 |

---

## Trust Labels

| Score | Label | Meaning |
|-------|-------|---------|
| ≥90 | **ELITE** | Maximum confidence — preferred in all chains |
| ≥75 | **HIGH_TRUST** | Strong — preferred for critical intents |
| ≥55 | **TRUSTED** | Reliable for standard use |
| ≥35 | **EMERGING** | New skill building its record |
| <35 | **UNTRUSTED** | Avoid — investigate failures |

---

## Acceptance Test Results (Phase 12 — 300 executions)

| Rank | Skill | Trust Score | Label | Components |
|------|-------|------------|-------|------------|
| 1 | **health** | **88** | HIGH_TRUST | qa:38 + rel:30 + cert:20 - fail:0 |
| 2 | **pm2_status** | **88** | HIGH_TRUST | qa:38 + rel:30 + cert:20 - fail:0 |
| 3 | **dashboard_audit** | **86** | HIGH_TRUST | qa:37 + rel:29 + cert:20 - fail:0 |
| 4 | source_scan | 78 | HIGH_TRUST | qa:37 + rel:29 + cert:12 - fail:0 |
| 5 | regression_suite | 74 | TRUSTED | qa:36 + rel:27 + cert:12 - fail:1 |

**Certification explains the gap:** health + pm2_status + dashboard_audit reached PRODUCTION (+20 bonus) while source_scan + regression_suite are CERTIFIED (+12 bonus).

---

## Phase 12.3 — Automatic Skill Ranking

The dynamic selector now uses trust score instead of raw reliability score for ranking. When an intent produces multiple candidate skills, they are ordered by trust score descending — the highest-trust skill executes first.

**Example — intent: `audit_project`**

```
Chain before Phase 12 (reliability only):
  [dashboard_audit, source_scan, log_scan, health, pm2_status, ...]

Chain after Phase 12 (trust score):
  [health → pm2_status → dashboard_audit → source_scan → regression_suite]
```

The system selected `health` as the anchor — it has the highest trust score (88) and serves as the baseline for all audit chains.

---

## Trend Tracking

The engine keeps a 10-entry history per skill. Trend is computed from the delta of the last two scores:
- `IMPROVING` — delta ≥ +3
- `DEGRADING` — delta ≤ -3
- `STABLE` — within ±3

---

## Storage

```
.local-agent-global/skills/trust-scores.json
```

Each skill stores up to 10 historical trust score entries for trend analysis.
