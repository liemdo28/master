# DATA_SOURCE_INVENTORY.md
> All data sources Mi reads from or writes to.
> Evidence: MI_LINKED_SOURCES_AUDIT.md, connector-registry.json, .env.example files.
> Updated: 2026-06-18 | Total: 17 sources | 100% documented

---

## Source Health Summary

| Status | Count |
|--------|-------|
| healthy | 12 |
| degraded | 1 |
| unknown | 4 |

---

## Financial Sources

| Source | Owner | Credential | Truth Level | Write | Approval | Health |
|--------|-------|-----------|------------|-------|----------|--------|
| QuickBooks Desktop | finance | DEGRADED | PRIMARY | No | Yes | ⚠️ degraded |
| Accounting Engine SQLite | finance | CONFIGURED | DERIVED | No | Yes | ✅ healthy |
| Payroll System | finance | **MISSING** | PRIMARY | No | Yes | ❓ unknown |
| IRS / Tax Authority | tax-compliance | **MISSING** | PRIMARY | No | Yes | ❓ unknown |

> **QuickBooks DEGRADED**: QB Desktop runs on laptop1. Sync when laptop1 online. Not fixable from mi-core-primary.

---

## Restaurant / Operations Sources

| Source | Owner | Credential | Truth Level | Write | Approval | Health |
|--------|-------|-----------|------------|-------|----------|--------|
| Toast POS | restaurant-intelligence | CONFIGURED | PRIMARY | No | Yes | ✅ healthy |
| DoorDash Merchant | restaurant-intelligence | CONFIGURED | PRIMARY | Yes | **Yes** | ✅ healthy |
| Food Safety Records | restaurant-intelligence | CONFIGURED | PRIMARY | No | No | ✅ healthy |

> **DoorDash write**: CEO approval required before any menu price or promo change.

---

## Marketing / Reviews

| Source | Owner | Credential | Truth Level | Write | Approval | Health |
|--------|-------|-----------|------------|-------|----------|--------|
| Google Reviews | marketing | CONFIGURED | PRIMARY | Yes | **Yes** | ✅ healthy |
| Yelp Reviews | marketing | CONFIGURED | PRIMARY | Yes | **Yes** | ✅ healthy |

> No review reply is posted without CEO approval. Auto-post is `AUTO_POST_SUPPORTED_PLATFORMS = {"google"}` — gated by review-automation-system policy.

---

## Google Workspace

| Source | Owner | Credential | Truth Level | Write | Approval | Health |
|--------|-------|-----------|------------|-------|----------|--------|
| Gmail | executive-assistant | CONFIGURED | PRIMARY | Yes | **Yes** | ✅ healthy |
| Google Drive | executive-assistant | CONFIGURED | SECONDARY | Yes | **Yes** | ✅ healthy |
| Google Calendar | executive-assistant | CONFIGURED | PRIMARY | Yes | **Yes** | ✅ healthy |
| Google Sheets | restaurant-intelligence | CONFIGURED | SECONDARY | Yes | No | ✅ healthy |

---

## Communication

| Source | Owner | Credential | Truth Level | Write | Approval | Health |
|--------|-------|-----------|------------|-------|----------|--------|
| WhatsApp (CEO + Business) | executive-assistant | CONFIGURED | PRIMARY | Yes | **Yes** | ✅ healthy |

> WhatsApp write = sending messages. CEO approval required for external parties.

---

## Health / Personal

| Source | Owner | Credential | Truth Level | Write | Approval | Health |
|--------|-------|-----------|------------|-------|----------|--------|
| Apple Health / Huawei Health | executive-assistant | CONFIGURED | PRIMARY | No | No | ✅ healthy |

---

## Internal Knowledge

| Source | Owner | Credential | Truth Level | Write | Approval | Health |
|--------|-------|-----------|------------|-------|----------|--------|
| Mi Knowledge Database | library | CONFIGURED | DERIVED | Yes | No | ✅ healthy |
| Operational Memory | executive-assistant | CONFIGURED | DERIVED | Yes | No | ✅ healthy |
| Company OS Evidence DB | qa | CONFIGURED | PRIMARY | Yes | No | ✅ healthy |

---

## Missing Credentials — Action Required

| Source | Action Needed | Owner |
|--------|--------------|-------|
| Payroll System | Integrate payroll provider | finance |
| IRS / Tax Authority | Tax dept activation (Phase 2) | tax-compliance |

---

## Evidence Policy

All writes to PRIMARY sources require:
1. Evidence step recorded in evidence-store before write
2. QA gate PASS
3. CEO approval for write-capable external sources
