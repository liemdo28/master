# Technology Portfolio Scorecard

Status: PARTIAL
Source: `mi-core/server/src/technology-portfolio-office/portfolio-scorecard.ts`

Score formula:
- business value minus risk penalty minus maintenance penalty
- score clamped between 0 and 100

Recommendations:
- `OPERATE` for production/maintenance systems.
- `PILOT` for approved pilot systems.
- `APPROVE` only when score is high and approval is not required.
- `AUDIT` for useful but unproven candidates.
- `WATCH` for lower score or unclear fit.

No asset can move to pilot/production solely because of score. It still needs owner, approval evidence, and rollback plan.
