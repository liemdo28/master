# mi-verification-loop

Use before declaring work complete.

1. Map changed files to verification commands.
2. Run static checks for the touched package when available.
3. Run targeted tests or smoke scripts for the affected workflow.
4. For UI changes, capture browser/mobile evidence when the surface is user-facing.
5. For connectors, verify health, last sync, error propagation, and fallback behavior.
6. Report commands run, pass/fail status, and unverified residual risk.

