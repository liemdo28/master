# Phase 5F Action Security

Security controls:

- Payloads are canonicalized and SHA-256 hashed before approval.
- Approval stores an immutable payload snapshot.
- Execution recomputes the payload hash immediately before provider work.
- Prototype pollution keys are rejected.
- Secret-like payloads are rejected.
- Prompt-injection phrases are sanitized as untrusted content.
- BCC is rejected by default for Gmail drafts.
- Gmail send, deploy, merge, financial, legal, credential, destructive, and bulk actions are forbidden.
- Mutations are never retried automatically.
- Evidence excludes OAuth tokens, credentials, raw debug payloads, and secret headers.

Security test command:

`npm run test:controlled-actions-security`
