# OPENMETADATA_INTEGRATION_PLAN

Generated: 2026-06-13
Status: RESEARCH_ONLY

## Directive Boundary

No production OpenMetadata install. No Mi-Core runtime changes. No Dev3 API changes.

## Integration Options

### Option A: OpenMetadata as External Metadata Service

OpenMetadata runs beside Mi-Core as a separate metadata catalog.

```text
Mi Knowledge Universe
-> exports metadata
-> OpenMetadata
-> lineage/ownership/catalog UI
```

Pros:

- Rich ownership and metadata UI
- REST APIs and schema-first model
- Native lineage concepts
- Better human governance view

Cons:

- Heavy local footprint
- Requires database + search + ingestion stack
- Needs modeling adaptation for projects/repos/work orders
- More maintenance burden

Best for:

- Future multi-dev/multi-system governance
- Human catalog and lineage inspection

### Option B: Extract Concepts Only, Keep Mi SQLite/Qdrant

Mi adopts OpenMetadata concepts such as owners, domains, lineage, classifications, and asset metadata, but stores them in Mi’s existing DB/index stack.

Pros:

- Local-first and lightweight
- No new service dependencies
- Low operational risk
- Keeps Dev3 contract stable

Cons:

- No OpenMetadata UI
- More custom implementation inside Mi
- Less standardized integration with data tools

Best for:

- Current frozen build phase
- Fastest path to improved Ownership Graph and Dependency Graph

### Option C: Hybrid

OpenMetadata stores lineage and ownership as external metadata. Mi Knowledge DB remains the execution package and operational memory source.

```text
OpenMetadata
-> lineage + ownership + catalog

Mi Knowledge DB
-> execution package + work orders + operational memory
```

Pros:

- Uses OpenMetadata where strongest
- Keeps Mi execution contract unchanged
- Gives Dev3 stable `/api/execution-package`
- Allows gradual adoption

Cons:

- Two systems to sync
- Requires entity ID mapping
- Requires reconciliation rules when OpenMetadata and Mi disagree

Best for:

- V2 after CEO approval and prototype validation

## Evaluation Matrix

| Criterion | Option A | Option B | Option C |
|---|---:|---:|---:|
| Complexity | High | Low | Medium |
| Maintenance cost | High | Low | Medium |
| Local-first compatibility | Medium | Strong | Medium |
| Speed for Dev3 | Medium | Strong | Strong |
| Human governance UI | Strong | Weak | Strong |
| Metadata standardization | Strong | Medium | Strong |
| Risk to frozen contract | Medium | Low | Low if read-only |
| Value for Dev3 | Medium | Medium | High later |

## Recommended Integration Path

Phase 0: Research only

- Produce reports.
- Do not install production OpenMetadata.
- Do not change APIs.

Phase 1: Offline concept extraction

- Add OpenMetadata-inspired vocabulary to V2 design only.
- Model domains, owners, services, lineage, classifications in reports.

Phase 2: Optional sandbox

- If approved, run OpenMetadata in a local Docker sandbox with sample Dashboard/Review/Mi-Core entities.
- Do not connect it to Mi-Core runtime.

Phase 3: Read-only export

- Export Mi project metadata to OpenMetadata.
- Validate ownership and lineage answers.

Phase 4: Hybrid read path

- Only after approval, Mi can read OpenMetadata as an internal metadata evidence source.
- Existing Dev3 APIs remain unchanged.

## Synchronization Rules

If hybrid is approved:

| Conflict | Authority |
|---|---|
| Work Order state | Mi |
| Execution package | Mi |
| Approval state | Mi |
| QA execution state | Dev3/Mi |
| Ownership metadata | OpenMetadata, unless Mi has newer emergency override |
| Lineage metadata | OpenMetadata |
| Source evidence | Mi Knowledge DB |

## Plan Verdict

Choose Option B now. Prepare for Option C later. Do not choose Option A yet.
