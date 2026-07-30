# REFERENCE BRAIN PATH RESOLVER REPORT

**Date:** 2026-06-10
**File:** `server/src/knowledge/reference-brain-path.ts`

---

## Purpose

Single canonical path resolver for the US Compliance Reference Brain.
ALL modules must use this resolver — no hardcoded paths.

---

## Exports

| Function | Returns | Description |
|----------|---------|-------------|
| `getMiCoreRoot()` | string | mi-core project root (E:/Project/Master/mi-core) |
| `getWorkspaceRoot()` | string | Parent workspace (E:/Project/Master) |
| `getReferenceBrainRoot()` | string \| null | Reference-brain root directory |
| `getUSComplianceDBPath()` | string \| null | US Compliance DB path |
| `getUSComplianceManifestPath()` | string \| null | MI_INTEGRATION_MANIFEST.json full path |
| `getUSComplianceCatalogPath()` | string \| null | source_catalog.json full path |
| `checkUSComplianceDBHealth()` | USComplianceDBHealth | Full health report |

Backward compat aliases:
- `resolveCompliancePath` → `getUSComplianceDBPath`
- `getComplianceDBStatus` → wrapped `checkUSComplianceDBHealth` with READY/PARTIAL/MISSING/ERROR status

---

## Path Resolution Order

1. `process.env.MI_REFERENCE_BRAIN_PATH` (explicit override)
2. `<mi-core-root>/.local-agent-global/reference-brain/us-business-compliance/`
3. `<workspace-root>/.local-agent-global/reference-brain/us-business-compliance/`
4. `<GLOBAL_DIR>/reference-brain/us-business-compliance/`

First existing path wins. If none exist, returns null and surfaces `checked_paths`.

---

## Consumers Updated

| Module | Previous Import | New Import |
|--------|----------------|------------|
| routes/knowledge.ts | compliance-path | reference-brain-path |
| routes/brain.ts | compliance-path | reference-brain-path |
| knowledge-federation/index.ts | compliance-path | reference-brain-path |
| pipeline/response-pipeline.ts | compliance-path | reference-brain-path |

`compliance-path.ts` retained as re-export shim for any future imports.

---

## Validation

- TypeScript build: **PASS** (zero errors)
- Runtime resolution test: **PASS**
  - resolved_path = `e:/Project/Master/mi-core/.local-agent-global/reference-brain/us-business-compliance`
  - All four candidate paths enumerated correctly

---

## Verdict

**REFERENCE_BRAIN_PATH_RESOLVER: READY**
