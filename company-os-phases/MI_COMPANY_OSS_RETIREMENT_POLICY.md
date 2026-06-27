# MI_COMPANY_OSS_RETIREMENT_POLICY.md — Master OSS Retirement Policy

**Generated:** 2026-06-27
**Purpose:** Define retirement policies for all OSS across phases 11-20

---

## Retirement Criteria

```
OSS is retired when:
  1. Successor is PRODUCTION-ready
  2. Data migration is complete
  3. All dependencies updated
  4. Rollback plan tested
  5. CEO approval obtained
```

---

## Retirement Plan by OSS

| OSS | Sunset Criteria | Replacement | Timeline | Migration Owner | Status |
|-----|---------------|-----------|---------|---------------|--------|
| Browser Use (→ Playwright) | Playwright handles all use cases | Playwright | 12 months | IT | BACKLOG |
| PostHog (→ Plausible) | AGPL source disclosure risk | Plausible | 18 months | IT | MONITORING |
| OpenObserve (→ Grafana) | AGPL license concern | Grafana + Loki | 18 months | IT | MONITORING |
| Qwen Coder (→ Claude) | Audit incomplete | Claude API | 6 months | Engineering | AUDIT |
| Aider (→ Continue) | IDE integration needed | Continue | 12 months | Engineering | BACKLOG |
| OpenHands (→ Aider) | Redundant with Aider | Aider | 12 months | Engineering | BACKLOG |
| n8n (→ Temporal) | If Temporal matures | Temporal | 24 months | Operations | MONITORING |
| Phoenix (→ built-in) | No ML training needed | — | — | — | DISCOVERY |

---

## AGPL License Retirement (Priority)

| OSS | AGPL Risk | Retirement Priority | Timeline | Owner |
|-----|----------|-------------------|---------|-------|
| Skyvern | HIGH — REJECTED | N/A — do not deploy | — | — |
| PostHog | MEDIUM | HIGH | 18 months | IT Lead |
| OpenObserve | MEDIUM | HIGH | 18 months | IT Lead |

---

## Retirement Process

```
Step 1: Identify successor OSS
Step 2: Deploy successor in parallel
Step 3: Migrate data/workflows
Step 4: Test all integrations
Step 5: Disable old OSS
Step 6: Archive evidence
Step 7: Update OSS Registry
Step 8: Notify affected divisions
```

---

## Rollback Plan for Each PRODUCTION OSS

| OSS | Rollback Step | Rollback Time | Owner |
|-----|-------------|-------------|-------|
| n8n | Disable workflows; manual operations | Immediate | Operations |
| Playwright | Stop scripts; manual scraping | Immediate | IT |
| DuckDB | Halt queries; use source APIs | Immediate | Finance |
| dbt | Disable models; direct SQL | Immediate | Finance |
| OpenFGA | Disable authorization; allow all | Immediate | IT |
| OPA | Disable policies; allow all | Immediate | IT |
| Langfuse | Disable tracing; continue without | Immediate | Engineering |
| OpenTelemetry | Disable telemetry; legacy logs | Immediate | Engineering |
| Postgres pgvector | Use text search fallback | 1 hour | Engineering |
| Airbyte | Manual sync | Immediate | IT |
| Uptime Kuma | Manual monitoring | Immediate | IT |

---

## Status: ✅ MASTER_OSS_RETIREMENT_POLICY_COMPLETE
