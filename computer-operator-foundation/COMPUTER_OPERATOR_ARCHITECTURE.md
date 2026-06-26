# COMPUTER_OPERATOR_ARCHITECTURE

## Recommendation
**Selected Option: D — OpenClaw + Playwright + Windows helper hybrid**

### Important clarification
The actual execution core should be:
- **Playwright** for deterministic browser control
- **Browser Use** as optional adaptive web reasoning layer
- **Windows helper** for native desktop applications like QuickBooks Desktop
- **Mi governance wrappers** for approvals, evidence, logging, redaction, and session policy

OpenClaw is **not** selected as the computer-use engine itself.
If Mi wants it at all, it belongs **outside** the operator execution core as a possible coordination/gateway shell later.

If we express the architecture more precisely, the real recommendation is functionally closest to:
- **Playwright + Browser Use + Windows helper hybrid**

Since the prescribed option set does not include that exact label except with OpenClaw, Option D is the nearest fit, but the design below treats OpenClaw as optional, not mandatory.

---

## Architecture Diagram

```text
CEO Objective
   ↓
Mi Executive Office
   ↓
Executive Coordination Division
   ↓
Task Registry / Approval Registry / Evidence Registry
   ↓
Computer Operator Division
   ├─ Web Operator Engine
   │   ├─ Playwright Runtime
   │   └─ Browser Use Assist Layer
   ├─ Desktop Operator Engine
   │   └─ Windows Helper Runtime (pywinauto/win32)
   ├─ Session Vault Adapter
   ├─ Screenshot / Evidence Redaction Layer
   ├─ Approval Gate
   └─ Execution Logger
   ↓
Target Surface
   ├─ Browser portals
   ├─ Desktop apps
   ├─ Files
   └─ Approved APIs
```

---

## Why selected

### 1. It matches Mi's actual surface area
Mi needs both:
- browser portals
- Windows desktop apps

A single browser-only framework cannot handle QuickBooks Desktop well.
A single desktop/generalist agent is too risky and too brittle for the browser portals.

### 2. It separates deterministic execution from adaptive reasoning
- Use **Playwright** when a repeatable flow is known
- Use **Browser Use** only where the page is highly dynamic or selector strategy becomes brittle

This keeps the core reliable while still allowing adaptive navigation when needed.

### 3. It supports safe governance
Mi requires:
- approval tiers
- evidence capture
- no credential logging
- sandbox-first runs
- human MFA handoff

A hybrid architecture allows those controls to wrap each execution type consistently.

### 4. It reduces long-term maintenance pain
- Deterministic browser tasks stay in Playwright
- Desktop-only tasks stay in Windows helper modules
- APIs are used wherever a vendor offers a stable surface

This prevents overusing browser automation for systems that already have better interfaces.

---

## Why rejected alternatives

### Option A — OpenClaw only
Rejected because OpenClaw does not show strong evidence of being a mature Windows computer operator runtime.
It looks more like a gateway/runtime ecosystem than a browser+desktop execution engine.

### Option B — Browser Use only
Rejected because Browser Use does not solve native Windows application control well enough, especially for QuickBooks Desktop.
Also less deterministic than Playwright for compliance-heavy workflows.

### Option C — Playwright + Browser Use hybrid
Rejected as incomplete because it still leaves QuickBooks Desktop and native dialogs unsolved.
Very good for browser-only companies, but Mi is not browser-only.

### Option E — Custom Operator Runtime
Rejected as a pure greenfield choice for now because it would overbuild too early.
Mi should first compose proven parts:
- Playwright
- Browser Use
- Windows helper libraries

Then wrap them in a custom Mi runtime shell.

---

## Security model

### Core principles
- credentials never appear in logs
- password fields never included in screenshots
- session stores encrypted at rest
- MFA always requires human handoff
- write actions require approval tokens
- destructive actions require stronger approval tokens
- financial and security actions require named human approver

### Isolation
- separate Windows operator account
- separate browser profiles per system
- separate encrypted session storage per system
- restricted filesystem working directory per run
- sandbox mode first before any production-target run

---

## Approval model

Approval classes:
- **READ_ONLY**
- **SAFE_WRITE**
- **PRODUCTION_WRITE**
- **FINANCIAL_ACTION**
- **SECURITY_ACTION**

### Examples
- read DoorDash orders → READ_ONLY
- export Toast report → READ_ONLY / SAFE_WRITE
- modify internal dashboard setting → SAFE_WRITE
- deploy via DreamHost control panel → PRODUCTION_WRITE
- change Cloudflare DNS/WAF → SECURITY_ACTION
- act inside QuickBooks Desktop company file → FINANCIAL_ACTION

---

## Evidence model

Every operator run should emit:
- execution ID
- task ID
- objective ID
- operator surface type (browser / desktop / api)
- start/end time
- step log
- screenshot set
- redaction manifest
- downloaded/generated artifacts
- success/failure outcome
- approval references

Evidence should be stored in an **Evidence Registry** and linked back to task records.

---

## Rollback model

### Browser portals
Rollback is often limited, so policy should prefer:
- read-only first
- pre-action screenshot
- post-action screenshot
- confirmation checkpoint before any write

### Desktop apps
For QuickBooks-style systems:
- sandbox copy when testing
- no production write without approval
- record the exact window state and operator step trace

### Infrastructure/security portals
For Cloudflare/DreamHost:
- prefer API with explicit change record
- capture prior config before write
- generate rollback payload before applying change

---

## Runtime cost

### Estimated cost profile
- Playwright runtime: **low**
- Browser Use runtime: **medium** due to model usage
- Windows helper runtime: **low-medium** infra cost, **medium-high** engineering cost
- Screenshots/evidence storage: **low-medium**, grows with volume

### Practical implication
Run Browser Use only where needed; keep most recurring work in Playwright.

---

## Maintenance cost

### Lowest maintenance
- vendor API integrations
- Playwright deterministic flows

### Medium maintenance
- Browser Use adaptive flows

### Highest maintenance
- desktop UI automation against QuickBooks or similar native apps

Therefore Mi should keep the desktop operator scope narrow and highly governed.

---

## Recommended implementation shape

### Layer 1 — Policy + coordination
Mi services provide:
- task registration
- approval checks
- evidence registration
- duplicate detection
- dependency graphing

### Layer 2 — Operator dispatcher
Chooses one of:
- API executor
- Playwright executor
- Browser Use assisted executor
- Windows desktop executor

### Layer 3 — Evidence wrappers
Common wrappers for:
- screenshot
- log capture
- redaction
- artifact hashing
- failure classification

### Layer 4 — Target adapter packs
Examples:
- DoorDash adapter
- Toast adapter
- Google adapter
- DreamHost adapter
- Cloudflare adapter
- QuickBooks Desktop adapter

## Final architecture decision
Mi should build a **hybrid operator runtime**, centered on **Playwright**, augmented by **Browser Use**, and extended with a **Windows desktop helper** for QuickBooks Desktop and native application control.

That is the right Phase 2 foundation because it is:
- realistic
- controllable
- incremental
- security-compatible
- aligned to Mi's actual business systems
