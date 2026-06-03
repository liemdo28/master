# Agent OS - Control Plane Setup Guide

## Overview

Control Plane là server chính điều khiển mọi hoạt động của Agent OS. Nó chạy trên laptop/MacBook của CEO.

## System Requirements

### Minimum
- Node.js 18+
- 2GB RAM
- 1GB disk space
- Port 3700 available

### Recommended
- Node.js 20 LTS
- 4GB RAM
- 10GB disk space
- Static IP hoặc Tailscale

## Installation

### Step 1: Clone/Copy Files

```bash
# Copy entire agent-os folder to your machine
# Or clone from repository
git clone <repo-url> agent-os
cd agent-os/agent-control
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build

```bash
npm run build
```

### Step 4: Configure

Create `.env` file:

```env
# Server configuration
PORT=3700
HOST=0.0.0.0

# Database (SQLite - default)
DB_PATH=./data/agent-os.db

# Security
WORKER_SECRET=<generate-random-secret>

# Tailscale (optional - for remote access)
TAILSCALE_KEY=<your-tailnet-key>
```

### Step 5: Start

```bash
# Development
npm run dev

# Production
npm start
```

## Access Points

Sau khi start, Control Plane có thể truy cập tại:

| Access | URL |
|--------|-----|
| Local | http://localhost:3700 |
| Tailscale | http://100.x.x.x:3700 |
| Network | http://<your-ip>:3700 |

## Dashboard Sections

### 1. Dashboard
- Task statistics
- Quick task creation
- Recent activity

### 2. Tasks
- All tasks list
- Filter by status
- Task details and logs

### 3. Workers
- Connected workers
- Worker status
- System metrics (CPU, RAM, Disk)

### 4. Approvals
- Pending approval requests
- Approve/Reject actions

### 5. Logs
- Real-time log streaming
- Filter by task/worker

### 6. Artifacts
- Download task artifacts
- View reports

### 7. Kill Switch
- Stop running tasks
- Kill workers
- Emergency stop all

### 8. Settings
- Scan paths configuration
- Worker management
- System configuration

## Mobile Access

Dashboard responsive cho mobile. Truy cập từ iPhone:

1. Kết nối cùng Tailscale network
2. Mở Safari/Chrome
3. Truy cập http://100.x.x.x:3700

## Tailscale Setup

### Option 1: Exit Node

```bash
# On laptop with Tailscale
tailscale serve --bg
```

### Option 2: Funnel

```bash
# Make Control Plane accessible via internet
tailscale funnel 3700
```

### Option 3: Subnet Router

Configure your router to advertise subnet routes.

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/server.js --name agent-control

# Auto-restart on boot
pm2 startup
pm2 save
```

### Using Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3700
CMD ["npm", "start"]
```

```bash
docker build -t agent-control .
docker run -p 3700:3700 -v ./data:/app/data agent-control
```

### Using Systemd (Linux/Mac)

```ini
[Unit]
Description=Agent OS Control Plane
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/agent-os/agent-control
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Security

### Firewall

```bash
# Allow only from local network and Tailscale
ufw allow from 192.168.0.0/24 to any port 3700
ufw allow from 100.64.0.0/10 to any port 3700
```

### SSL/TLS

Use reverse proxy (nginx/caddy) for HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name agent.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3700;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Monitoring

### Health Check

```bash
curl http://localhost:3700/api/health
```

### Statistics

```bash
curl http://localhost:3700/api/stats
```

### Logs

```bash
# View logs
pm2 logs agent-control

# Or use journalctl
journalctl -u agent-control -f
```

## Backup

### Database Backup

```bash
# Stop server first
pm2 stop agent-control

# Backup SQLite database
cp data/agent-os.db backups/agent-os-$(date +%Y%m%d).db

# Restart
pm2 start agent-control
```

### Automated Backup

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
cp /opt/agent-os/agent-control/data/agent-os.db /backup/agent-os-$DATE.db
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3700
netstat -ano | findstr :3700

# Kill it
taskkill /PID <pid> /F
```

### WebSocket Not Working

1. Check browser console for errors
2. Ensure no proxy blocking WebSocket
3. Verify CORS settings in server

### Worker Not Connecting

1. Check worker logs
2. Verify CONTROL_URL in worker .env
3. Ensure network connectivity
4. Check firewall rules

## Updating

```bash
cd agent-os
git pull
cd agent-control
npm install
npm run build
pm2 restart agent-control
```

## Uninstall

```bash
# Stop service
pm2 stop agent-control

# Remove PM2
pm2 delete agent-control

# Remove files
rm -rf agent-os

# Remove data
rm -rf data/
```
