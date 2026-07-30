# HITL_OSS_EVALUATION.md — HITL Autonomy OSS Evaluation

**Generated:** 2026-06-27
**Purpose:** Evaluate OSS tools for human-in-the-loop autonomy

---

## Evaluated OSS Tools

| Tool | Category | License | Use Case | Evaluation | Decision |
|------|----------|---------|----------|------------|----------|
| Windmill | Internal Tools | AGPL-3.0 | Script execution, approval flows | DISCOVERY | Monitor |
| n8n | Workflow | Apache-2.0 | Workflow automation + approvals | **PRODUCTION** | Already deployed |
| Temporal | Workflow | MIT | Durable execution | DISCOVERY | Monitor vs n8n |
| Activepieces | Workflow | MIT | Workflow automation | DISCOVERY | Not needed |
| Plane | Project Mgmt | AGPL-3.0 | Project tracking | DISCOVERY | Not needed |
| OpenProject | Project Mgmt | GPL-3.0 | Project management | DISCOVERY | Not needed |
| Budibase | Internal Apps | GPL-3.0 | Internal tool builder | DISCOVERY | Not needed |
| Appsmith | Internal Apps | Apache-2.0 | Internal tool builder | DISCOVERY | Not needed |
| ToolJet | Internal Apps | Apache-2.0 | Internal tool builder | DISCOVERY | Not needed |
| Directus | Headless CMS | GPL-3.0 | Content management | DISCOVERY | Not needed |
| Strapi | Headless CMS | MIT | Content management | DISCOVERY | Not needed |
| Keycloak | Auth | Apache-2.0 | Identity management | PRODUCTION | Already deployed |
| Ory | Auth | Apache-2.0 | Identity management | DISCOVERY | Monitor Keycloak |
| Casdoor | Auth | Apache-2.0 | Auth provider | DISCOVERY | Not needed |

---

## Recommended Stack

| Component | OSS | Status |
|-----------|-----|--------|
| Workflow | n8n | PRODUCTION |
| Auth | Keycloak | PRODUCTION |
| Approval | Custom Mi-built | Active |
| Rollback | Custom Mi-built | Active |

---

## Status: ✅ HITL_OSS_EVALUATION_COMPLETE
