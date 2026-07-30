# People Digital Twin Engine

Phase: V4-37
Target: PEOPLE_DIGITAL_TWIN_READY

## Objective

Create a trusted operational twin for each person or owner in Mi's operating system.

## Architecture

Inputs:

- owner memory
- work orders
- execution ledger
- skill registry
- blocker records
- QA and certification reports
- project ownership graph

## Runtime

The engine is read-only. It summarizes capacity, skills, active responsibilities, blocker ownership, delivery evidence, and risk.

## Output

- owner id
- owned projects
- active work orders
- skills
- current blockers
- workload score
- overload risk
- missing evidence
- recommended next assignment

## QA

No people twin may infer performance without evidence. Unknown must be reported as unknown.

## Acceptance Test

CEO asks: "Dev nao dang giu blocker?"

Mi returns the owner, blocker, affected project, age, severity, and recommended action.

## Certification Gate

PEOPLE_DIGITAL_TWIN_READY requires runtime query evidence against real owner/work-order data.

## Final Status

PEOPLE_DIGITAL_TWIN_DESIGN_READY

