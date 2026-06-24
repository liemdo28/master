# Mi-Core Mapping Inventory

**Generated:** 2026-06-24
**Status:** LIVE_INVENTORY
**Last Updated:** 2026-06-24

---

## Purpose

Central index of all mapping files in the mi-core workspace. This file is the single source of truth for locating and understanding every mapping in the project.

---

## Mapping Files Index

### 1. COLUMN_MAPPING_VALIDATION.md
| Field | Value |
|-------|-------|
| Path | `COLUMN_MAPPING_VALIDATION.md` |
| Type | Column-to-field mapping for CSV data ingestion |
| Date | 2026-06-09 |
| Status | VALIDATED |
| Coverage | sample_sales_raw.csv, multi-language aliases, date/number normalization |

### 2. OPENMETADATA_MI_MAPPING.md
| Field | Value |
|-------|-------|
| Path | `OPENMETADATA_MI_MAPPING.md` |
| Type | OpenMetadata → Mi Knowledge Universe entity mapping |
| Date | 2026-06-13 |
| Status | RESEARCH_ONLY |
| Coverage | Domains, Data Products, Services, Tables, Users, Teams, Tags, Lineage, Glossary |

### 3. WEBSITE_SOURCE_MAP.md
| Field | Value |
|-------|-------|
| Path | `WEBSITE_SOURCE_MAP.md` |
| Type | Website → local source → GitHub → production domain mapping |
| Date | 2026-06-14 |
| Status | CURRENT |
| Coverage | bakudanramen.com, rawsushibar.com |

### 4. WHATSAPP_SOURCE_OF_TRUTH_MAP.md
| Field | Value |
|-------|-------|
| Path | `WHATSAPP_SOURCE_OF_TRUTH_MAP.md` |
| Type | WhatsApp domain → canonical snapshot section → upstream source mapping |
| Date | 2026-06-?? |
| Status | ACTIVE |
| Coverage | Tasks, Approvals, Work Orders, Projects, Dashboard, Websites, Gmail, Calendar, Drive, Health, QuickBooks, Asana, Burn-In, Connectors, Graph, Memory |

### 5. FINANCE_SOURCE_MAP.md
| Field | Value |
|-------|-------|
| Path | `reports/FINANCE_SOURCE_MAP.md` |
| Type | Finance query → data source priority mapping |
| Date | 2026-06-15 |
| Status | ACTIVE |
| Coverage | QuickBooks Runtime, Accounting Engine, Finance Cache — source priority chain |

### 6. OPENMETADATA_MI_MAPPING.md (reports/)
| Field | Value |
|-------|-------|
| Path | `reports/OPENMETADATA_MI_MAPPING.md` |
| Type | Deep research — OpenMetadata entity to Mi entity mapping |
| Date | 2026-06-13 |
| Status | RESEARCH_COMPLETE |
| Coverage | Projects, Services, Owners, Teams, Dependencies, Work Orders, Knowledge nodes, Connectors, Evidence files, Config/env |

### 7. STORE_MAPPING.md
| Field | Value |
|-------|-------|
| Path | `services/whatsapp-ai-gateway/docs/STORE_MAPPING.md` |
| Type | WhatsApp group → store mapping |
| Date | 2026-06-04 |
| Status | MINIMAL |

### 8. STORE_MAPPING_AUDIT.md
| Field | Value |
|-------|-------|
| Path | `services/whatsapp-ai-gateway/docs/STORE_MAPPING_AUDIT.md` |
| Type | Audit of store mapping in SQLite |
| Date | 2026-06-04 |
| Status | AUDIT_COMPLETE |
| Notes | Stone Oak: PARTIAL, Bandera: FAIL, Rim: FAIL — blocked for pilot |

### 9. PHASE_1_1_STORE_MAPPING_LOCK_REPORT.md
| Field | Value |
|-------|-------|
| Path | `services/whatsapp-ai-gateway/docs/PHASE_1_1_STORE_MAPPING_LOCK_REPORT.md` |
| Type | Store group locking mechanism documentation |
| Date | 2026-06-04 |
| Status | IMPLEMENTED |
| Mechanism | `STORE_GROUPS_LOCKED` env var, `isGroupLocked()` function |

### 10. REAL_STORE_MAPPING_PREP_REPORT.md
| Field | Value |
|-------|-------|
| Path | `services/whatsapp-ai-gateway/docs/REAL_STORE_MAPPING_PREP_REPORT.md` |
| Type | Step-by-step guide for real store group mapping |
| Date | 2026-06-04 |
| Status | READY_TO_EXECUTE |
| Stores | Stone Oak → Stone Oak LD Agent, Bandera → Bandera LD Agent, Rim → Rim LD Agent |

### 11. WHATSAPP_GROUP_MAPPING_LIVE_AUDIT.md
| Field | Value |
|-------|-------|
| Path | `services/whatsapp-ai-gateway/docs/WHATSAPP_GROUP_MAPPING_LIVE_AUDIT.md` |
| Type | Live WhatsApp group mapping verification |
| Date | 2026-06-04 |
| Status | BLOCKED |
| Notes | Pending manual verification of `/ldagent` in LD Agent-Log group |

---

## Mapping by Category

### Data Ingestion
- `COLUMN_MAPPING_VALIDATION.md` — CSV column → DB field mapping

### Knowledge Catalog
- `OPENMETADATA_MI_MAPPING.md` (root) — OpenMetadata concept → Mi entity
- `reports/OPENMETADATA_MI_MAPPING.md` — Deep research mapping

### Infrastructure
- `WEBSITE_SOURCE_MAP.md` — Website → source → GitHub → production

### Runtime Intelligence
- `WHATSAPP_SOURCE_OF_TRUTH_MAP.md` — WhatsApp domain → data source truth

### Finance
- `FINANCE_SOURCE_MAP.md` — Finance query → source priority

### WhatsApp Operations
- `services/whatsapp-ai-gateway/docs/STORE_MAPPING.md`
- `services/whatsapp-ai-gateway/docs/STORE_MAPPING_AUDIT.md`
- `services/whatsapp-ai-gateway/docs/PHASE_1_1_STORE_MAPPING_LOCK_REPORT.md`
- `services/whatsapp-ai-gateway/docs/REAL_STORE_MAPPING_PREP_REPORT.md`
- `services/whatsapp-ai-gateway/docs/WHATSAPP_GROUP_MAPPING_LIVE_AUDIT.md`

---

## Audit Triggers

| Trigger | Action |
|---------|--------|
| New CSV format introduced | Re-run COLUMN_MAPPING_VALIDATION |
| New store added | Update STORE_MAPPING + REAL_STORE_MAPPING_PREP |
| OpenMetadata version upgrade | Re-review OPENMETADATA_MI_MAPPING |
| Website deploy change | Update WEBSITE_SOURCE_MAP |
| New WhatsApp domain | Update WHATSAPP_SOURCE_OF_TRUTH_MAP |
| Finance source change | Update FINANCE_SOURCE_MAP |

---

MAPPING_INVENTORY_COMPLETE
