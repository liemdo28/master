# Phase 5B Acceptance

Acceptance command:

```bash
npm run phase5b:acceptance
```

Required proof:

- confirmed user preference included in MemoryPack
- project convention included for the scoped project
- task lesson extracted from completed task summary
- inferred preference remains `NEEDS_CONFIRMATION`
- unrelated project data excluded
- evidence references present
- MemoryPack size bounded
- restart persistence verified
- deletion removes records from retrieval
- supersession replaces old active records
- no automatic external action

Focused tests:

```bash
npm run test:knowledge
npm run test:memory-retrieval
npm run test:knowledge-security
```

Full gate:

```bash
npm run build
npm run test:ci
npm run phase5b:acceptance
```

Phase 5B is complete only after the focused tests, CI suite, and acceptance scenario pass. Phase 5C must not start as part of this batch.

