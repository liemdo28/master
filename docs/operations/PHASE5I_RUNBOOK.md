# Phase 5I Operator Runbook

## Creating a delegation

```bash
npm run personal-os -- delegation create < delegation.json
```

`delegation.json` shape (`CreateDelegationInput`, `server/src/personal-os/delegation/types.ts`):

```json
{
  "title": "Morning customer follow-up drafts",
  "description": "...",
  "owner": "liem",
  "projectId": "mi-core",
  "allowedActionTypes": ["GMAIL_CREATE_DRAFT"],
  "targetRestriction": { "allowedDomains": ["example.com"], "maxRecipients": 3 },
  "riskCeiling": "R2",
  "approvalLevelCeiling": "STANDARD",
  "startsAt": "2026-08-11T09:00:00+07:00",
  "expiresAt": "2026-08-11T12:00:00+07:00",
  "timezone": "Asia/Ho_Chi_Minh",
  "maxExecutions": 3
}
```

This creates a `DRAFT`. Nothing is authorized yet.

## Approving (activating) a delegation

```bash
npm run personal-os -- delegation submit <id>
npm run personal-os -- delegation approve <id> --approver liem --confirm "AUTHORIZE:<id>"
```

The CLI prints the exact scope (project, action types, window, risk ceiling, quotas)
before you type the confirmation phrase. There is no shortcut — `--approver` and
`--confirm` are both mandatory every time, and `--approver` can never be `mi`,
`system`, `automation`, `delegation`, or `ai`.

## Inspecting a delegation

```bash
npm run personal-os -- delegation show <id>
npm run personal-os -- delegation evidence <id>
```

`show` prints current status, quota usage (`usedExecutions/maxExecutions`), and the
exact target scope. `evidence` prints the full append-only event and decision trail —
every `delegation.evaluated` entry shows whether a specific proposal was authorized or
denied, and why.

## Revoking immediately

```bash
npm run personal-os -- delegation revoke <id> "reason" --actor liem
```

Effective before the next `advance()`/`tryAuthorize()` call observes it — no new
delegated execution can begin after this. Already-`WAITING_APPROVAL` Controlled
Actions under the delegation are **not** auto-rejected by revocation itself; they
simply lose their delegated-authorization path and fall back to requiring a normal
human approval on the Actions page, same as if no delegation had ever existed.

The Command Center Delegations detail page always has a single, prominent
**REVOKE DELEGATION** button — no need to navigate through multiple screens.

## Diagnosing a denied delegated execution

1. `delegation show <id>` — confirm status is `ACTIVE` and the operating window covers
   now.
2. `delegation evidence <id>` — find the `delegation.evaluated` / `delegation.execution.denied`
   entry for the proposal in question; the `reasons` array names the exact failed
   check (wrong project, target scope, risk ceiling, quota, policy, kill switch,
   budget, payload mismatch, etc.).
3. If `status` is `PAUSED_POLICY_CHANGED`: the active Phase 5G policy set changed
   since this delegation was approved. Review the new policy, then either
   `delegation resume` it (if the new policy still permits the exact declared scope —
   no re-approval needed, the scope itself is unchanged) or create a new delegation
   version and re-approve.
4. If `status` is `EXHAUSTED`: `maxExecutions` was reached. A new delegation is
   required — quota never refills on an existing one.

## Widening an existing delegation's authority

There is no "edit" operation. Create a brand new delegation (new `id`, or use
`createNewVersion`-equivalent flow once exposed) and obtain a fresh strong approval —
the old delegation's approval never transfers to a wider scope.
