# Agent OS - Installation Guide

## Prerequisites

### Control Plane (Laptop/MacBook)
- Node.js 18+ 
- npm 8+
- Any modern browser

### Worker Node (Windows PC)
- Node.js 18+ 
- npm 8+
- Tailscale installed and running
- Git (for git operations)

## Step 1: Install Control Plane

```bash
# Navigate to agent-control directory
cd e:\Project\Master\agent-os\agent-control

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

The Control Plane will start on port 3700.

**Verify:**
- Open browser: http://localhost:3700
- You should see the Agent OS dashboard

## Step 2: Install Worker Node

On your Windows PC (the machine that will execute tasks):

```bash
# Navigate to agent-worker directory
cd e:\Project\Master\agent-os\agent-worker

# Install dependencies
npm install

# Build TypeScript
npm run build

# Copy environment file
copy .env.example .env
```

### Configure Worker

Edit `.env` file:

```env
CONTROL_URL=http://192.168.1.100:3700
WORKER_NAME=office-pc-1
TAILSCALE_IP=100.x.x.x
```

Replace `CONTROL_URL` with your Control Plane URL (use Tailscale IP for remote access).

## Step 3: Start Worker

### Option A: Direct Run (for testing)
```bash
npm start
```

### Option B: Windows Service (production)

```bash
# Install as Windows Service (requires Admin)
npm run install-worker

# Or use the install script directly
node dist/install.js install
```

### Option C: PM2 (alternative)

```bash
# Install PM2 globally
npm install -g pm2

# Start worker with PM2
pm2 start dist/worker.js --name agent-worker

# Auto-restart on failure
pm2 startup
pm2 save
```

## Step 4: Verify Connection

1. Open Control Plane dashboard: http://localhost:3700
2. Go to "Workers" tab
3. You should see your worker listed as "online"
4. Check System Info shows CPU, RAM, Disk usage

## Step 5: Run First Task

1. Go to "Dashboard"
2. In "Create New Task":
   - Type: `Build Project`
   - Project: `E:\Project\Master\Agent` (or any valid path on the worker PC)
   - Priority: `Medium`
3. Click "Create Task"
4. Watch the "Recent Tasks" table
5. Switch to "Logs" tab to see real-time execution

## Troubleshooting

### Worker not connecting

1. Check Control Plane is running: `curl http://localhost:3700/api/health`
2. Check firewall allows outbound to Control URL
3. Verify Tailscale is running: `tailscale status`
4. Check worker logs for connection errors

### Task not executing

1. Verify worker status is "online" in dashboard
2. Check project path exists on worker PC
3. Review task logs for errors

### WebSocket connection issues

1. Ensure no proxy blocking WebSocket upgrades
2. Check browser console for errors
3. Try refreshing the dashboard

## Network Configuration

### For Local Network
```env
CONTROL_URL=http://192.168.1.x:3700
```

### For Tailscale Network
```env
CONTROL_URL=http://100.x.x.x:3700
```

The worker will auto-detect its Tailscale IP and register with it.

## Security Notes

1. **Token Security**: Worker tokens are stored in `config.json`. Keep this file secure.
2. **Firewall**: Only allow inbound to Control Plane from your network.
3. **Tailscale**: Use Tailscale ACLs to restrict access.

## Updating

### Control Plane
```bash
cd agent-control
git pull
npm install
npm run build
# Restart the server
```

### Worker Node
```bash
cd agent-worker
git pull
npm install
npm run build
# Restart worker
pm2 restart agent-worker
```

## Uninstalling

### Worker (Windows Service)
```bash
cd agent-worker
node dist/install.js uninstall
```

### All Components
```bash
# Remove directories
rm -rf agent-control agent-worker shared

# Remove data (SQLite database)
rm -rf agent-os/data
```
