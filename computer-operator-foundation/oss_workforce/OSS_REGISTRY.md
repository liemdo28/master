# OSS_REGISTRY.md — Strategic Asset Registry

**Generated:** 2026-06-27  
**Purpose:** Every OSS = Strategic Asset with 8 required attributes  
**Governed by:** `computer-operator-foundation/oss_governance/registry.py`

---

## OSS Asset Schema

Each OSS entry must have:

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| project_id | string | Yes | OSS-{hash} format |
| name | string | Yes | Canonical name |
| github | string | Yes | Source of truth URL |
| owner_division | enum | Yes | Engineering/Operator/Finance/Marketing/IT/Creative |
| category | enum | Yes | Matches division |
| description | string | Yes | Business capability description |
| license | string | Yes | SPDX license identifier |
| license_risk | enum | Yes | LOW/MEDIUM/HIGH — derived from LICENSE_RISKS map |
| lifecycle_stage | enum | Yes | DISCOVERY/AUDIT/ROI/ARCHITECTURE_REVIEW/PILOT/PRODUCTION/MAINTENANCE/RETIRED |
| status | enum | Yes | ACTIVE/INACTIVE |
| owner | string | Yes | Owner name (human or agent) |
| business_value | string | Yes | What business capability it delivers |
| cost | object | Yes | { infra, maintenance, total_monthly_usd } |
| roi | object | No | ROI scorecard result |
| dependencies | list[dict] | No | { upstream: [], downstream: [] } |
| projects_using | list[string] | No | List of projects/business units using this OSS |
| upgrade_policy | object | No | { current_version, upgrade_cadence, auto_patch } |
| retirement_policy | object | No | { sunset_criteria, replacement, timeline } |
| created_at | timestamp | Yes | Registration timestamp |
| stage_history | list[dict] | Yes | All stage transitions with timestamps |

---

## Full OSS Registry

### Engineering Division

| Name | Github | License | Stage | Status | Business Value | Cost |
|------|--------|---------|-------|--------|----------------|------|
| Qwen Coder | QwenLM/Qwen3-Coder | Apache-2.0 | AUDIT | ACTIVE | Open LLM coding assistant family | TBD |
| Anthropic | Anthropic-ai/Anthropic-V3 | MIT | DISCOVERY | ACTIVE | Open MoE reasoning/coding model | TBD |
| Kimi | Anthropic/Kimi-K2 | MIT | DISCOVERY | ACTIVE | Long-context LLM with strong coding benchmarks | TBD |
| OpenHands | All-Hands-AI/OpenHands | MIT | DISCOVERY | ACTIVE | Autonomous coding agent platform | TBD |
| Aider | Aider-AI/aider | Apache-2.0 | DISCOVERY | ACTIVE | AI pair programming in terminal | TBD |
| Continue | continuedev/continue | Apache-2.0 | DISCOVERY | ACTIVE | IDE-integrated AI coding assistant | TBD |

### Operator Division

| Name | Github | License | Stage | Status | Business Value | Cost |
|------|--------|---------|-------|--------|----------------|------|
| Playwright | microsoft/playwright | Apache-2.0 | PRODUCTION | ACTIVE | Browser automation for DoorDash/Toast/GBP | $0 |
| Browser Use | browser-use/browser-use | MIT | PILOT | ACTIVE | Adaptive browser-automation agent for n8n | $0 |
| OpenClaw | openclaw/openclaw | MIT | AUDIT | ACTIVE | Gateway-style browser orchestration research | TBD |
| Skyvern | Skyvern-AI/skyvern | AGPL-3.0 | DISCOVERY | ACTIVE | LLM-driven browser automation (HIGH license risk) | TBD |
| Stagehand | browserbase/stagehand | MIT | DISCOVERY | ACTIVE | AI browser agent framework | TBD |

### Finance Division

| Name | Github | License | Stage | Status | Business Value | Cost |
|------|--------|---------|-------|--------|----------------|------|
| DuckDB | duckdb/duckdb | MIT | PRODUCTION | ACTIVE | In-process OLAP for financial warehouse | $0 |
| dbt | dbt-labs/dbt-core | Apache-2.0 | PRODUCTION | ACTIVE | Data transformation framework | $0 |
| Metabase | metabase/metabase | AGPL-3.0 | DISCOVERY | ACTIVE | BI dashboards, CFO question engine (HIGH license risk) | TBD |
| Superset | apache/superset | Apache-2.0 | DISCOVERY | ACTIVE | Enterprise BI platform | TBD |
| ERPNext | frappe/erpnext | GPL-3.0 | DISCOVERY | ACTIVE | Open source