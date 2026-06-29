# Agents & Services

## PM2 Services (Production)

| Service | Port | Status | Description |
|---------|------|---------|-------------|
| mi-core | 4001 | online | Central command API server |
| mi-ai-service | varies | online | AI inference service |
| mi-whatsapp-gateway | varies | online | WhatsApp Business API gateway |
| mi-n8n | varies | online | n8n workflow automation |
| mi-node-agent | varies | online | Node.js autonomous agent |
| mi-doordash-agent | varies | online | DoorDash revenue integration |
| qb-ops-agent | varies | online | QuickBooks operations agent |

## Local Agent System
- **Path:** D:/Project/Master/local-agent/
- **Global data:** D:/Project/Master/.local-agent-global/
- **Configuration:** D:/Project/Master/local-agent/config.json

## Connector Architecture
- 15 connectors registered (as of Sprint 2.1)
- Source of truth: connector-registry.json
- Cache location: .local-agent-global/visibility/

## Message Flow
WhatsApp → WhatsApp Gateway → mi-core → Router → Connector → Response

## Tags
agents, services, architecture, system, pm2, infrastructure
