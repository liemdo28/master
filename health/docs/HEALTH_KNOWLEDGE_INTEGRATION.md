# HEALTH KNOWLEDGE INTEGRATION
**MI Health V1 — Phase 3 Deliverable**  
**Date:** 2026-06-13

---

## Objective

Health data must be searchable exactly like project data.  
A query about steps, sleep, or recovery should return health data through the same `FederationSearch` pipeline that returns business data.

---

## Entity Types

| Kind | Subtype | Title Pattern | Update |
|------|---------|---------------|--------|
| `health-daily` | `ceo-health` | `CEO Health — YYYY-MM-DD` | Daily after sync |
| `health-weekly` | `ceo-health` | `CEO Health Week — YYYY-MM-DD` | Weekly (Monday) |
| `health-monthly` | `ceo-health` | `CEO Health Month — YYYY-MM` | Monthly (1st) |
| `health-trend` | `sleep-trend` | `CEO Sleep Trend — YYYY-MM-DD` | Weekly |
| `health-trend` | `activity-trend` | `CEO Activity Trend — YYYY-MM-DD` | Weekly |
| `health-trend` | `recovery-trend` | `CEO Recovery Trend — YYYY-MM-DD` | Weekly |

---

## Storage Architecture

Health entities are stored in two places:

### 1. Visibility Cache (primary for fast queries)
```
.local-agent-global/visibility/health/
├── data.json       — full cache with today + weekly + monthly + trends
└── last_sync.json  — last update timestamp
```

FederationSearch reads this directly. No SQLite query needed for common queries.

### 2. UnifiedKnowledgeDatabase (for full-text search)
Entities with `kind = 'health-*'` are inserted into `knowledge_items`.  
FTS5 index makes them searchable alongside project/report/business entities.

---

## FederationSearch Integration

Add health domain to `FederationSearch.searchAll()`:

```javascript
// In FederationSearch.mjs — add health domain
import { isHealthQuery, handleHealthQuery } from '../../health/HealthQueryHandler.mjs';
import { buildHealthBriefingBlock } from '../../health/HealthBriefingIntegration.mjs';

// Add to searchAll():
if (isHealthQuery(query)) {
  const healthResponse = await handleHealthQuery(query);
  allResults.push({
    source: 'health-db',
    title: 'CEO Health',
    content: healthResponse,
    confidence: 0.95,
    domain: 'health',
    type: 'health-data',
    timestamp: new Date().toISOString(),
  });
}
```

---

## Sample Entities

### Daily Health Entity
```
Kind: health-daily
Title: CEO Health — 2026-06-13
Content:
  CEO Health Summary — 2026-06-13
  Steps: 8,432 (Goal: 10,000 — 84%)
  Sleep: 7h12m | Deep: 1h45m | REM: 1h34m
  Resting HR: 58 bpm
  HRV: 42.3 ms
  SpO2: 97.8%
  Active calories: 486 kcal
  Health Score: 81/100 (B+)

Tags: health, daily, ceo, steps, sleep, heart-rate, 2026-06
```

### Weekly Health Entity
```
Kind: health-weekly
Title: CEO Health Week — 2026-06-09
Content:
  CEO Weekly Health — 2026-06-09 to 2026-06-15
  Days with data: 5/7
  Avg steps: 7,821/day | Total: 39,105
  Avg sleep: 7h05m/night | Deep: 1h40m
  Avg resting HR: 59.2 bpm
  Avg HRV: 41.5 ms
  Workouts: 2
  Health Score: 78/100 (B)
  Sleep: B | Recovery: B+ | Activity: B- | Heart: B+

Tags: health, weekly, ceo, 2026-06
```

### Sleep Trend Entity
```
Kind: health-trend / sleep-trend
Title: CEO Sleep Trend — 2026-06-13
Content:
  7-day sleep trend ending 2026-06-13:
  Avg sleep: 7h05m
  Avg deep: 1h40m
  Grade: B
  Trung bình 7h5m/đêm | Deep 22% | REM 20%

Tags: health, sleep, trend, ceo
```

---

## Knowledge API

After integration, health data responds to:

```javascript
// Via FederationSearch
const search = new FederationSearch();
search.searchAll('bước chân hôm nay');  // → health-daily entity
search.searchAll('sức khỏe tuần này');  // → health-weekly entity
search.searchAll('xu hướng giấc ngủ'); // → sleep-trend entity
```

---

## Visibility Cache Schema

```json
{
  "last_updated": "2026-06-13T06:05:00Z",
  "today": {
    "date": "2026-06-13",
    "steps": 8432,
    "resting_hr": 58,
    "hrv_ms": 42.3,
    "spo2_avg": 97.8,
    "active_cals": 486
  },
  "weekly": {
    "week_start": "2026-06-09",
    "avg_steps": 7821,
    "avg_sleep_mins": 425,
    "avg_resting_hr": "59.2",
    "workouts": 2
  },
  "health_score": {
    "score": 81,
    "grade": "B+",
    "components": { ... }
  },
  "trends": [
    { "kind": "sleep-trend", "content": "..." },
    { "kind": "activity-trend", "content": "..." },
    { "kind": "recovery-trend", "content": "..." }
  ]
}
```
