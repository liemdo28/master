# Graph Response Guard Report

Target: GRAPH_RESPONSE_GUARD_READY

Implemented intent labels:

- `graph_lookup`
- `operational_status`
- `action_request`
- `marketing_request`
- `finance_request`
- `connector_check`

API:

`GET /api/executive/intent?message=Dashboard%20hom%20nay%20co%20gi`

Chat guard:

`server/src/routes/chat.ts` calls `classifyExecutiveIntent()` and `formatExecutiveSnapshotAnswer()` before falling through to old graph/LLM paths for operational questions.

Acceptance smoke:

- `Dashboard hôm nay có gì?` -> `operational_status`
- `QB sync sao rồi?` -> `finance_request`
- `Raw Sushi website đã sync chưa?` -> `marketing_request`

Rule:

Operational status questions must return executive snapshot summaries, not raw graph node dumps.
