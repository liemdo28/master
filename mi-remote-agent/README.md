# Mi Remote Agent

Deploy on any remote machine to connect it to Mi-Core.

## Quick Start

```bash
# 1. Copy this folder to remote machine
# 2. Install
npm install

# 3. Set environment
export MI_REMOTE_TOKEN=your-secret-token   # same as mi-core .env
export PROJECT_ROOT=/path/to/your/project
export PROJECT_NAME=integration-system     # or whatsapp-api

# 4. Start
node index.mjs
```

## Windows (start-remote-agent.bat)

```bat
set MI_REMOTE_TOKEN=your-secret-token
set PROJECT_ROOT=C:\path\to\project
set PROJECT_NAME=integration-system
node index.mjs
```

## Mi-Core .env (on main PC)

```
INTEGRATION_SYSTEM_HOST=100.x.x.x   # Tailscale IP of remote machine
INTEGRATION_SYSTEM_PORT=4005
WHATSAPP_HOST=100.x.x.x
WHATSAPP_PORT=4005
MI_REMOTE_TOKEN=your-secret-token
```

## Endpoints

| Method | Path                           | Auth | Description          |
|--------|--------------------------------|------|----------------------|
| GET    | /health                        | -    | Status check         |
| GET    | /project/status                | ✓    | Git, version, disk   |
| GET    | /project/logs                  | ✓    | Recent log lines     |
| GET    | /project/errors                | ✓    | Error log lines      |
| POST   | /project/pull                  | ✓    | git pull             |
| POST   | /project/qa                    | ✓    | Run test suite       |
| POST   | /project/command-preview       | ✓    | Dry-run command      |
| POST   | /project/execute-approved-action | ✓  | Run approved command |

## Security

- Bind to LAN/Tailscale IP only (not 0.0.0.0 in production)
- All write endpoints require `X-Mi-Token` header
- Level 3 actions require `double_confirmed: true`
- Never expose port to public internet
