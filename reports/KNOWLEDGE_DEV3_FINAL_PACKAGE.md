# KNOWLEDGE_DEV3_FINAL_PACKAGE

Generated: 2026-06-12T23:17:42.208Z

## Knowledge API Inventory

| Purpose | Method | Endpoint |
|---|---|---|
| Health | GET | `/api/jarvis/health` |
| Stats | GET | `/api/jarvis/knowledge/stats` |
| Search | GET | `/api/jarvis/knowledge/search?q=<query>&limit=<n>` |
| Refresh | POST | `/api/jarvis/knowledge/index` |
| Lookup | GET | `/api/jarvis/graph/explore/<name>` |

## Entity Inventory

| Entity Type | Endpoint |
|---|---|
| Projects | `/api/jarvis/graph/entities?type=project` |
| Stores | `/api/jarvis/graph/entities?type=store` |
| Entity relationships | `/api/jarvis/graph/explore/<name>` |

## Project Inventory

| Purpose | Endpoint |
|---|---|
| List projects | `/api/projects` |
| Rescan projects | `/api/projects/scan` |
| Project health | `/api/projects/health` |
| Project registry | `/api/projects/registry` |
| Project detail | `/api/projects/:id` |

## Store Inventory

| Store | Lookup | Search Evidence |
|---|---|---|
| Stone Oak | `/api/jarvis/graph/explore/Stone%20Oak` | `/api/jarvis/knowledge/search?q=Stone%20Oak&limit=5` |
| Bandera | `/api/jarvis/graph/explore/Bandera` | `/api/jarvis/knowledge/search?q=Bandera&limit=5` |
| Rim | `/api/jarvis/graph/explore/Rim` | `/api/jarvis/knowledge/search?q=Rim&limit=5` |

## Runtime Endpoints

| Runtime | Endpoint |
|---|---|
| Mi-Core local | `http://127.0.0.1:4001` |
| Jarvis API | `http://127.0.0.1:4001/api/jarvis` |
| Projects API | `http://127.0.0.1:4001/api/projects` |

## Health Endpoints

| Health Check | Endpoint |
|---|---|
| Jarvis health | `/api/jarvis/health` |
| Knowledge freshness | `/api/jarvis/knowledge/stats` |
| Project health | `/api/projects/health` |

## Confidence Scoring Method

| Signal | Score Contribution |
|---|---:|
| Graph entity exact match | 0.35 |
| Source path/title exact match | 0.30 |
| Top-5 search result contains expected primary source | 0.20 |
| Fresh index/stats available | 0.10 |
| No API warning/failure | 0.05 |

Recommended thresholds:

- `>= 0.90`: answer directly.
- `0.70 - 0.89`: answer with source caveat.
- `< 0.70`: ask for clarification or say source is missing.
