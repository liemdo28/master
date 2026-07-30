# KNOWLEDGE_FEDERATION_REPORT
**Generated:** 2026-06-09 | **Phase:** Federated OS Phase 2

## Status: ✅ KNOWLEDGE_FEDERATION_READY

## Architecture

**File:** `server/src/knowledge-federation/index.ts`

### Sources Federated (6 total)

| # | Source | Type | Key Function |
|---|---|---|---|
| 1 | Executive Knowledge DB | SQLite FTS5 | `searchKnowledgeDB()` |
| 2 | Executive Memory | JSON files | `searchExecutiveMemory()` |
| 3 | Project Registry | JSON | `searchProjectRegistry()` |
| 4 | Connector Caches | JSON dirs | `searchConnectorCaches()` |
| 5 | Reports | Markdown files | `searchReports()` |
| 6 | Workflow Registry | JSON | `searchWorkflows()` |

### Scoring

- Word-overlap scoring algorithm (0-1 confidence)
- Exact phrase bonus: +0.3
- Per-source confidence multipliers (connector caches: 0.8x, reports: 0.7x)
- Results sorted by confidence, filtered by `min_confidence`

### Exported Functions

```typescript
searchAll(query, opts)              // Federate across all sources
searchByDomain(query, domain)       // Single-source search
searchByJurisdiction(query, juris)  // Location-enriched search
searchByProject(query, project)     // Project-scoped search
retrieveWithCitations(query)        // Results + formatted citations
getFederatedContext(query, maxTokens) // Pipeline-ready string
```

## Pipeline Integration

- `getFederatedContext(message, 1200)` called on EVERY message
- Appended to `liveDataParts[]` if results found
- Source added to `sources[]` array as `'knowledge-federation'`

## Validation Tests

```
CEO: "Tìm Raw project"
Mi: Project: Raw Sushi website (NextJS) — E:/Project/Master/raw-sushi-website
    Sources: project-registry, knowledge-federation
✅ PASS

CEO: "Payroll risk cho Raw ở California?"
Mi: Payroll compliance California — SDI, CalEPA, overtime rules... [Approve]
    Sources: knowledge-federation
✅ PASS
```

---
KNOWLEDGE_FEDERATION_READY
