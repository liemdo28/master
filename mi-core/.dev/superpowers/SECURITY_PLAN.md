# Security Plan

## Controls
- No secrets in reports, logs, MinIO, Postgres, or Qdrant.
- Direct production mutations require approval gates.
- Agents cannot directly write canonical stores.
- Provider access is only through provider router.
- Browser writes require approval IDs.

## Review Checklist
- [ ] Secrets redacted
- [ ] Audit log emitted
- [ ] Permission layer checked
- [ ] Queue used for heavy work
- [ ] No direct provider calls added
- [ ] No hidden database introduced
