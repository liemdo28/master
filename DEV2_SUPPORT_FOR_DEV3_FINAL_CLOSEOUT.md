# DEV2 SUPPORT FOR DEV3 FINAL CLOSEOUT

Date: 2026-06-14
Target: `JARVIS_FOR_LIEM_DO_V4_PRODUCTION_CERTIFIED`

## Dev2 Boundary

Dev2 can support Dev3 with real data, connector runtime, Enterprise Brain evidence, and safe approval-gated Google actions.

Dev2 is not taking ownership of:

- Browser operator execution certification
- Autonomous work-order execution
- Marketing asset production
- Website/social publish workflows
- QA engine certification
- 24h burn-in ownership

Those remain Dev3 closeout responsibilities.

## Runtime Status

Validated:

- Mi-Core: online at `http://127.0.0.1:4001`
- Google OAuth: `connected`
- Google token: `has_tokens=true`
- Enterprise Brain: `ENTERPRISE_BRAIN_V4_CERTIFIED`
- Actions API: `status=ok`
- Build: `npm run build` PASS

## Dev2 Hotfixes Applied

Fixed Google action adapter token paths so Dev3 action APIs can use the same OAuth token certified by Dev2:

- `server/src/actions/gmail-action-adapter.ts`
- `server/src/actions/drive-action-adapter.ts`

Fixed Mi-Core Google token status check:

- `server/src/index.ts`

Added Google Sheets OAuth scope for the next authorization cycle:

- `server/src/visibility/connectors/google/google-auth.ts`

Updated COO business Google Workspace agents to use the saved OAuth refresh token when `GOOGLE_REFRESH_TOKEN` is not present:

- `server/src/coo-v4/agents/business-agents.ts`

## C2 - Google Workspace Support

Certified read support:

- Gmail read/search: available
- Drive read/search: available
- Calendar read: available

Validated action endpoints:

- `GET /api/actions/health`
- `POST /api/actions/gmail/search`
- `POST /api/actions/drive/search`

Real evidence:

- Gmail search returned real emails, including LinkedIn, VietnamWorks, Vietcombank, TaskFlow, and cron alert messages.
- Drive search returned real Drive files, including `Raw Daily 2026`, `Bakudan - Broth Count Log`, and `Dashboard`.

Approval-gated write support:

- Gmail draft/create is Level 2/write.
- Drive upload is Level 2/write.
- Gmail send and Drive share remain higher-risk/approval-gated.

Important Sheets blocker:

- Code now requests `https://www.googleapis.com/auth/spreadsheets`.
- Existing Google token does not yet include the Sheets scope.
- To certify `Read Google Sheet` and `Update Google Sheet`, re-open `http://127.0.0.1:4001/api/auth/google/start` and approve the expanded Sheets scope.
- Then rerun `POST /api/visibility/sync` and execute the Dev3 Sheet proof.

Current token scope status:

- `HasSheetsScope=false`

## C8 - Executive Assistant Real Data Support

Acceptance Question 1:

`Hôm nay anh có gì cần xử lý?`

Status:

- PASS
- Sources: Calendar, Gmail, Projects, Work Orders, Finance
- Evidence: `3` calendar events today, `46` unread emails, `17` projects, `8` open work orders, QuickBooks activity signal.

Acceptance Question 2:

`Có email nào quan trọng?`

Status:

- PASS
- Source: real Gmail cache
- Evidence includes TaskFlow and cron alert emails.

Acceptance Question 3:

`Có file nào cần xử lý?`

Status:

- PASS
- Source: real Google Drive cache
- Evidence includes recent Drive files and sheets.

Acceptance Question 4:

`Có gì cần anh duyệt?`

Status:

- PASS
- Source: Work Orders and Operational Memory
- Evidence includes `WO-20260613-024` Dashboard production deploy waiting for approval.

Acceptance Question 5:

`Có gì đáng lo?`

Status:

- PASS
- Source: Graph, Operational Memory, Digital Twin
- Evidence: Mi-Core critical SPOF simulation and Dashboard dependency risks.

Acceptance Question 6:

`Doanh thu sao rồi?`

Status:

- NOT PRODUCTION CERTIFIED YET
- Current answer falls back to Knowledge search, not live POS/QuickBooks revenue.
- Dev3 should not count this as production proof until a real revenue/POS/QuickBooks report endpoint is used.

## Recommended Dev3 Use

Use these Dev2-certified endpoints:

- `GET /api/enterprise/brain-v4/final-certification`
- `GET /api/enterprise/brain-v4/google-connector-certification`
- `GET /api/enterprise/brain-v4/connector-proof?q=...`
- `GET /api/enterprise/brain-v4/answer?q=...`
- `POST /api/actions/gmail/search`
- `POST /api/actions/gmail/read`
- `POST /api/actions/drive/search`
- `POST /api/actions/drive/read`
- `POST /api/approval/request`
- `POST /api/approval/:id/approve`

For real write actions:

- Dev3 must create an approval request with `after_state` containing the action payload.
- Approval route executes approved actions through `server/src/actions/google-executor.ts`.
- No production publish/send/share should bypass approval.

## Current Dev2 Verdict

Dev2 support package:

- `ENTERPRISE_BRAIN_V4_CERTIFIED`
- `GOOGLE_CONNECTOR_RUNTIME_READY`
- `EXECUTIVE_ASSISTANT_REAL_DATA_PARTIAL_READY`

Remaining Dev3 blockers:

- Re-consent Google OAuth for Sheets scope.
- Produce real Sheet read/update evidence.
- Produce real browser operator evidence.
- Produce autonomous execution, marketing, website, social, finance, smooth runtime, and 24h burn-in evidence.
- Replace revenue fallback with live finance/POS/QuickBooks proof before claiming full C8.

