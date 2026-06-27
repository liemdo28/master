# DEPENDENCY_GRAPH_PROOF.md — Dependency Graph

**Generated:** 2026-06-27
Purpose: Map dependencies between business systems

---

## Dependency Graph

```
DoorDash Connector
  └── Playwright (scraping)
        └── n8n (orchestration)
              └── DuckDB (storage)
                    └── Financial Reports

QuickBooks Connector
  └── QB Bridge
        └── DuckDB (storage)
              └── CFO Dashboard

Google Business Profile
  └── GBP MCP
        └── Marketing Dashboard
```

---

## Status: ✅ DEPENDENCY_GRAPH_DEFINED
