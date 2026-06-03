// ============================================================
// Agent OS - Worker Node - Main Worker
// ============================================================

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as si from 'systeminformation';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess, execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

// Configuration
const CONTROL_URL = process.env.CONTROL_URL || 'http://localhost:3700';
const WORKER_NAME = process.env.WORKER_NAME || `windows-${os.hostname()}`;
const HEARTBEAT_INTERVAL = 5000;
const TASK_POLL_INTERVAL = 3000;
const CONFIG_PATH = path.join(process.cwd(), 'config.json');

// Worker state
let workerId: string | null = null;
let workerToken: string | null = null;
let isRegistered = false;
let currentTaskId: string | null = null;
let ws: WebSocket | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let taskPollTimer: NodeJS.Timeout | null = null;
let logBuffer: Array<{ level: string; message: string; timestamp: string }> = [];
let activeChild: ChildProcess | null = null;
const cancelledTasks = new Set<string>();

// Task handlers
const handlers: Record<string, (task: any) => Promise<any>> = {};

// Initialize handlers
async function initHandlers() {
  const { handleBuild, handleQA, handleGitSync, handleAudit, handleScript, handleLaunch, handleClineTask } = await import('./handlers');
  handlers['build'] = handleBuild;
  handlers['qa'] = handleQA;
  handlers['git_sync'] = handleGitSync;
  handlers['audit'] = handleAudit;
  handlers['script'] = handleScript;
  handlers['cline'] = handleClineTask;
  handlers['deploy'] = handleScript;   // deploy uses script handler until dedicated handler exists
  handlers['launch'] = handleLaunch;

  const {
    handlePing,
    handleOpenAntigravity,
    handleCloseAntigravity,
    handleStartApiProxy,
    handleStopApiProxy,
    handleStatusApiProxy,
  } = await import('./handlers/commands.handler');

  handlers['ping'] = handlePing;
  handlers['open-antigravity'] = handleOpenAntigravity;
  handlers['close-antigravity'] = handleCloseAntigravity;
  handlers['start-api-proxy'] = handleStartApiProxy;
  handlers['stop-api-proxy'] = handleStopApiProxy;
  handlers['status-api-proxy'] = handleStatusApiProxy;
  // underscore aliases
  handlers['open_antigravity'] = handleOpenAntigravity;
  handlers['start_api_proxy'] = handleStartApiProxy;

  console.log('[Worker] Task handlers loaded');
}

// Logger
function log(level: string, message: string, data?: any) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(data ? { data } : {}),
  };
  logBuffer.push(entry);
  console.log(`[${level.toUpperCase()}] ${message}`, data || '');
  
  // Send to control plane via WebSocket
  if (ws && ws.readyState === WebSocket.OPEN && currentTaskId) {
    ws.send(JSON.stringify({ type: 'log', taskId: currentTaskId, log: entry }));
  }
}

// Get system info
async function getSystemInfo() {
  try {
    const [cpu, mem, disk, time] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
    ]);
    
    return {
      cpuUsage: cpu.currentLoad,
      memoryTotal: mem.total,
      memoryUsed: mem.used,
      diskTotal: disk[0]?.size || 0,
      diskUsed: disk[0]?.used || 0,
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: time.uptime,
    };
  } catch (err) {
    console.error('[Worker] Error getting system info:', err);
    return {
      cpuUsage: 0,
      memoryTotal: os.totalmem(),
      memoryUsed: os.totalmem() - os.freemem(),
      diskTotal: 0,
      diskUsed: 0,
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: os.uptime(),
    };
  }
}

// Get Tailscale IP
function getTailscaleIp(): string {
  try {
    // Try to get Tailscale IP from command
    const result = execSync('tailscale ip -4 2>nul', { encoding: 'utf-8', timeout: 3000 });
    return result.trim();
  } catch {
    return '127.0.0.1';
  }
}

// Register worker with control plane
async function register(): Promise<boolean> {
  const tailscaleIp = getTailscaleIp();
  
  // Check for existing config
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      workerId = config.id;
      workerToken = config.token;
      console.log('[Worker] Using existing config:', workerId);
      
      // Send heartbeat to verify connection. If the control plane no longer
      // knows this worker, discard stale config and register again.
      const heartbeatOk = await sendHeartbeat();
      if (heartbeatOk) {
        isRegistered = true;
        return true;
      }
      if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
      workerId = null;
      workerToken = null;
    } catch {}
  }
  
  try {
    console.log('[Worker] Registering with control plane...');
    const res = await axios.post(`${CONTROL_URL}/api/workers/register`, {
      name: WORKER_NAME,
      hostname: os.hostname(),
      tailscaleIp,
    });
    
    const { worker, config } = res.data;
    workerId = worker.id;
    workerToken = config.token;
    
    // Save config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    
    console.log('[Worker] Registered successfully:', workerId);
    isRegistered = true;
    return true;
  } catch (err: any) {
    console.error('[Worker] Registration failed:', err.message);
    return false;
  }
}

// Send heartbeat to control plane
async function sendHeartbeat(): Promise<boolean> {
  if (!workerId || !workerToken) return false;
  
  try {
    const systemInfo = await getSystemInfo();
    await axios.post(`${CONTROL_URL}/api/workers/${workerId}/heartbeat`, {
      status: currentTaskId ? 'busy' : 'online',
      systemInfo,
      currentTaskId,
    }, {
      headers: { 'x-worker-token': workerToken },
    });
    return true;
  } catch (err: any) {
    console.error('[Worker] Heartbeat failed:', err.message);
    if (err.response?.status === 401 || err.response?.status === 404) {
      isRegistered = false;
      workerId = null;
      workerToken = null;
      if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
    }
    return false;
  }
}

// Start heartbeat timer
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

function startTaskPolling() {
  if (taskPollTimer) clearInterval(taskPollTimer);
  taskPollTimer = setInterval(pollAssignedTasks, TASK_POLL_INTERVAL);
}

async function pollAssignedTasks() {
  if (!workerId || currentTaskId) return;

  try {
    const res = await axios.get(`${CONTROL_URL}/api/tasks`);
    const task = (res.data.tasks || []).find((t: any) => t.status === 'running' && t.workerId === workerId);
    if (task) {
      log('info', 'Picked up assigned task via polling fallback', { taskId: task.id });
      await executeTask(task);
    }
  } catch (err: any) {
    console.error('[Worker] Task poll failed:', err.message);
  }
}

// Connect to WebSocket
function connectWebSocket() {
  const wsUrl = CONTROL_URL.replace('http', 'ws') + '/ws';
  ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('[Worker] WebSocket connected');
    log('info', 'Worker WebSocket connected');
  });
  
  ws.on('close', () => {
    console.log('[Worker] WebSocket disconnected');
    isRegistered = false;
    setTimeout(connectWebSocket, 3000);
  });
  
  ws.on('error', (err) => {
    console.error('[Worker] WebSocket error:', err.message);
  });
  
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      await handleWsMessage(msg);
    } catch (err) {
      console.error('[Worker] Invalid WebSocket message:', err);
    }
  });
}

// Handle WebSocket messages
async function handleWsMessage(msg: any) {
  switch (msg.type) {
    case 'task_assign':
      if (!msg.workerId || msg.workerId === workerId) {
        await executeTask(msg.task);
      }
      break;
    case 'task_dispatch':
      // New protocol: direct command dispatch from control plane
      await handleDirectDispatch(msg);
      break;
    case 'ping':
      // Respond to ping from control plane
      handlePingMessage(msg);
      break;
    case 'task_cancel':
      stopCurrentTask(msg.taskId, 'Task cancelled by control plane');
      break;
    case 'task_kill':
      stopCurrentTask(msg.payload?.taskId || msg.taskId, msg.payload?.reason || 'Task killed by control plane');
      break;
    case 'task_abort':
      stopCurrentTask(msg.id || msg.taskId, msg.reason || 'Task aborted by user');
      break;
    case 'worker_stop':
      if (!msg.payload?.workerId || msg.payload.workerId === workerId) {
        stopCurrentTask(currentTaskId, msg.payload?.reason || 'Worker stopped by control plane');
        shutdown(0);
      }
      break;
    case 'emergency_stop':
      stopCurrentTask(currentTaskId, msg.payload?.reason || 'Emergency stop');
      shutdown(0);
      break;
  }
}

// Handle ping from control plane — respond with pong
function handlePingMessage(msg: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'pong',
      clientId: msg.clientId,
      workerName: WORKER_NAME,
      workerId,
      hostname: os.hostname(),
      version: '0.2.0',
      ts: new Date().toISOString(),
    }));
  }
}

// Handle direct command dispatch (new protocol for agentctl)
async function handleDirectDispatch(msg: any) {
  const { id, command, args, timeoutSec } = msg;
  const taskId = id || `direct-${Date.now()}`;

  log('info', `Direct dispatch: ${command} ${(args || []).join(' ')}`, { taskId });

  // Import the command router
  const { routeCommand } = await import('./handlers/commands');

  const t0 = Date.now();

  // Stream log function — sends logs back to control plane
  const streamLog = (stream: string, data: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'task_log',
        id: taskId,
        stream,
        data,
        ts: new Date().toISOString(),
      }));
    }
    log(stream === 'stderr' ? 'error' : 'info', data);
  };

  try {
    const result = await routeCommand(command, args || [], streamLog);
    const durationMs = Date.now() - t0;

    // Send result back
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'task_result',
        id: taskId,
        status: result.status,
        exitCode: result.exitCode,
        durationMs,
        payload: result.payload,
        error: result.error,
        artifacts: result.artifacts,
        ts: new Date().toISOString(),
      }));
    }
  } catch (err: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'task_result',
        id: taskId,
        status: 'error',
        error: err.message,
        durationMs: Date.now() - t0,
        ts: new Date().toISOString(),
      }));
    }
  }
}

function stopCurrentTask(taskId: string | null, reason: string) {
  if (!taskId || currentTaskId !== taskId) return;
  cancelledTasks.add(taskId);
  log('warn', reason, { taskId });
  if (activeChild) {
    try {
      activeChild.kill('SIGTERM');
    } catch {}
    try {
      activeChild.kill('SIGKILL');
    } catch {}
  }
}

// Execute task
async function executeTask(task: any) {
  if (currentTaskId) {
    log('warn', 'Already executing a task, skipping:', task.id);
    return;
  }
  
  currentTaskId = task.id;
  logBuffer = [];
  log('info', `Starting task: ${task.type}`, { taskId: task.id, project: task.project });
  
  const handler = handlers[task.type];
  if (!handler) {
    log('error', `Unknown task type: ${task.type}`);
    await reportTaskResult(task.id, false, `Unknown task type: ${task.type}`);
    return;
  }
  
  try {
    const result = await handler(task);
    if (cancelledTasks.has(task.id)) {
      await reportTaskResult(task.id, false, 'Task cancelled by kill switch');
      return;
    }
    await reportTaskResult(task.id, true, undefined, result ?? undefined);
    log('info', `Task completed: ${task.id}`);
  } catch (err: any) {
    log('error', `Task failed: ${err.message}`);
    await reportTaskResult(task.id, false, err.message);
  } finally {
    cancelledTasks.delete(task.id);
    currentTaskId = null;
    activeChild = null;
  }
}

// Report task result to control plane
async function reportTaskResult(taskId: string, success: boolean, error?: string, payload?: any) {
  if (!workerToken) return;

  try {
    await axios.post(`${CONTROL_URL}/api/tasks/${taskId}/complete`, {
      success,
      error,
      payload,
      logs: logBuffer,
    }, {
      headers: { 'x-worker-token': workerToken },
    });
  } catch (err: any) {
    console.error('[Worker] Failed to report task result:', err.message);
  }
}

// Execute shell command
function execCommand(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, [], {
      shell: true,
      cwd,
      env: { ...process.env },
    });
    activeChild = child;
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      log('info', text.trim());
    });
    
    child.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      log('warn', text.trim());
    });
    
    child.on('close', (code) => {
      if (activeChild === child) activeChild = null;
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
    
    child.on('error', (err) => {
      if (activeChild === child) activeChild = null;
      stderr += err.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

function shutdown(code: number) {
  console.log('[Worker] Shutting down...');
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (taskPollTimer) clearInterval(taskPollTimer);
  if (ws) ws.close();
  process.exit(code);
}

// Main
async function main() {
  console.log('================================================');
  console.log('  Agent OS Worker Node - Starting...');
  console.log(`  Worker Name: ${WORKER_NAME}`);
  console.log(`  Control URL: ${CONTROL_URL}`);
  console.log('================================================');
  
  // Initialize handlers
  await initHandlers();
  
  // Register with control plane
  const registered = await register();
  if (!registered) {
    console.error('[Worker] Failed to register, will retry...');
    setTimeout(main, 10000);
    return;
  }
  
  // Start heartbeat
  startHeartbeat();
  startTaskPolling();
  
  // Connect WebSocket
  connectWebSocket();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    shutdown(0);
  });
  
  process.on('SIGTERM', () => {
    shutdown(0);
  });
  
  console.log('[Worker] Ready and waiting for tasks...');
}

// Export for handlers
export { log, execCommand, getSystemInfo, workerToken, workerId, CONTROL_URL };
export { currentTaskId };

main().catch(console.error);
