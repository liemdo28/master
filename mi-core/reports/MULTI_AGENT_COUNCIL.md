# MULTI_AGENT_COUNCIL — Phase 21
**Target:** COUNCIL_READY ✅

## What It Does
Before risky actions, Mi convenes a structured agent discussion.
6 agents vote from their domain perspective → consensus → CEO sees result.

## The 6 Agents

| Agent | Domain | Blocks On |
|-------|--------|----------|
| `pm` | PM Agent | Undefined scope, missing requirements |
| `qa` | QA Agent | No tests, skipping QA, untested code |
| `dev` | Dev Agent | Unsafe code, hard deletes, rm -rf |
| `security` | Security Agent | Exposed secrets, bypassed auth, credential leaks |
| `ops` | Ops Agent | Deploy without tests, no rollback plan |
| `knowledge` | Knowledge Agent | Advisory only — no hard blocks |

## Consensus Logic

| Condition | Consensus |
|-----------|-----------|
| Any agent BLOCK | `BLOCK` |
| ≥2 agents CONCERN | `ESCALATE_TO_CEO` |
| 1 agent CONCERN | `PROCEED_WITH_CONDITIONS` |
| All APPROVE | `PROCEED` |

## Fast-Path Skip
Simple read-only operations skip the council entirely:
- health check, pm2 status, log scan, audit read, knowledge search, daily report

## API Routes
```
POST /api/council/session    — body: { request: string, agents?: AgentId[] }
GET  /api/council/agents     — list all agent profiles + their block patterns
```

## Example
```
Request: "deploy to production with no test coverage"
→ dev BLOCK (unsafe)
→ ops BLOCK (no test)
→ qa BLOCK (untested)
Consensus: BLOCK
CEO Message: "🚫 Council đề nghị BLOCK — dev Agent phát hiện rủi ro nghiêm trọng"
```
