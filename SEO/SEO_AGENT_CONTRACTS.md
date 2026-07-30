# SEO Agent Contracts

## Data Flow

```
Local Maps Agent
  -> Website SEO Agent (location.data.updated)
  -> Analytics Agent (reviews.snapshot)

Website SEO Agent
  -> Schema Agent (pages.list)
  -> Technical Agent (pages.list)
  -> Content Agent (keyword.map)

Technical Agent
  -> Website Agent (technical.issues)
  -> Schema Agent (schema.findings)
  -> Analytics Agent (kpi.technical)

Schema Agent
  -> Website Agent (schema.implementation_notes)
  -> Technical Agent (schema.validation)

Content Agent
  -> Website Agent (content.published)
  -> Analytics Agent (content.performance_request)

Citation Agent
  -> Local Maps Agent (citation.canonical_request)
  -> Analytics Agent (citation.status)

Analytics Agent
  -> Mi-Core (dashboard.payload)
```

## Contract Format
Each contract in `shared/contracts/contracts.js` specifies:
- `event` — event type name
- `source` — publishing agent
- `target` — consuming agent
- `fields` — expected payload fields

All events are persisted to `shared/events/bus.log` and indexed in the shared DB `agent_tasks` table.
