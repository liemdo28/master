# mi-code-review

Review stance for mi-core.

Prioritize:

- Data loss, credential exposure, and unsafe file or remote actions.
- Broken connector contracts between `server`, `local-agent`, `agent-engine`, and `mi-remote-agent`.
- Missing approval gates for write, delete, deploy, send, or remote execution.
- Missing verification for user-facing UI, WhatsApp/API integration, or business automation.
- Drift from `MI_MASTER_ARCHITECTURE.md`.

Output findings first, ordered by severity, with file references and concrete remediation.

