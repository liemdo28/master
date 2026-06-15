# KNOWLEDGE_HANDOVER_TO_DEV3

Generated: 2026-06-12T18:55:00+07:00
Owner: Dev2
Recipient: Dev3
Purpose: Enable Executive Assistant Layer to consume Knowledge Universe without adding new Knowledge features.

## Current Status

Knowledge status: KNOWLEDGE_CERTIFIED

Certification verdict: KNOWLEDGE_CERTIFIED

Dev3 may consume Knowledge Universe for Executive Assistant, Personality Engine, Memory Engine, and Executive Intelligence.

## Knowledge APIs

Base URL on PC host:

`http://127.0.0.1:4001`

| Purpose | Method | Endpoint | Notes |
|---|---|---|---|
| Service health | GET | `/api/jarvis/health` | Returns service status and timestamp |
| Knowledge stats | GET | `/api/jarvis/knowledge/stats` | Returns total docs, type/category breakdown, source roots, `last_indexed` |
| Knowledge search | GET | `/api/jarvis/knowledge/search?q=<query>&limit=<n>` | Primary source-backed search path |
| Knowledge refresh | POST | `/api/jarvis/knowledge/index` | Full refresh; proof run took about 59 seconds |

Example:

```text
GET /api/jarvis/knowledge/search?q=DoorDash%20Campaigns&limit=5
```

## Entity APIs

Entity data is provided by Knowledge Graph routes.

| Purpose | Method | Endpoint | Notes |
|---|---|---|---|
| Graph stats | GET | `/api/jarvis/graph/stats` | Counts graph entities/relationships |
| Entity list | GET | `/api/jarvis/graph/entities?type=<type>` | Use `project`, `store`, and other graph types |
| Entity lookup | GET | `/api/jarvis/graph/explore/<name>` | Best current lookup path for stores/projects/entities |

Example:

```text
GET /api/jarvis/graph/explore/Stone%20Oak
```

## Search APIs

Use Knowledge Search for source discovery and Graph Explore for relationship lookup.

Recommended Dev3 flow:

1. Call `/api/jarvis/graph/explore/<entity>` when the user asks "what is", "where is", "which machine", or "related to".
2. Call `/api/jarvis/knowledge/search?q=<query>&limit=5` to attach source evidence.
3. Compose a natural Vietnamese answer using `anh`, not `CEO`.
4. Include source-aware confidence internally; only expose source names when anh asks for proof.

## Project APIs

| Purpose | Method | Endpoint | Notes |
|---|---|---|---|
| List projects | GET | `/api/projects` | Scans project registry |
| Force project scan | GET | `/api/projects/scan` | Rebuilds project summary |
| Project connector health | GET | `/api/projects/health` | Connector health board |
| Project registry | GET | `/api/projects/registry` | Reads `project-connectors.json` |
| Project detail | GET | `/api/projects/:id` | Single project info |
| Project status | GET | `/api/projects/:id/status` | Routes status command |
| Project command | POST | `/api/projects/command` | Routes a CEO/assistant command |

Required answerable projects:

| Project | Current Knowledge |
|---|---|
| Mi-Core | Active TypeScript/Node.js system on PC host, port 4001 |
| Dashboard | Active at `dashboard.bakudanramen.com`, depends on Mi-Core |
| Review Automation | Evidence under Bakudan Agent-Coding; associated with Laptop1 |
| DoorDash Campaigns | Active DoorDash project under `E:\Project\Master\Agent\doordash-compaigns`, deployed on Laptop1 |
| WhatsApp Gateway | Evidence under `E:\Project\Master\whatsapp-ai-gateway`; dependency of Mi-Core |
| Integration System | Active project deployed on Laptop1 |
| Payroll | Evidence under `G:\My Drive\Hoang Le\Restaurant\JHT\JHT LLC` |

## Store APIs

Use graph and search together.

| Purpose | Method | Endpoint | Notes |
|---|---|---|---|
| Store list | GET | `/api/jarvis/graph/entities?type=store` | Store entity list |
| Store lookup | GET | `/api/jarvis/graph/explore/<store>` | Relationship and attributes |
| Store evidence | GET | `/api/jarvis/knowledge/search?q=<store>&limit=5` | Source documents and files |

Required stores:

| Store | Current Knowledge |
|---|---|
| Stone Oak | Bakudan Ramen store in San Antonio, TX; related to DoorDash Campaigns |
| Bandera | Bakudan Ramen store in San Antonio, TX; related to DoorDash Campaigns; Toast sales reports indexed |
| Rim | Bakudan Ramen store in San Antonio, TX; website and Toast sales report evidence indexed |

## Known Limitations

- Runtime final audit passed after the internal monitor fix. All public API routes still share a global 120 requests/minute/IP limiter, so Dev3 should use rate-aware request handling and backoff for non-internal traffic.
- Search is source-bearing and broad, but not every top result is semantically perfect. Dev3 should combine graph lookup with search evidence for executive answers.
- Some PDFs/images are indexed by metadata/path and summary, not full OCR text.
- Duplicate files exist: 412 groups / 1,814 duplicate files. They are documented and not currently blocking coverage.
- Existing lookup is graph/search-based. There is no separate certified `/api/jarvis/knowledge/lookup/:id` endpoint in this handover.
- Full refresh is not instant; the proof refresh took about 59 seconds.

## Maintenance Instructions

Dev2 maintenance cadence:

- Run `node scripts/knowledge-master-validation.js` after major changes to `E:\Project\Master`, `D:\`, `F:\`, or `G:\My Drive`.
- Check `reports/KNOWLEDGE_COVERAGE_REPORT.md` for coverage >= 90%.
- Check `reports/KNOWLEDGE_QUALITY_AUDIT.md` for quality >= 95%.
- Check `reports/KNOWLEDGE_SEARCH_VALIDATION.md` for 50/50 search pass.
- Monitor `/api/jarvis/knowledge/stats` for document count, source roots, and `last_indexed`.
- Revalidate API health after service restarts and before major Dev3 production releases.

## Dev3 Consumption Contract

Dev3 should treat Knowledge Universe as the source-backed retrieval layer.

Expected assistant behavior:

- Answer in natural Vietnamese.
- Call the user `anh`.
- Prefer concise executive answers.
- Use graph for entity relationships.
- Use search for source proof.
- Do not hallucinate project/store locations when both graph and search are empty.
- When confidence is low, say what is known and what source is missing.

Handover status: READY
