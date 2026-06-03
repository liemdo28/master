// ============================================================
// Agent OS - Control Plane - WS Message Handler
// Handles ping/pong, shell dispatch, and worker-to-control-plane routing
// ============================================================

import WebSocket from 'ws';
import { wsManager } from './wsManager';
import { workerDb, taskDb, taskLogDb } from './database';
import { v4 as uuidv4 } from 'uuid';
import { writeJournalEvent } from './journal';

interface WsClient {
  id: string;
  ws: WebSocket;
  workerId?: string;   // set if this is a worker connection
  clientType?: 'ceo' | 'worker';
  subscribedTasks: Set<string>;
  subscribedWorkers: Set<string>;
}

const clients = new Map<string, WsClient>();

// ── Client management ─────────────────────────────────────────────────────

export function registerClient(id: string, ws: WebSocket): WsClient {
  const client: WsClient = {
    id,
    ws,
    subscribedTasks: new Set(),
    subscribedWorkers: new Set(),
  };
  clients.set(id, client);
  return client;
}

export function getClient(id: string): WsClient | undefined {
  return clients.get(id);
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function getWorkerClient(workerId: string): WsClient | undefined {
  for (const client of clients.values()) {
    if (client.workerId === workerId) return client;
  }
  return undefined;
}

// ── Message handler ──────────────────────────────────────────────────────

export function handleWsMessage(clientId: string, rawData: Buffer): void {
  const client = clients.get(clientId);
  if (!client) return;

  let msg: any;
  try {
    msg = JSON.parse(rawData.toString());
  } catch {
    console.error('[WS Handler] Invalid JSON');
    return;
  }

  switch (msg.type) {
    case 'ping':
      handlePing(client, msg);
      break;
    case 'pong':
      // Workers don't send pong; this is for completeness
      break;
    case 'subscribe':
      if (msg.taskId) client.subscribedTasks.add(msg.taskId);
      if (msg.workerId) client.subscribedWorkers.add(msg.workerId);
      break;
    case 'unsubscribe':
      if (msg.taskId) client.subscribedTasks.delete(msg.taskId);
      if (msg.workerId) client.subscribedWorkers.delete(msg.workerId);
      break;
    case 'worker_register':
      handleWorkerRegister(client, msg);
      break;
    case 'task_dispatch':
      handleTaskDispatch(client, msg);
      break;
    case 'task_log':
      handleTaskLog(client, msg);
      break;
    case 'task_result':
      handleTaskResult(client, msg);
      break;
    case 'task_abort':
      handleTaskAbort(client, msg);
      break;
    case 'heartbeat':
      handleWorkerHeartbeat(client, msg);
      break;
    default:
      console.warn(`[WS Handler] Unknown message type: ${msg.type}`);
  }
}

// ── Ping / Pong ─────────────────────────────────────────────────────────

function handlePing(client: WsClient, msg: any): void {
  const { workerName, ts } = msg;
  
  // Find worker by name or hostname
  const workers = workerDb.findAll();
  const worker = workers.find((w: any) =>
    w.name === workerName || w.hostname === workerName || w.id === workerName
  );

  if (!worker) {
    sendTo(client.id, {
      type: 'pong',
      workerName,
      status: 'not_found',
      ts: new Date().toISOString(),
    });
    return;
  }

  // Record in audit ledger
  writeJournalEvent({
    type: 'control_ping',
    taskId: undefined,
    project: undefined,
    actor: 'laptop',
    data: { workerName, workerId: worker.id, ts },
  });

  // Find if the worker has an active WS connection
  const workerClient = getWorkerClient(worker.id);

  if (workerClient && workerClient.ws.readyState === WebSocket.OPEN) {
    // Forward ping to worker via WS
    sendTo(workerClient.id, {
      type: 'ping',
      clientId: client.id,
      ts: ts || new Date().toISOString(),
    });
  } else {
    // Worker offline — respond directly
    sendTo(client.id, {
      type: 'pong',
      workerName: worker.name || worker.hostname,
      workerId: worker.id,
      status: worker.status || 'offline',
      hostname: worker.hostname,
      ts: new Date().toISOString(),
    });
  }
}

function sendPongToClient(clientId: string, msg: any): void {
  sendTo(clientId, {
    type: 'pong',
    workerName: msg.workerName,
    workerId: msg.workerId,
    hostname: msg.hostname,
    version: msg.version,
    status: 'online',
    ts: new Date().toISOString(),
  });
}

export { sendPongToClient };

// ── Worker registration over WS ────────────────────────────────────────

function handleWorkerRegister(client: WsClient, msg: any): void {
  const { workerId, name, hostname, version } = msg;

  // Update client type
  client.clientType = 'worker';
  client.workerId = workerId;

  // Write audit event
  writeJournalEvent({
    type: 'worker_registered',
    taskId: undefined,
    project: undefined,
    actor: workerId,
    data: { name, hostname, version },
  });

  console.log(`[WS Handler] Worker registered: ${name} (${workerId})`);

  // Send ack
  sendTo(client.id, {
    type: 'worker_registered_ack',
    workerId,
    ts: new Date().toISOString(),
  });
}

// ── Task dispatch ────────────────────────────────────────────────────────

function handleTaskDispatch(client: WsClient, msg: any): void {
  // This handles shell commands sent from agentctl via WS
  const { command, args, timeoutSec, taskId, workerId } = msg;

  const targetWorkerId = workerId || msg.targetWorkerId;
  if (!targetWorkerId) {
    sendTo(client.id, {
      type: 'task_result',
      id: taskId,
      status: 'error',
      error: 'No target worker specified',
    });
    return;
  }

  const workerClient = getWorkerClient(targetWorkerId);
  if (!workerClient) {
    // Fall back to creating a DB task for the polling worker
    const dbTask = {
      id: taskId || uuidv4(),
      type: command,
      status: 'pending',
      priority: 'medium',
      project: 'agent-ctl',
      createdBy: 'agentctl',
      payload: JSON.stringify({ command, args, timeoutSec }),
      createdAt: new Date().toISOString(),
    };
    taskDb.insert(dbTask);
    console.log(`[WS Handler] Task ${dbTask.id} queued (worker offline)`);
    sendTo(client.id, {
      type: 'task_result',
      id: dbTask.id,
      status: 'queued',
    });
    return;
  }

  // Forward to worker via WS
  sendTo(workerClient.id, {
    type: 'task_dispatch',
    id: taskId,
    command,
    args: args || [],
    timeoutSec: timeoutSec || 60,
  });

  // Subscribe to task updates
  client.subscribedTasks.add(taskId);
}

// ── Task log stream ─────────────────────────────────────────────────────

function handleTaskLog(client: WsClient, msg: any): void {
  const { id, stream, data } = msg;

  // Record log in DB
  const log = {
    id: uuidv4(),
    taskId: id,
    timestamp: new Date().toISOString(),
    level: stream === 'stderr' ? 'error' : 'info',
    message: data || '',
  };
  taskLogDb.insert(log);

  // Broadcast to subscribed clients
  wsManager.broadcastLog(id, log);
}

// ── Task result ──────────────────────────────────────────────────────────

function handleTaskResult(client: WsClient, msg: any): void {
  const { id, status, exitCode, durationMs, error, payload } = msg;

  const task = taskDb.findById(id);
  if (task) {
    const finalStatus = status === 'ok' ? 'completed' : status === 'error' ? 'failed' : status;
    taskDb.updateStatus(id, finalStatus, error);
    if (task.worker_id) {
      workerDb.updateStatus(task.worker_id, 'online');
    }
    writeJournalEvent({
      type: finalStatus === 'completed' ? 'task_completed' : 'task_failed',
      taskId: id,
      project: task.project,
      actor: client.workerId || 'worker',
      data: { status, exitCode, durationMs, error, payload },
    });
  }

  // Broadcast result
  wsManager.broadcastTaskUpdate(id, { status, exitCode, durationMs, error, payload });
}

// ── Task abort ───────────────────────────────────────────────────────────

function handleTaskAbort(client: WsClient, msg: any): void {
  const { id, reason } = msg;
  const task = taskDb.findById(id);
  if (!task) return;

  // Notify the worker's WS client
  if (task.worker_id) {
    const workerClient = getWorkerClient(task.worker_id);
    if (workerClient) {
      sendTo(workerClient.id, {
        type: 'task_abort',
        id,
        reason: reason || 'user_requested',
      });
    }
  }

  taskDb.updateStatus(id, 'cancelled');
  if (task.worker_id) {
    workerDb.updateStatus(task.worker_id, 'online');
  }

  writeJournalEvent({
    type: 'task_aborted',
    taskId: id,
    project: task.project,
    actor: 'ceo',
    data: { reason },
  });

  wsManager.broadcastTaskUpdate(id, { status: 'cancelled', reason });
}

// ── Worker heartbeat over WS ────────────────────────────────────────────

function handleWorkerHeartbeat(client: WsClient, msg: any): void {
  if (!client.workerId) return;
  const { status, systemInfo, currentTaskId } = msg;
  workerDb.updateHeartbeat(
    client.workerId,
    status || 'online',
    JSON.stringify(systemInfo || {}),
    currentTaskId
  );
  wsManager.broadcastWorkerUpdate(client.workerId, {
    status,
    systemInfo,
    currentTaskId,
    lastHeartbeat: new Date().toISOString(),
  });
}

// ── Broadcast helpers ───────────────────────────────────────────────────

export function broadcastToWorkers(message: any): void {
  const data = JSON.stringify(message);
  for (const client of clients.values()) {
    if (client.clientType === 'worker' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// ── Low-level send ──────────────────────────────────────────────────────

function sendTo(clientId: string, message: any): void {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

export { sendTo };
