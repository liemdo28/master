# SEO Mi-Core Integration

## Connection
Each agent connects to Mi-Core using environment variables:
- `MI_CORE_URL` — base URL of Mi-Core API
- `MI_API_KEY` — authentication key
- `SEO_AGENT_ID` — agent identifier

## API Endpoints (agent -> Mi)
| Method | Path | Purpose |
|--------|------|------|
| POST | /api/seo/agents/register | Register agent on startup |
| POST | /api/seo/agents/:id/health | Push health |
| POST | /api/seo/agents/:id/status | Push status |
| POST | /api/seo/agents/:id/reports | Push report |
| POST | /api/seo/dashboard/:id | Push dashboard data |
| GET  | /api/seo/agents/:id/tasks | Pull assigned tasks |
| GET  | /api/seo/agents/:id/config | Pull remote config |

## Heartbeat
Every agent pushes status to Mi every 30 seconds.

## Graceful Degradation
If MI_CORE_URL is empty, agents run in local-only mode. All sync attempts are logged in `mi_sync_logs` table.
