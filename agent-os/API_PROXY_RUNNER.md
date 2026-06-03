# Agent OS - API Proxy Runner

## Overview

Agent Worker có thể start/stop/monitor API Proxy để cung cấp API keys cho các task.

## Supported Proxy

```
E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat
```

## Task Definition

```json
{
  "type": "api_proxy",
  "project": "E:\\Project\\Master\\Agent\\agent-coding-api-keys",
  "payload": {
    "action": "start|stop|status|restart",
    "proxyName": "default"
  }
}
```

## Actions

### Start Proxy

```json
{
  "action": "start",
  "proxyName": "agent-coding"
}
```

Worker sẽ:
1. Check if proxy already running
2. Run `start-proxy-win.bat`
3. Wait for port to be active
4. Verify health endpoint
5. Return status

### Stop Proxy

```json
{
  "action": "stop",
  "proxyName": "agent-coding"
}
```

### Status Check

```json
{
  "action": "status",
  "proxyName": "agent-coding"
}
```

Returns:
```json
{
  "running": true,
  "port": 8080,
  "pid": 12345,
  "uptime": 3600,
  "providers": ["openai", "claude", "gemini"]
}
```

## Handler Implementation

```typescript
export async function handleApiProxy(task: any) {
  const { action, proxyName } = task.payload;
  const proxyDir = 'E:\\Project\\Master\\Agent\\agent-coding-api-keys';
  
  switch (action) {
    case 'start':
      await startProxy(proxyDir, proxyName);
      break;
    case 'stop':
      await stopProxy(proxyName);
      break;
    case 'status':
      return await getProxyStatus(proxyName);
    case 'restart':
      await stopProxy(proxyName);
      await startProxy(proxyDir, proxyName);
      break;
  }
}

async function startProxy(proxyDir: string, name: string) {
  log('info', `Starting API proxy: ${name}`);
  
  // Check if already running
  const existing = await findProcess(8080);
  if (existing) {
    log('info', 'Proxy already running', { pid: existing.pid });
    return;
  }
  
  // Start proxy
  const startScript = path.join(proxyDir, 'start-proxy-win.bat');
  await execCommand(`start /B cmd /c "${startScript}"`, proxyDir);
  
  // Wait for startup
  await waitForPort(8080, 30000);
  
  // Verify health
  const health = await checkHealth('http://localhost:8080/health');
  log('info', 'API Proxy started', { health });
}

async function stopProxy(name: string) {
  const process = await findProcessByName('node');
  if (process && process.port === 8080) {
    execCommand(`taskkill /PID ${process.pid} /F`);
    log('info', 'API Proxy stopped');
  }
}

async function getProxyStatus(name: string) {
  const process = await findProcess(8080);
  
  if (!process) {
    return { running: false };
  }
  
  try {
    const health = await axios.get('http://localhost:8080/health');
    return {
      running: true,
      port: 8080,
      pid: process.pid,
      uptime: process.uptime,
      providers: health.data.providers,
    };
  } catch {
    return { running: true, port: 8080, pid: process.pid, error: 'Health check failed' };
  }
}
```

## Logging

Proxy output được stream về dashboard:

```
[INFO] Proxy starting on port 8080...
[INFO] Loading API keys...
[INFO] OpenAI: ✅ configured
[INFO] Claude: ✅ configured
[INFO] Gemini: ✅ configured
[INFO] Proxy ready: http://localhost:8080
```
