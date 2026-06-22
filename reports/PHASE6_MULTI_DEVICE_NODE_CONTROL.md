# Phase 6 — Multi-Device Node Control

**Status:** COMPLETE  
**Date:** 2026-06-11

## Deliverables

### Mi-Core (central brain)
| File | Purpose |
|------|---------|
| `server/src/nodes/node-registry.ts` | In-memory registry; heartbeat TTL 3 min; role tracking |
| `server/src/nodes/node-controller.ts` | Forward commands to agents; SHA-256 auth headers |
| `server/src/routes/nodes.ts` | /api/nodes/status, register, heartbeat, exec, file, role |

### Mi Node Agent (standalone, deploy to each laptop)
| File | Purpose |
|------|---------|
| `mi-node-agent/src/server.ts` | Express server; command allowlist; folder allowlist; auto-register |
| `mi-node-agent/package.json` | Dependencies (express only) |
| `mi-node-agent/tsconfig.json` | Build config |

## Deploy to Laptop
```bash
cd E:\Project\Master\mi-node-agent
npm install && npm run build

# Set env vars:
NODE_ID=laptop1
NODE_SECRET=your-secret-here
NODE_AGENT_PORT=4100
MI_CORE_URL=http://192.168.1.100:4001

npm start
```

## Security
- Commands must match exact allowlist patterns
- Folder access restricted to allowlisted roots
- Auth: `x-node-id` + `x-node-secret` (SHA-256 of secret + salt)
- NODE_SECRET never logged or exposed in responses
- All exec calls logged with outcome

## Allowlisted Commands
git status, git log, git pull, npm run build/test, pm2 list/status/restart/stop/start, node --version, docker ps/info
