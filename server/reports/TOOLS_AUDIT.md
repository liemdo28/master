# Tool Registry Audit — Phase 23
**Generated:** 2026-06-12T11:05:00Z  
**Source:** GET /api/jarvis/tools  
**Verdict:** PROVEN (registry real; execution is stub-only)

---

## All 20 Registered Tools

| ID | Name | Owner | Risk | Approval | Permissions | Health | Enabled |
|----|------|-------|------|----------|-------------|--------|---------|
| gmail.search | Gmail Search | google | 0 | No | gmail.read | unknown | ✅ |
| gmail.send | Gmail Send | google | 2 | **YES** | gmail.send | unknown | ✅ |
| drive.search | Drive Search | google | 0 | No | drive.read | unknown | ✅ |
| drive.create | Drive Create | google | 1 | No | drive.write | unknown | ✅ |
| excel.create | Excel Create | mi-core | 0 | No | — | **healthy** | ✅ |
| node.status | Node Status | mi-core | 0 | No | — | **healthy** | ✅ |
| node.restart | Node Restart | mi-core | **3** | **YES** | node.admin | unknown | ✅ |
| project.deploy | Project Deploy | mi-core | **3** | **YES** | node.admin, deploy | unknown | ❌ disabled |
| project.logs | Project Logs | mi-core | 0 | No | — | **healthy** | ✅ |
| project.logs.clear | Clear Logs | mi-core | **2** | **YES** | node.admin | **healthy** | ✅ |
| doordash.status | DoorDash Status | doordash | 0 | No | — | **healthy** | ✅ |
| doordash.revenue | DoorDash Revenue | doordash | 0 | No | finance.read | unknown | ✅ |
| quickbooks.invoice | QB Invoice | quickbooks | 0 | No | finance.read | unknown | ✅ |
| whatsapp.send | WhatsApp Send | mi-core | **2** | **YES** | whatsapp.send | **healthy** | ✅ |
| knowledge.search | Knowledge Search | mi-core | 0 | No | — | **healthy** | ✅ |
| memory.store | Memory Store | mi-core | 0 | No | — | **healthy** | ✅ |
| memory.recall | Memory Recall | mi-core | 0 | No | — | **healthy** | ✅ |
| workflow.run | Workflow Run | mi-core | **2** | **YES** | workflow.exec | **healthy** | ✅ |
| review.summary | Review Summary | mi-core | 0 | No | — | **healthy** | ✅ |
| store.ops | Store Ops | mi-core | 0 | No | — | **healthy** | ✅ |

---

## Dangerous Tools (Risk ≥ 2) — 5 Total

| Tool | Risk | Approval Gate |
|------|------|---------------|
| gmail.send | 2/3 | ✅ YES |
| node.restart | 3/3 | ✅ YES |
| project.deploy | 3/3 | ✅ YES (disabled) |
| project.logs.clear | 2/3 | ✅ YES |
| workflow.run | 2/3 | ✅ YES |

---

## Dangerous Tool Tests (via WhatsApp approval gate)

| Action | Intent | Approval Gate Triggered |
|--------|--------|------------------------|
| "Xóa logs cũ trên Laptop1" | clear_logs | ✅ YES — returns approval_id |
| "Restart gateway" | laptop1_restart | ✅ YES — requires CEO confirm |
| "Xóa logs" | clear_logs | ✅ YES (tested in 47/47 acceptance) |

**Evidence:** WhatsApp approval gate was specifically tested and proven in real-world acceptance test (Phase D, 47/47 run).

---

## Gaps

1. **Tool health = "unknown"** for Google/DoorDash/QB tools — no real connectivity (OAuth not configured)
2. **Execution is stub** — tool.run() returns simulated success, not real API call
3. **No real Gmail/Drive integration** — tokens not configured
4. **project.deploy disabled** — intentionally blocked until CD pipeline built
