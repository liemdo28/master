# mi-safe-patch-workflow

Use for code changes in mi-core.

1. Inspect existing code paths and tests before editing.
2. Prefer small patches that preserve current module boundaries.
3. For risky actions, route through Approval Gate rules before enabling write/delete/deploy behavior.
4. Keep generated state out of source unless it is a documented fixture or report.
5. After edits, run the smallest relevant verification command first, then broaden only if the touched surface warrants it.
6. Record evidence in a concise report when the change affects owner workflows, connectors, security, or remote control.

