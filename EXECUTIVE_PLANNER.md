# EXECUTIVE PLANNER — Phase 21B

## Purpose
Build a structured plan BEFORE any execution. Planning first. Execution second.

## Architecture
- Intent → Plan template mapping (13 intent types)
- Dependency-aware step ordering
- QA gates at critical steps
- Parallel step detection
- Estimated time calculation

## Plan Templates
Each intent category has a pre-built plan template:
- **operational_concern**: 6 steps (health check → error scan → connector audit → analysis → QA → brief)
- **revenue_concern**: 6 steps (data collection → traffic analysis → external factors → marketing review → hypotheses → brief)
- **risk_concern**: 4 steps (risk scan → scoring → mitigation → brief)
- **service_degradation**: 4 steps (measure → baseline compare → bottleneck → brief)
- **strategic_question**: 4 steps (context → options → recommendation → brief)
- **compliance_concern**: 4 steps (license check → insurance → analysis → brief)
- **people_concern**: 3 steps (data collection → analysis → brief)
- **technology_concern**: 4 steps (infra check → code scan → analysis → brief)
- **marketing_concern**: 3 steps (data collection → analysis → brief)
- **general_status_check**: 3 steps (health → priority → brief)
- **urgent_intervention**: 3 steps (incident ID → evidence → analysis)
- **performance_review**: 4 steps (metrics → analysis → improvement → brief)
- **unknown**: 2 steps (context → clarification)

## Key Principle
No execution happens until the plan is approved or auto-authorized.

## Files
- `server/src/executive-intelligence/executive-planner.ts`

## Status: IMPLEMENTED ✅
