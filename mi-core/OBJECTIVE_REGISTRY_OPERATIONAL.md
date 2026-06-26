# OBJECTIVE_REGISTRY_OPERATIONAL.md

**Status:** OPERATIONAL
**Phase:** 0B
**Engine:** `src/executive-coordination/objective-registry.ts`

## Schema

```typescript
interface Objective {
  id: string;                    // OBJ-...
  title: string;
  description: string;
  source: string;                // e.g. 'manual', 'ceo', 'n8n'
  requestedBy: string;
  ownerExecutive: string;        // CEO / delegated owner
  primaryDivision: string;
  supportingDivisions: string[];
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'DRAFT' | 'ACCEPTED' | 'PLANNING' | 'IN_PROGRESS' |
          'BLOCKED' | 'WAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  businessGoal: string;
  expectedImpact: string;
  createdAt: string;
  updatedAt: string;
  targetDate: string | null;
  closedAt: string | null;
  evidenceRequired: boolean;
  approvalRequired: boolean;
  linkedTasks: string[];
  linkedReports: string[];
}
```

## API Proof

```
POST /api/coordination/objectives  → createRegisteredObjective()
GET  /api/coordination/objectives  → getRegisteredObjectives()
GET  /api/coordination/objectives/:id  → getRegisteredObjective()
PATCH /api/coordination/objectives/:id → updateRegisteredObjective()
POST /api/coordination/objectives/:id/close → closeObjective()
```

## Sample Objective

```json
{
  "id": "OBJ-lx8k4m-ab12cd",
  "title": "Increase Raw Sushi Revenue 10%",
  "primaryDivision": "marketing",
  "priority": "P1",
  "status": "ACCEPTED",
  "evidenceRequired": true,
  "approvalRequired": false,
  "linkedTasks": [],
  "createdAt": "2026-06-26T06:13:00.000Z"
}
```

## Persistence Proof

- Storage: `.mi-harness/coordination/objectives/<id>.json`
- Format: pretty-printed JSON, one file per objective
- Migration path: swap persistence layer to SQLite/Postgres when needed (interface unchanged)

## Dashboard Visibility

Objectives appear in `GET /api/coordination/dashboard`:
- `objectives.total`
- `objectives.active`
- `objectives.completed`
- `objectives.blocked`
- `atRiskObjectives[]`

## Certification Test

```bash
curl -X POST http://127.0.0.1:4001/api/coordination/objectives \
  -H "Content-Type: application/json" \
  -d '{"title":"Increase Raw Sushi Revenue 10%"}'
```

**Expected:**
- objective_id generated (OBJ-...)
- owner = "ceo" (default)
- status = "ACCEPTED"
- evidence_required = true
- linkedTasks = [] (populated after task creation via `runCoordinationPipeline`)