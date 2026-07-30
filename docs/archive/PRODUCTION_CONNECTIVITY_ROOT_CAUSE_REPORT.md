# Production Connectivity Root Cause Report

Generated: 2026-06-18 15:20 ICT

## QuickBooks

Root cause:

1. SEO Local Maps occupied Mi-Core port `4001`.
2. After fixing the collision, Laptop1 still did not post a fresh heartbeat or report.
3. Laptop1 is active on Tailscale, so the remaining blocker is the Laptop1 QB bridge/agent runtime.

Fix attempted:

- moved SEO Local Maps to `4011`
- restarted Mi-Core on `0.0.0.0:4001`
- waited for bridge recovery
- retested QB endpoint

Result: `UNREACHABLE`

Remaining blocker: restart/fix Laptop1 heartbeat bridge and run fresh read-only sales and P&L reports.

## Toast

Root cause: authenticated Toast browser session is unavailable and the latest flow stopped at CAPTCHA.

Fix attempted: inspected runtime, report folders, session handoff, and Money Operations endpoint.

Result: `DATA_MISSING`

Remaining blocker: human login/MFA/CAPTCHA completion on the production laptop, followed by a fresh report download.

## DoorDash

Root cause:

- production server build target is missing
- no credential vault
- no DoorDash store IDs
- available snapshots are manual, not merchant reads
- credential status endpoint has an RBAC permission-name mismatch

Fix attempted:

- started source runtime on port `3000`
- read store, snapshot, selector, and package endpoints
- verified source provenance

Result: `DATA_MISSING`

Remaining blocker: production merchant credentials/session, real store IDs, live campaign read, and server build/RBAC fixes.

## Payroll

Root cause: provider integration is not implemented.

Fix attempted: inspected source registry, Money Operations workflow, provider references, and runtime endpoint.

Result: `NOT_IMPLEMENTED`

Remaining blocker: select provider and build a read-only integration before credentials can be meaningfully configured.

## Tax

Root cause: IRS/tax-provider integration is not implemented; current tax evidence path also depends on unavailable QB reads.

Fix attempted: inspected tax source registry, tax agent, approval guardrails, and Money Operations endpoint.

Result: `NOT_IMPLEMENTED`

Remaining blocker: select authorized tax data provider/API, implement read-only access, then configure credentials.

