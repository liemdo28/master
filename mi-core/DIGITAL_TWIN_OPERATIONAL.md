# DIGITAL_TWIN_OPERATIONAL.md

**Phase:** 25E — Digital Twin  
**Status:** ✅ OPERATIONAL  
**Date:** 2026-06-24  

---

## MI_COMPANY_SCORE — One Number (0-100)

Updated daily. Composed of 6 weighted sub-scores:

| Sub-Score | Weight | Source |
|-----------|--------|--------|
| Health Score | 25% | PM2 process status, SEO agents online, DB accessible |
| Traffic Score | 20% | SEO analytics KPIs (pages audited, keywords tracked, rankings) |
| Revenue Score | 15% | QuickBooks DB freshness |
| Operations Score | 15% | Scheduler, objectives, auto-tasks activity |
| Compliance Score | 10% | .env, .gitignore, evidence trail, data directory |
| Technology Score | 15% | Package.json, ecosystem config, agent engine, SEO agent count, Phase 25 modules |

---

## Score Calculation

```
MI_COMPANY_SCORE = (Health × 0.25)
                 + (Traffic × 0.20)
                 + (Revenue × 0.15)
                 + (Operations × 0.15)
                 + (Compliance × 0.10)
                 + (Technology × 0.15)
```

Each sub-score is clamped to 0-100 range.

---

## API Endpoints (via `/api/digital-twin`)

### `GET /api/digital-twin/score`
Compute fresh score on demand.

### `GET /api/digital-twin/score/latest`
Get most recent persisted snapshot.

### `GET /api/digital-twin/score/history?limit=30`
Get historical snapshots.

### `GET /api/digital-twin/entities`
List all entities in the graph topology.

### `GET /api/digital-twin/simulate/failure/:entity`
Simulate failure of an entity — blast radius, severity, downtime.

### `GET /api/digital-twin/simulate/absence/:role`
Simulate owner absence — tasks at risk, blockers.

### `POST /api/digital-twin/simulate`
Body: `{ type, target }` — failure or absence simulation.

---

## Live Snapshot

```json
{
  "id": "twin-1782298046...",
  "companyScore": 58,
  "healthScore": 70,
  "trafficScore": 30,
  "revenueScore": 40,
  "operationsScore": 65,
  "complianceScore": 75,
  "technologyScore": 80
}
```

---

## Storage

Snapshots persisted to: `.mi-harness/phase25/digital-twin/twin-{id}.json` + `latest.json`

---

## Sub-Score Source Signals

### Health (25%)
- PM2 processes online vs total
- SEO agents online (from `data/seo/seo-state.json`)
- Health DB existence

### Traffic (20%)
- Analytics agent weekly KPIs (pages audited, keywords tracked, technical issues)
- Ranked keyword count
- Schema items count

### Revenue (15%)
- QuickBooks DB age (fresh < 24h, stale > 72h)

### Operations (15%)
- Scheduler directory existence
- Objectives directory + count
- Auto-tasks directory + count

### Compliance (10%)
- `.env` exists
- `.gitignore` exists
- `data/` directory
- Evidence trail exists

### Technology (15%)
- `package.json` + `ecosystem.config.cjs`
- Agent engine bridge
- SEO agent count
- Phase 25 modules present

**VERDICT: DIGITAL TWIN OPERATIONAL**
