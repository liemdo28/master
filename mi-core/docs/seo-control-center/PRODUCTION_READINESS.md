# SEO Control Center Production Readiness

Readiness verdict: CHANGES_REQUIRED for full production readiness.

Allowed:
- Disabled/read-only loading.
- Controlled preview verification.
- Draft-only SEO workflow review.
- CSV/JSON/PDF/DOCX data-analyst ingestion.

Not allowed:
- Live website publishing.
- GBP post publishing.
- Production deployment.
- Automatic SEO writes.
- Excel/XLSX parse or generation until a safe replacement is approved.
- Production CI changes.

Security gates now required before high-risk mutations:
- Bearer session.
- Trusted server-assigned role/scope.
- Server-selected trusted identity; clients cannot choose a mapped identity.
- Explicit route policy.
- RBAC permission.
- CSRF token.
- Resource-aware brand/location scope.
- Bound approval matching exact category/action/target/scope.
- Strict actor and payload-hash binding.
- Pre-side-effect approval claim.
- Approval execution lifecycle with success/failure finalization.
- Finalization-failure state with durable evidence and manual reconciliation requirement.
- Fresh approval based on `resolved_at`.
- Durable high-risk audit record.
- One-time approval consumption after success.

Remaining external blockers:
- Google connectors remain blocked until credential refresh is completed.
- GitHub Actions must run on the pushed PR head.
- PM2 read-only load and observation have not been run in this patch.
