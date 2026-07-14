# SEO Control Center Security Audit

Verdict: CHANGES_REQUIRED for full production readiness.

Resolved findings:
- Login privilege escalation: fixed. Client role/scope fields are ignored; trusted server-side mapping is authoritative.
- Client-controlled identity selection: fixed. `user_id` and `username` in the login body are ignored; the trusted identity key is server-selected.
- Invalid role escalation: fixed. Unknown trusted roles reject login.
- Approval confusion/reuse: fixed. High-risk SEO approvals require bound category/action/target/scope metadata and one-time consumption.
- Approval claim timing: fixed. Bound approvals are claimed before route side effects run.
- Approval execution lifecycle: fixed for high-risk route handlers through READY -> CLAIMED -> EXECUTING -> SUCCEEDED/FAILED/FINALIZATION_FAILED/CANCELLED/STALE state.
- Generic approval execution is now recorded only after successful operation finalization.
- Finalization failure: fixed. If a side effect succeeds but approval finalization fails, the API returns `operation_succeeded_finalize_failed`, records durable evidence, blocks automatic retry, and requires CEO reconciliation.
- Actor/payload confusion: fixed. Actor and payload hash bindings use strict equality and cannot be silently skipped.
- Payload canonicalization: fixed. Approval payload hashing uses stable canonical JSON with sorted object keys.
- Approval TTL source: fixed. TTL uses `resolved_at`.
- Object-ID scope bypass: fixed. Resource resolvers enforce stored brand/location scope for object-ID mutation routes.
- Unknown mutation fallback: fixed. Unknown mutation paths fail closed with `seo_route_policy_missing`.
- Query token SEO auth: fixed. SEO routes require Bearer auth.
- High-risk audit loss: fixed. Audit persistence failure blocks high-risk mutations.

Still intentionally disabled:
- Live website publishing.
- GBP write actions.
- Backlink write actions unless the explicit disabled-write flag is enabled.
- Automatic production SEO writes.
- Google connector writes unless `GOOGLE_CONNECTOR_WRITE_ENABLED=true` is explicitly set.

No critical or high authorization findings remain in the implemented disabled-load scope.

Dependency advisory:
- `xlsx` was reachable through legacy Excel/data-analyst helpers. The dependency was removed, Excel parsing/generation now fails closed, and CSV is the supported spreadsheet interchange until a safe replacement is selected.

GitGuardian status:
- Historical synthetic fixture incidents `34784093` and `34784094`: `RESOLVED_AS_FALSE_POSITIVE`.
- PR check status: `CHECK_STATUS_SKIPPING`.
- Historical source commit: `c8e01032`.
- Current head contains no secret-shaped fixtures.
- Local scan found no real secret.
- No credential rotation was required because the findings were synthetic test fixtures, not real credentials.
