# ACTIVE_SOURCE_INVENTORY.md
> Source classification per Mi Company OS no-bloat rule.
> Machine-readable registry: `server/src/company-os/source-inventory.ts`
> Updated: 2026-06-18

---

## Summary

| Class | Count |
|-------|-------|
| ACTIVE | 32 |
| PLANNED | 8 |
| INSTALLED_NOT_USED | 1 |
| REMOVE | 2 |

---

## ACTIVE — In production use

### AI Models
| Model | Used By |
|-------|---------|
| qwen3:14b | dispatch, finance, rd, competitive-intel, investment-fp |
| qwen3:8b | executive-assistant, report-center, library, restaurant-intelligence, marketing, website-studio, video-studio, crm, hr |
| gemma3:12b | qa (QA model for all depts) |
| qwen2.5-coder:7b | engineering |

### Core OS Tools
| Tool | Used By |
|------|---------|
| GStack Runtime | dispatch |
| Intent Router | dispatch |
| Jarvis Core (Ph30) | dispatch |
| COO Orchestrator v4 | dispatch, marketing, engineering |
| Approval Gate (Ph20) | finance, tax-compliance, marketing, engineering, hr |
| Council (Ph21) | rd |
| Evidence Store | qa, dispatch, report-center |
| QA Gate | qa |
| Task Intelligence (Ph16) | executive-assistant |
| Operational Memory (Ph15) | executive-assistant, crm, hr |
| Executive Briefing (Ph17) | report-center |
| Strategic Memory (Ph18) | report-center, investment-fp |
| AgenView (Ph19) | report-center |
| Autonomous Engine (Ph20) | technical-operations |
| Self-Improve (Ph22) | qa |
| Health Intel (Ph23) | executive-assistant |
| Digital Twin (Ph24) | technical-operations |
| Graph Layer (Ph14) | dispatch |
| Node Registry (Ph6/7) | technical-operations |

### External Services
| Service | Used By |
|---------|---------|
| Toast POS Connector | restaurant-intelligence |
| DoorDash Agent | restaurant-intelligence |
| Food Safety Gateway | restaurant-intelligence |
| QuickBooks Runtime | finance, tax-compliance |
| Asana Connector | executive-assistant |
| Visibility Connector | report-center, restaurant-intelligence |
| Knowledge Federation | library, rd, competitive-intel, hr, website-studio |
| Knowledge DB | library |
| Playwright MCP | technical-operations, competitive-intel, website-studio |
| Browser Operator | technical-operations, competitive-intel, website-studio |

### Creative Pipeline
| Tool | Used By |
|------|---------|
| Restaurant Creative Engine | marketing, brand-creative |
| ComfyUI | brand-creative, video-studio |
| Flux Workflow | brand-creative |
| AI Developer Agent | engineering |
| Aider | engineering |
| OpenHands | engineering |
| Agent Coding API Keys | engineering |

---

## PLANNED — Not yet connected

| Source | Dept | Notes |
|--------|------|-------|
| Twenty CRM | crm | CRM dept is PLANNED |
| Qdrant Vector DB | library | Library dept is PLANNED |
| Outline Wiki | library | Library dept is PLANNED |
| Wan Video | video-studio | Video Studio is PLANNED |
| Hunyuan Video | video-studio | Video Studio is PLANNED |
| LTX Video | video-studio | Video Studio is PLANNED |

---

## INSTALLED_NOT_USED

| Source | Dept | Notes |
|--------|------|-------|
| Paperless-NGX | tax-compliance | Installed but tax-compliance dept not yet ACTIVE |

---

## REMOVE

| Source | Reason |
|--------|--------|
| qwen3:1.7b | Too small. No dept uses it. `ollama rm qwen3:1.7b` |
| deepseek-r1:14b | High VRAM. Superseded by qwen3:14b. `ollama rm deepseek-r1:14b` |
