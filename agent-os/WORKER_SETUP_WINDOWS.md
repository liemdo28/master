# Agent Worker - Windows Setup Guide

## Overview

Complete guide to install and run Agent Worker on a Windows PC.

---

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |
| Git | 2.30+ | `git --version` |
| Tailscale | Latest | `tailscale status` |

---

## Step 1: Install Node.js

Download: https://nodejs.org/en/download/

```cmd
# Verify
node --version
npm --version
```

---

## Step 2: Install Git

Download: https://git-scm.com/download/win

```cmd
# Verify
git --version
```

---

## Step 3: Install Tailscale

Download: https://tailscale.com/download/windows

```cmd
# Login
tailscale login

# Verify
tailscale status
tailscale ip -4
```

Note your Tailscale IP (100.x.x.x).

---

## Step 4: Deploy Worker

```cmd
# Navigate to agent-worker
cd E:\Project\Master\agent-os\agent-worker

# Install dependencies
npm install

# Build TypeScript
npm run build
```

---

## Step 5: Configure

Create `.env` file:

```env
# Control Plane URL (use Tailscale IP of the machine running Control Plane)
CONTROL_URL=http://100.x.x.x:3700

# Worker display name
WORKER_NAME=office-pc-1

# Tailscale IP (auto-detected if not set)
# TAILSCALE_IP=100.x.x.x
```

---

## Step 6: Start Worker

### Option A: Direct Run (Testing)

```cmd
npm start
```

Expected output:
```
================================================
  Agent OS Worker Node - Starting...
  Worker Name: office-pc-1
  Control URL: http://100.x.x.x:3700
================================================
[Worker] Task handlers loaded
[Worker] Registering with control plane...
[Worker] Registered successfully: abc-123-def
[Worker] WebSocket connected
[Worker] Ready and waiting for tasks...
```

### Option B: Windows Service (Production)

```cmd
# Run as Administrator
node dist/install.js install
```

Service will:
- Start automatically on boot
- Restart on failure (after 60 seconds)
- Run in background

### Option C: PM2 (Alternative)

```cmd
npm install -g pm2
pm2 start dist/worker.js --name agent-worker
pm2 startup
pm2 save
```

---

## Step 7: Verify

1. Open Control Plane dashboard: `http://100.x.x.x:3700`
2. Navigate to **Workers** tab
3. Confirm worker shows as **online**
4. Check system metrics (CPU, RAM, Disk)

---

## Service Management

```cmd
# Check status
node dist/install.js status

# Stop
node dist/install.js stop

# Start
node dist/install.js start

# Uninstall
node dist/install.js uninstall
```

---

## Executor Capabilities

After installation, the worker supports:

| Executor | Task Types |
|----------|-----------|
| File | Read, write, audit, scan |
| Git | Status, pull, push, commit |
| Build | npm, composer, pip, docker |
| QA | Playwright, Cypress, unit tests |
| App | Open VS Code, Chrome, Docker, etc. |
| Script | Run approved .bat/.ps1 scripts |
| Cline | Open, inject prompt, monitor |
| Antigravity | Open, inject prompt, monitor |
| API Proxy | Start, stop, status |

---

## Paths Accessible

```
E:\Project\Master (read/write)
D:\ (read)
E:\ (read)
F:\ (read)
G:\My Drive (read)
```

---

## Firewall Configuration

Worker only needs **outbound** access to Control Plane:

```cmd
# No inbound rules needed
# Worker connects TO Control Plane, not the other way around
```

If firewall blocks outbound:
```cmd
netsh advfirewall firewall add rule name="Agent Worker" dir=out action=allow program="C:\Program Files\nodejs\node.exe"
```

---

## Troubleshooting

### Worker not connecting

```cmd
# 1. Check Control Plane is reachable
curl http://100.x.x.x:3700/api/health

# 2. Check Tailscale
tailscale status
tailscale ping 100.x.x.x

# 3. Check .env file
type .env

# 4. Check logs
npm start 2>&1
```

### Worker registered but no tasks executing

```cmd
# 1. Check worker status in dashboard
# 2. Verify project paths exist
dir E:\Project\Master

# 3. Check permissions
icacls E:\Project\Master
```

### Service won't start

```cmd
# 1. Check Event Viewer
eventvwr.msc

# 2. Run manually first to see errors
node dist/worker.js

# 3. Check Node.js in PATH
where node
```

---

## Auto-Update

```cmd
cd E:\Project\Master\agent-os\agent-worker
git pull
npm install
npm run build

# Restart service
node dist/install.js stop
node dist/install.js start
```

---

## Uninstall

```cmd
# Stop and remove service
node dist/install.js uninstall

# Or with PM2
pm2 stop agent-worker
pm2 delete agent-worker

# Remove config
del config.json
del .env
```
