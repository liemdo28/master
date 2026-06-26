# MI_OPERATOR_REQUIREMENTS_MAPPING

## Purpose
Map real Mi use cases to operator tools, identifying:
- Can browser automate this?
- Does it need desktop control?
- Can API replace operator?
- Credential risk
- MFA risk
- Recommended operator tool

Use cases evaluated:
1. DoorDash Merchant Portal
2. QuickBooks Desktop
3. Toast Portal
4. Google Business Profile
5. DreamHost
6. Cloudflare
7. Internal Dashboard

---

## 1. DoorDash Merchant Portal

### Tasks
- login
- read campaign
- read orders
- handle Cloudflare/WAF
- screenshot evidence

### Analysis
- **Can browser automate?** Yes, mostly
- **Need desktop control?** No, but Playwright must handle WAF challenges (TLS fingerprint, turnstile, human-like interaction)
- **Need API instead?** No public Merchant API; portal is the canonical source
- **Credential risk?** Medium-High
  - DoorDash may flag abnormal automation
- **MFA risk?** Medium-High
  - MFA / device verification / CAPTCHAs are common
- **Recommended operator tool?** **Playwright** (deterministic) wrapped by Browser Use for adaptive login flows, with screenshot evidence and explicit approval gates

### Notes
- Need residential-friendly fingerprint
- Need Cloudflare/turnstile handling policy
- Need human approval before write actions
- Need screenshot evidence of portal state after each run

---

## 2. QuickBooks Desktop

### Tasks
- open app
- trigger QB Web Connector
- verify sync
- screenshot evidence

### Analysis
- **Can browser automate?** No. QuickBooks Desktop is a native Windows application
- **Need desktop control?** **Yes** — required
- **Need API instead?** QB has limited online API surface; for direct company-file operations, Desktop is the source of truth
- **Credential risk?** High (financial system)
- **MFA risk?** Medium (administrator login + file permissions)
- **Recommended operator tool?** **Custom Windows helper runtime** (pywinauto / win32gui)
  - launch QB
  - interact with QB Web Connector window
  - read sync logs
  - capture screenshot
  - never auto-modify production company files without approval

### Notes
- Highest security requirements
- Treat as **FINANCIAL_ACTION** tier
- Lockdown:
  - dedicated sandboxed Windows user
  - file access only to specific QB company file copy
  - every action recorded with screenshots

---

## 3. Toast Portal

### Tasks
- login
- read sales/orders
- download report

### Analysis
- **Can browser automate?** Yes
- **Need desktop control?** No
- **Need API instead?** Toast has Toast API, but portal report export is often still the workflow expected
- **Credential risk?** Medium
- **MFA risk?** Medium
- **Recommended operator tool?** **Playwright** (primary), with Browser Use fallback when portal layout changes

### Notes
- Daily sales/orders download can be scheduled
- Evidence: downloaded file + screenshot of dashboard

---

## 4. Google Business Profile (GBP)

### Tasks
- login
- inspect locations
- read reviews
- read performance

### Analysis
- **Can browser automate?** Yes
- **Need desktop control?** No
- **Need API instead?** Google Business Profile API exists and is strongly preferred where possible
- **Credential risk?** High (Google account)
- **MFA risk?** High (Google MFA is strict)
- **Recommended operator tool?**
  - Primary: **Google Business Profile API** (preferred)
  - Fallback only when API not available: **Playwright** with strict approval and human handoff for MFA

### Notes
- Mi should not auto-bypass Google MFA. Human handoff is mandatory for MFA steps
- Screenshots required for evidence

---

## 5. DreamHost

### Tasks
- login
- inspect files
- verify deploy

### Analysis
- **Can browser automate?** Yes
- **Need desktop control?** No
- **Need API instead?** DreamHost API exists and should be the primary path for file/deploy verification
- **Credential risk?** Medium
- **MFA risk?** Medium
- **Recommended operator tool?**
  - Primary: **DreamHost API**
  - Fallback: **Playwright** if API insufficient for a specific dashboard view

### Notes
- Use API for cron/automation
- Reserve browser fallback for dashboard verification

---

## 6. Cloudflare

### Tasks
- login
- inspect DNS
- inspect WAF

### Analysis
- **Can browser automate?** Yes
- **Need desktop control?** No
- **Need API instead?** Cloudflare API is excellent and should be the primary
- **Credential risk?** High
- **MFA risk?** High
- **Recommended operator tool?**
  - Primary: **Cloudflare API**
  - Fallback only for visual verification: **Playwright** with screenshot evidence

### Notes
- Treat DNS and WAF edits as **SECURITY_ACTION** tier if Mi ever needs to write

---

## 7. Internal Dashboard

### Tasks
- login
- verify widgets
- screenshot proof

### Analysis
- **Can browser automate?** Yes
- **Need desktop control?** No
- **Need API instead?** Possibly — depends on dashboard architecture
- **Credential risk?** Low-Medium (internal)
- **MFA risk?** Low-Medium
- **Recommended operator tool?** **Playwright** for screenshot-based proof
  - Replayable, deterministic, cheap

### Notes
- Screenshot evidence is the primary value
- Lowest tier of approval needed (READ_ONLY usually sufficient)

---

## Summary Table

| Use case | Browser? | Desktop? | API alt? | Credential risk | MFA risk | Recommended tool |
|---|---|---|---|---|---|---|
| DoorDash Merchant | Yes | No | No | Med-High | Med-High | Playwright + Browser Use |
| QuickBooks Desktop | No | **Yes** | Limited | **High** | Medium | Custom Windows helper |
| Toast Portal | Yes | No | Optional | Medium | Medium | Playwright |
| Google Business Profile | Yes | No | **Yes (preferred)** | High | **High** | API primary; Playwright fallback with MFA handoff |
| DreamHost | Yes | No | **Yes (preferred)** | Medium | Medium | API primary; Playwright fallback |
| Cloudflare | Yes | No | **Yes (preferred)** | High | High | API primary; Playwright fallback for visual |
| Internal Dashboard | Yes | No | Optional | Low-Med | Low-Med | Playwright |

## Cross-Cutting Risks
- Cloudflare/WAF detection for any browser-automation path
- Portal layout changes breaking selectors
- MFA / device verification interrupting flows
- Cost of maintaining a separate desktop helper for QuickBooks
- Sensitive screenshots leaking PII or financial data