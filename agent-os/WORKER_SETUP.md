# Agent OS - Worker Setup Guide

## Overview

The Agent OS Worker is a lightweight Windows service that connects to the Control Plane and executes tasks remotely.

## Requirements

### System Requirements
- Windows 10/11 or Windows Server 2019+
- Node.js 18 LTS or higher
- 4GB RAM minimum
- 10GB free disk space

### Software Requirements
- Git (for git operations)
- Node.js and npm
- Tailscale (for secure network access)

## Installation Steps

### 1. Install Node.js

Download from: https://nodejs.org/

Verify installation:
```cmd
node --version
npm --version
```

### 2. Install Git

Download from: https://git-scm.com/

Verify installation:
```cmd
git --version
```

### 3. Install Tailscale

1. Download Tailscale: https://tailscale.com/download/windows
2. Install and sign in
3. Note your Tailscale IP: `tailscale ip -4`

### 4. Deploy Worker Files

Copy the `agent-worker` directory to your Windows PC:

```cmd
# Create directory
mkdir C:\agent-worker

# Copy files (use your method: USB, network share, etc.)
# Copy entire agent-worker folder contents to C:\agent-worker
```

Or clone from repository:
```cmd
cd C:\
git clone <your-repo-url> agent-os
cd agent-os\agent-worker
```

### 5. Install Dependencies

```cmd
cd C:\agent-worker
npm install
```

### 6. Configure Worker

Create `.env` file:

```env
# Control Plane URL (use Tailscale IP for remote access)
CONTROL_URL=http://100.x.x.x:3700

# Worker name (visible in dashboard)
WORKER_NAME=office-pc-1

# Auto-detected (or specify manually)
TAILSCALE_IP=100.x.x.x
```

### 7. Build TypeScript

```cmd
npm run build
```

## Running the Worker

### Option 1: Direct Run (Testing)

```cmd
npm start
```

You should see:
```
================================================
  Agent OS Worker Node - Starting...
  Worker Name: office-pc-1
  Control URL: http://100.x.x.x:3700
================================================
[Worker] Task handlers loaded
[Worker] Registering with control plane...
[Worker] Registered successfully: abc123
[Worker] Ready and waiting for tasks...
```

### Option 2: Windows Service (Production)

```cmd
# Install as Windows Service (requires Administrator)
npm run install-worker

# Or manually:
node dist/install.js install
```

The service will:
- Start automatically on boot
- Restart on failure
- Run in background

**Service Management:**
```cmd
# Check status
node dist/install.js status

# Stop service
node dist/install.js stop

# Start service
node dist/install.js start

# Uninstall
node dist/install.js uninstall
```

### Option 3: PM2 (Alternative)

```cmd
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/worker.js --name agent-worker

# Auto-restart on boot
pm2 startup
pm2 save
```

## Verifying Installation

### 1. Check Dashboard

Open http://YOUR_CONTROL_PLANE_IP:3700 in browser

### 2. Navigate to Workers Tab

You should see:
- Worker name
- Status: "online"
- System metrics (CPU, RAM, Disk)

### 3. Run Test Task

1. Go to Dashboard
2. Create Task:
   - Type: "Source Audit"
   - Project: `C:\Users\YourName`
   - Priority: "Medium"
3. Click Create
4. Watch execution in Logs tab

## Troubleshooting

### Worker Not Appearing in Dashboard

1. Check Control Plane is running
2. Verify network connectivity:
   ```cmd
   curl http://YOUR_CONTROL_PLANE_IP:3700/api/health
   ```
3. Check firewall rules
4. View worker console output

### "Connection Refused" Error

1. Verify Control Plane URL in .env
2. Check Control Plane is listening on correct interface
3. Try using Tailscale IP instead of localhost

### Tailscale Issues

1. Verify Tailscale is running:
   ```cmd
   tailscale status
   ```
2. Check you can ping the Control Plane:
   ```cmd
   ping 100.x.x.x
   ```

### Service Won't Start

1. Check Windows Event Viewer
2. Run as console first to see errors
3. Verify Node.js is in PATH

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| CONTROL_URL | Control Plane URL | http://localhost:3700 |
| WORKER_NAME | Display name | windows-{hostname} |
| TAILSCALE_IP | Tailscale IP | auto-detected |

### Advanced Configuration

Edit `src/worker.ts` to modify:
- Heartbeat interval (default: 5000ms)
- Log buffer size
- Task timeout values

## Security Best Practices

1. **Firewall**: Only allow outbound to Control Plane
2. **Service Account**: Run worker as limited user if possible
3. **Token Storage**: Protect `config.json`
4. **Network**: Use Tailscale ACLs to restrict access

## Updating the Worker

```cmd
cd C:\agent-worker
git pull
npm install
npm run build

# Restart service
node dist/install.js stop
node dist/install.js start
```

## Uninstalling

```cmd
# Stop and remove service
node dist/install.js uninstall

# Remove files
rmdir /s /q C:\agent-worker
```
