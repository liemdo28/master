# mi-context-briefing

Use before planning any meaningful mi-core change.

1. Read `MI_MASTER_ARCHITECTURE.md` and the newest relevant `*_REPORT.md` or `*_REVIEW.md` files.
2. Identify which Mi layer is affected: Owner Brain, Memory, Knowledge Federation, Visibility, Project Registry, Connector Layer, Approval Gate, Execution Engine, QA/Security, or Remote Control.
3. State the affected runtime surfaces: `server`, `agent-engine`, `local-agent`, `mi-remote-agent`, `ui`, or external connector.
4. Check whether the work touches owner data, credentials, message history, file access, remote devices, or business automation.
5. Produce a short task brief with scope, risk, verification path, and files expected to change.

