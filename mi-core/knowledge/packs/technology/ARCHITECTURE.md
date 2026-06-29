# System Architecture

## Overview
The Mi (Master Intelligence) system is a distributed multi-agent platform for operating restaurant businesses with autonomous agents that can see, reason, and act across multiple data sources.

## Core Components

### mi-core (Central API Server)
- **Port:** 4001
- **Framework:** Express + TypeScript
- **Path:** D:/Project/Master/mi-core/server/
- **Responsibilities:** API routing, visibility hub, connector registry, knowledge DB, approval engine

### WhatsApp Gateway
- **Service:** mi-whatsapp-gateway
- **Framework:** Node.js + WhatsApp Web.js
- **Purpose:** Receives messages from customers, forwards to mi-core, sends responses

### AI Service
- **Service:** mi-ai-service
- **Purpose:** LLM inference for autonomous decision making
- **Models:** Gemma 4 12B (local), Claude Opus (cloud)

### n8n Workflow Engine
- **Service:** mi-n8n
- **Purpose:** Workflow automation (daily sync, reports, reminders)
- **Webhooks:** Triggered by mi-core on events

## Data Flow
```
User → WhatsApp → Gateway → mi-core → Router → Connector → Response
                                         ↓
                                   Visibility Hub
                                         ↓
                                   Knowledge DB
```

## Key Files
- `server/src/index.ts` — Express app entry
- `server/src/visibility/visibility-hub.ts` — All connector orchestration
- `server/src/knowledge/knowledge-db.ts` — SQLite FTS5 search
- `server/src/approval/gate.ts` — Human-in-loop approval
- `server/src/ws-broadcast.ts` — WebSocket hub

## Security
- Auth via requireAuth middleware
- Approval required for high-risk actions
- Secrets via .env, not hardcoded

## Tags
architecture, system, technical, design, components, infrastructure
