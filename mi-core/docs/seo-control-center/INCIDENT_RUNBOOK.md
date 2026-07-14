# SEO Control Center Incident Runbook

Severity triggers:
- Unauthorized SEO route access.
- Approval reuse attempt.
- `FINALIZATION_FAILED` approval execution.
- Audit persistence unavailable for high-risk mutation.
- Unexpected website or GBP write.
- Google connector token or permission failure.
- ChatGPT browser provider timeout or schema drift.

First response:
1. Keep write flags disabled.
2. Preserve audit logs and approval execution evidence.
3. Record current Git SHA and request correlation ID.
4. Stop the affected workflow, not the whole production system, unless core Mi-Core health is degraded.
5. If production stability is affected, execute `ROLLBACK_RUNBOOK.md`.

Manual reconciliation:
- Required for `FINALIZATION_FAILED`.
- Requires CEO permission.
- Must record evidence, actor, target, correlation ID, and final decision.
- Must not rerun the original side effect automatically.
