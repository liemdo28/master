# AGENT_PERFORMANCE_SCORECARD.md — Multi-Agent Performance Tracking

**Generated:** 2026-06-27
**Purpose:** Track performance metrics for all agents in multi-agent workflows

---

## Performance Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Output Quality | Accuracy and completeness of output | >= 85 |
| Handoff Speed | Time to complete and acknowledge handoff | <= 5 min |
| Conflict Rate | Conflicts per objective | <= 0.5 |
| Escalation Rate | Human escalations per objective | <= 0.2 |
| Evidence Coverage | % of outputs with evidence | 100% |

---

## Agent Performance Scores

| Agent | Quality | Speed | Conflicts | Escalations | Evidence | **Total** |
|-------|---------|-------|-----------|------------|----------|-----------|
| AGENT-FIN-001 | 93.5 | 95 | 0 | 0 | 100% | **94.1** |
| AGENT-MKT-001 | 87.8 | 88 | 0 | 0 | 100% | **88.5** |
| AGENT-MKT-002 | TBD | TBD | TBD | TBD | TBD | — |
| AGENT-CRE-001 | 92.5 | 90 | 0 | 1 | 100% | **91.0** |
| AGENT-OPS-001 | 88.0 | 92 | 1 | 0 | 100% | **89.0** |
| AGENT-OPS-002 | TBD | TBD | TBD | TBD | TBD | — |
| AGENT-IT-001 | TBD | TBD | TBD | TBD | TBD | — |

---

## Raw Sushi Objective — Full Agent Run

| Agent | Tasks | Quality | Handoffs | Status |
|-------|-------|---------|----------|--------|
| Finance Agent | 1 | 93.5 | 1 | ✅ Complete |
| Marketing Agent | 1 | 87.8 | 2 | ✅ Complete |
| DoorDash Operator | 1 | 88.0 | 0 | ✅ Complete |
| SEO Agent | 0 | — | 0 | ⏸️ Not assigned |
| Creative Agent | 1 | 92.5 | 1 | ✅ Complete |
| Human Approver | 1 | — | 0 | ⏸️ Pending approval |

---

## Status: ✅ PERFORMANCE_SCORECARD_ACTIVE

Agent performance tracked with quality, speed, and evidence metrics.
