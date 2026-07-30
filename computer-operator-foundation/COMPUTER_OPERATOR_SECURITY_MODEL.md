# COMPUTER_OPERATOR_SECURITY_MODEL

## Purpose
Define the safety model for Mi Computer Operator Division.

This model is designed for:
- browser automation
- desktop automation
- file handling
- evidence capture
- approval-governed actions

## Mandatory Rules

### 1. No credential logging
- usernames may be masked if necessary
- passwords must never be logged
- session cookies and tokens must never be written to plaintext logs

### 2. No password screenshots
- password fields must be redacted automatically
- login screenshots should occur before password entry or after authenticated landing page load

### 3. No production write without approval
- any action changing data, settings, content, or records requires approval token validation

### 4. No destructive action without approval
- delete/remove/revoke/disable actions require stronger approval than ordinary writes

### 5. MFA requires human handoff
- operator runtime may pause at MFA checkpoint
- human completes MFA
- operator resumes only after explicit approval

### 6. All actions recorded
- every run gets execution ID
- every step gets timestamped log entry
- evidence bundle linked to task and objective IDs

### 7. All screenshots redacted if sensitive
- redact passwords
- redact tokens
- redact payment/financial sensitive fields
- redact customer PII where practical

### 8. Session storage encrypted
- browser profiles encrypted at rest where possible
- cookie/session stores isolated per target system
- desktop secrets never stored in plain files

### 9. Operator runs in sandbox mode first
- all new workflows start on test systems, safe pages, demo environments, or read-only mode
- promotion to production-target mode requires review

---

## Approval Levels

### READ_ONLY
Allowed actions:
- login with approved session
- inspect pages
- read data
- capture screenshots
- download reports

Examples:
- read Toast sales
- read DoorDash campaign status
- verify internal dashboard widgets

### SAFE_WRITE
Allowed actions:
- non-destructive changes with low blast radius
- harmless internal updates
- acknowledged file uploads in safe environments

Examples:
- upload a harmless document to a test portal
- update internal note in low-risk system

### PRODUCTION_WRITE
Allowed actions:
- production changes with business impact but not directly financial or security-critical

Examples:
- DreamHost deploy verification action
- content/config updates in production app portals

### FINANCIAL_ACTION
Allowed actions:
- actions involving accounting or financial systems
- QuickBooks Desktop actions
- payment or reconciliation adjacent tasks

Examples:
- trigger QuickBooks sync
- alter accounting-linked records

### SECURITY_ACTION
Allowed actions:
- DNS changes
- WAF changes
- credential/security configuration changes

Examples:
- Cloudflare DNS edit
- firewall/WAF policy update

---

## Approval Requirements by Level

| Level | Human approval required? | Dual approval recommended? | MFA handoff required? |
|---|---|---|---|
| READ_ONLY | Sometimes | No | If target requires it |
| SAFE_WRITE | Yes | No | If target requires it |
| PRODUCTION_WRITE | Yes | Often | Yes if applicable |
| FINANCIAL_ACTION | Yes | **Yes** | Yes |
| SECURITY_ACTION | Yes | **Yes** | Yes |

---

## Secret Handling Policy
- use a vault, never markdown files, source files, or plaintext JSON
- inject credentials at runtime only
- do not echo secrets to terminal
- clear memory/state after run when feasible
- rotate sessions if compromise suspected

## Session Policy
- one browser profile per target system
- one environment per approval scope
- separate sandbox vs production profiles
- inactivity timeout auto-expiry
- encrypt archived session state

## Evidence Policy
Evidence bundle should contain:
- redacted screenshots
- step log
- downloaded artifacts hashes
- outcome summary
- approval references
- target system identifier

Evidence must not contain:
- raw passwords
- unredacted MFA codes
- bearer tokens
- full card/bank/payment secrets

## Runtime Isolation Policy
- use dedicated operator Windows account
- restrict filesystem directories
- restrict browser downloads to operator workspace
- block arbitrary shell execution from browser steps
- desktop helper should only access allowed processes/windows

## Failure Handling Policy
On any of these, stop immediately:
- MFA requested unexpectedly
- unknown destructive prompt appears
- target content diverges materially from expected flow
- sensitive data appears unexpectedly
- approval token missing or expired

## Governance Recommendation
Before production rollout, Mi should implement:
1. approval token verifier
2. evidence redactor
3. session vault adapter
4. execution policy middleware
5. target allowlist per operator adapter

## Final Security Position
Mi Computer Operator Division should be **approval-first, evidence-first, sandbox-first**, with strict separation between:
- read vs write
- safe write vs production write
- production write vs financial/security actions
