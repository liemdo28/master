# US COMPLIANCE UI PANEL REPORT

**Date:** 2026-06-10
**Directive:** US Compliance DB Integration Part 2 — Phase 2 (UI Panel)
**File:** `ui/brain.html`

---

## Scope

Add a Reference Brain / US Compliance panel to the Mi Core Brain Status UI that
shows real, live DB stats sourced entirely from the API — no hardcoded numbers.

---

## Panel Location

`ui/brain.html` → full-width card titled **🇺🇸 US Compliance DB** with a status
badge (READY / PARTIAL / MISSING / ERROR color-coded).

---

## Data Flow

```
load()
  └─ fetch GET /api/knowledge/us-compliance/status
       └─ renderCompliance(c)  ← all values come from API response object `c`
```

The panel auto-refreshes every 30s via `setInterval(load, 30000)`. There are
**no hardcoded stats** — every displayed value is read off the API payload.

---

## Panel Contents

| UI Field | API Field |
|----------|-----------|
| Status badge | `c.status` |
| Resolved Path | `c.resolved_path` |
| Raw Size | `c.raw_size_mb` |
| Documents | `c.document_count` |
| Chunks | `c.chunk_count` |
| Sources | `c.source_count` |
| Searchable | `c.searchable` |
| Last Indexed | `c.last_indexed` |
| Catalog | `c.catalog_exists` |
| Manifest | `c.manifest_exists` |
| Jurisdictions (chips) | `c.jurisdictions` |
| Domains (chips) | `c.domains` |
| Missing-data warning | shown when `c.exists === false`, lists `c.checked_paths` |

---

## Sample Queries

Rendered as clickable buttons that populate the search box and execute a
compliance search:

- Texas restaurant sales tax
- California sick leave law
- San Antonio food permit
- Stockton restaurant compliance
- Payroll checklist Raw California
- Accounting checklist Bakudan Texas

Search hits `GET /api/knowledge/search?q=...&category=compliance`.

---

## Missing-Data Behavior

When `exists=false`, the panel:
- shows a red warning box listing all `checked_paths`,
- displays `MISSING` status,
- hides the search row.

This guarantees the UI never shows "missing" while data exists, and never
shows fake stats while data is missing.

---

## Bug Fixed During Integration

The KB card previously read `l.knowledge_db`, but `/api/brain/status` exposes
that layer as `l.knowledge_federation`. The mismatch threw inside `renderBrain`
and prevented `renderCompliance` from ever running. Fixed by reading
`l.knowledge_federation || l.knowledge_db` with a safe fallback, so the
compliance panel reliably renders.

---

## Validation

- API feeding the panel returns real data: 743 docs, 515,935 chunks,
  736 sources, 5 jurisdictions, 7 domains, 559.13 MB — confirmed via in-process
  endpoint harness (13/13 checks pass).
- Panel binds every field to the API response; zero hardcoded counts.

---

## Verdict

**US_COMPLIANCE_UI_PANEL: READY** — panel renders real stats from the API,
surfaces resolved path / size / docs / chunks / sources / jurisdictions /
domains / last-indexed / searchability, provides the required sample queries,
and warns correctly when data is absent.
