# FINANCIAL_OPEN_SOURCE_EVALUATION

Status: **FOUNDATION_DRAFT_COMPLETE**
Date: 2026-06-26

## Purpose

Evaluate open-source projects that can help Mi build Financial Intelligence. No installations are performed in this phase. This is evaluation only.

## Evaluation Criteria

For each project:
- What is its purpose
- How well does it fit Mi
- How well does it fit restaurant business
- Setup complexity
- Maintenance cost
- Risk
- Recommended or rejected

---

## 1. ERPNext

| Field | Value |
|---|---|
| purpose | Full ERP suite: accounting, inventory, HR, manufacturing, CRM |
| fit for Mi | Low — Mi already has QuickBooks Desktop as accounting source of truth; replacing it with ERPNext is a large migration with high risk |
| fit for restaurant business | Low-Medium — ERPNext is designed for manufacturing/trading businesses; restaurant-specific modules are weak |
| setup complexity | High — full ERP requires database, modules, chart of accounts setup, training |
| maintenance cost | High — requires ongoing admin, customization, and upgrade management |
| risk | High — could distract from building Mi's financial intelligence layer; may conflict with existing QB workflow |
| recommended | **REJECTED** for immediate use. Only consider if Mi decides to replace QB entirely in the future |

## 2. Metabase

| Field | Value |
|---|---|
| purpose | Business intelligence dashboard and analytics; connects to any SQL database |
| fit for Mi | High — lightweight BI layer; perfect for CFO dashboard once warehouse exists |
| fit for restaurant business | High — many restaurant operators use Metabase for sales, labor, and cost reporting |
| setup complexity | Low-Medium — Docker-based, connects to any SQL DB, minimal config for basic dashboards |
| maintenance cost | Low — minimal admin once deployed |
| risk | Low — read-only analytics layer; no data modification risk |
| recommended | **RECOMMENDED** for CFO dashboard front-end. Pair with DuckDB or PostgreSQL warehouse |

## 3. Apache Superset

| Field | Value |
|---|---|
| purpose | Data exploration and visualization platform; more feature-rich than Metabase |
| fit for Mi | Medium-High — powerful BI; good for advanced analytics and complex dashboard layouts |
| fit for restaurant business | High — handles complex SQL queries well for financial reporting |
| setup complexity | Medium — requires database backend, Redis cache, worker processes |
| maintenance cost | Medium — more complex than Metabase; requires more infrastructure knowledge |
| risk | Low-Medium — read-only analytics; higher operational complexity |
| recommended | **ALTERNATIVE to Metabase** — choose if Mi needs more advanced charting/SQL capabilities. Otherwise Metabase is simpler |

## 4. dbt (data build tool)

| Field | Value |
|---|---|
| purpose | SQL-based data transformation layer; manages warehouse models, tests, and documentation |
| fit for Mi | High — perfect for defining and testing financial KPI calculations in a structured way |
| fit for restaurant business | High — dbt models can define revenue, profit, labor%, food cost calculations as tested SQL |
| setup complexity | Medium — requires CLI setup, warehouse connection, model definition |
| maintenance cost | Low-Medium — dbt models are version-controlled SQL; easy to maintain |
| risk | Low — transforms are read-only; no production data modification risk |
| recommended | **RECOMMENDED** for defining KPI transformations. Use with DuckDB or PostgreSQL warehouse |

## 5. DataFusion

| Field | Value |
|---|---|
| purpose | Rust-based query engine for in-memory and local file analytics |
| fit for Mi | Low-Medium — powerful for embedded analytics but less mature ecosystem than DuckDB |
| fit for restaurant business | Low — no restaurant-specific community or templates |
| setup complexity | Medium — requires Rust or Python integration knowledge |
| maintenance cost | Medium — smaller community, less documentation than DuckDB |
| risk | Low — read-only query engine |
| recommended | **NOT RECOMMENDED** for now. DuckDB is more practical for Mi's use case |

## 6. DuckDB

| Field | Value |
|---|---|
| purpose | Embedded analytics database; fast OLAP queries on local/Parquet/CSV files |
| fit for Mi | High — lightweight warehouse engine; can run locally for testing; scales to production |
| fit for restaurant business | High — can aggregate Toast/DoorDash CSV exports, QB data, and payroll data quickly |
| setup complexity | Very Low — single binary, embedded, no server needed for dev |
| maintenance cost | Very Low — embedded engine, no infrastructure to manage |
| risk | Very Low — read-only analytics; no production data risk |
| recommended | **RECOMMENDED** as the primary warehouse engine for financial intelligence development. Use DuckDB + dbt + Metabase as the stack |

## 7. OrangeHRM

| Field | Value |
|---|---|
| purpose | Open-source HR management: employee records, leave, attendance, recruitment |
| fit for Mi | Low-Medium — only useful if Mi's HR scope expands beyond current payroll provider |
| fit for restaurant business | Medium — restaurant HR is complex (high turnover, scheduling); OrangeHRM handles basics |
| setup complexity | Medium — web application with database; requires employee data import |
| maintenance cost | Medium — requires ongoing admin for employee records |
| risk | Low — HR data system; no direct financial data risk |
| recommended | **DEFERRED** — only consider if Mi needs to build custom HR/employee management beyond the current payroll provider. Not needed for Financial Intelligence core |

## 8. Actual Budget

| Field | Value |
|---|---|
| purpose | Personal/household budgeting tool with sync capabilities |
| fit for Mi | Low — designed for personal finance, not restaurant business accounting |
| fit for restaurant business | Low — does not handle multi-store, multi-user, or restaurant-specific workflows |
| setup complexity | Low — simple web/desktop app |
| maintenance cost | Low — simple app |
| risk | Low — isolated tool |
| recommended | **REJECTED** — wrong scale and wrong use case. Mi needs business-grade financial intelligence, not personal budgeting |

## 9. Firefly III

| Field | Value |
|---|---|
| purpose | Self-hosted personal finance manager: expense tracking, budgets, reporting |
| fit for Mi | Low — similar to Actual Budget; designed for personal/household use |
| fit for restaurant business | Low — cannot handle multi-store accounting, QB integration, or restaurant KPIs |
| setup complexity | Low-Medium — PHP/Laravel app with database |
| maintenance cost | Medium — requires web server and database maintenance |
| risk | Low — isolated tool |
| recommended | **REJECTED** — wrong scope. Not designed for business-grade financial intelligence |

## 10. Plane / OpenProject for Finance Tasks

| Field | Value |
|---|---|
| purpose | Project management / task tracking tools (Plane is a Jira alternative; OpenProject is full PM suite) |
| fit for Mi | Medium — could manage financial tasks/workflows, but not designed for financial calculations |
| fit for restaurant business | Medium — general task management; useful for tracking financial review tasks |
| setup complexity | Low-Medium — Docker-based web apps |
| maintenance cost | Medium — requires project management discipline |
| risk | Low — task management tool; no financial data risk |
| recommended | **DEFERRED** — Mi already has executive coordination via Phase 0. Consider only if Mi needs structured project management for finance tasks beyond the coordination layer |

---

## Recommended Stack

Based on this evaluation, Mi should use:

```text
DuckDB           — embedded analytics warehouse (data storage + fast queries)
dbt              — SQL transformation layer (KPI definitions, tests, docs)
Metabase         — dashboard front-end (CFO widgets, store ranking, alerts)
```

This stack is:
- Lightweight
- Low maintenance
- Restaurant-suitable
- Cost-effective
- Incrementally adoptable

### Stack Diagram

```text
Toast CSV / DoorDash CSV / QB Export / Payroll CSV
        ↓
    DuckDB (warehouse)
        ↓
    dbt (transforms + KPI models)
        ↓
    Metabase (CFO dashboard)
        ↓
    Mi Executive Coordination
```

## Rejected Projects

| Project | Reason |
|---|---|
| ERPNext | Too heavy; conflicts with existing QB |
| DataFusion | DuckDB is simpler and better documented |
| Actual Budget | Wrong scale (personal finance) |
| Firefly III | Wrong scope (personal finance) |
| Plane / OpenProject | Mi already has Phase 0 coordination |

## Deferred Projects

| Project | When to Reconsider |
|---|---|
| Apache Superset | If Mi outgrows Metabase capabilities |
| OrangeHRM | If HR scope expands beyond payroll provider |

## Conclusion

Mi should adopt the DuckDB + dbt + Metabase stack for Financial Intelligence. This provides warehouse, transformation, and visualization in a lightweight, maintainable, and restaurant-appropriate package.
