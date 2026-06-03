"use strict";
// ============================================================
// Agent OS - Control Plane - WS Message Handler
// Handles ping/pong, shell dispatch, and worker-to-control-plane routing
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTo = exports.broadcastToWorkers = exports.sendPongToClient = exports.handleWsMessage = exports.getWorkerClient = exports.removeClient = exports.getClient = exports.registerClient = void 0;
const ws_1 = __importDefault(require("ws"));
const wsManager_1 = require("./wsManager");
const database_1 = require("./database");
const uuid_1 = require("uuid");
const journal_1 = require("./journal");
const clients = new Map();
// ── Client management ─────────────────────────────────────────────────────
function registerClient(id, ws) {
    const client = {
        id,
        ws,
        subscribedTasks: new Set(),
        subscribedWorkers: new Set(),
    };
    clients.set(id, client);
    return client;
}
exports.registerClient = registerClient;
function getClient(id) {
    return clients.get(id);
}
exports.getClient = getClient;
function removeClient(id) {
    clients.delete(id);
}
exports.removeClient = removeClient;
function getWorkerClient(workerId) {
    for (const client of clients.values()) {
        if (client.workerId === workerId)
            return client;
    }
    return undefined;
}
exports.getWorkerClient = getWorkerClient;
// ── Message handler ──────────────────────────────────────────────────────
function handleWsMessage(clientId, rawData) {
    const client = clients.get(clientId);
    if (!client)
        return;
    let msg;
    try {
        msg = JSON.parse(rawData.toString());
    }
    catch {
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
            if (msg.taskId)
                client.subscribedTasks.add(msg.taskId);
            if (msg.workerId)
                client.subscribedWorkers.add(msg.workerId);
            break;
        case 'unsubscribe':
            if (msg.taskId)
                client.subscribedTasks.delete(msg.taskId);
            if (msg.workerId)
                client.subscribedWorkers.delete(msg.workerId);
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
exports.handleWsMessage = handleWsMessage;
// ── Ping / Pong ─────────────────────────────────────────────────────────
function handlePing(client, msg) {
    const { workerName, ts } = msg;
    // Find worker by name or hostname
    const workers = database_1.workerDb.findAll();
    const worker = workers.find((w) => w.name === workerName || w.hostname === workerName || w.id === workerName);
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
    (0, journal_1.writeJournalEvent)({
        type: 'control_ping',
        taskId: undefined,
        project: undefined,
        actor: 'laptop',
        data: { workerName, workerId: worker.id, ts },
    });
    // Find if the worker has an active WS connection
    const workerClient = getWorkerClient(worker.id);
    if (workerClient && workerClient.ws.readyState === ws_1.default.OPEN) {
        // Forward ping to worker via WS
        sendTo(workerClient.id, {
            type: 'ping',
            clientId: client.id,
            ts: ts || new Date().toISOString(),
        });
    }
    else {
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
function sendPongToClient(clientId, msg) {
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
exports.sendPongToClient = sendPongToClient;
// ── Worker registration over WS ────────────────────────────────────────
function handleWorkerRegister(client, msg) {
    const { workerId, name, hostname, version } = msg;
    // Update client type
    client.clientType = 'worker';
    client.workerId = workerId;
    // Write audit event
    (0, journal_1.writeJournalEvent)({
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
function handleTaskDispatch(client, msg) {
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
            id: taskId || (0, uuid_1.v4)(),
            type: command,
            status: 'pending',
            priority: 'medium',
            project: 'agent-ctl',
            createdBy: 'agentctl',
            payload: JSON.stringify({ command, args, timeoutSec }),
            createdAt: new Date().toISOString(),
        };
        database_1.taskDb.insert(dbTask);
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
function handleTaskLog(client, msg) {
    const { id, stream, data } = msg;
    // Record log in DB
    const log = {
        id: (0, uuid_1.v4)(),
        taskId: id,
        timestamp: new Date().toISOString(),
        level: stream === 'stderr' ? 'error' : 'info',
        message: data || '',
    };
    database_1.taskLogDb.insert(log);
    // Broadcast to subscribed clients
    wsManager_1.wsManager.broadcastLog(id, log);
}
// ── Task result ──────────────────────────────────────────────────────────
function handleTaskResult(client, msg) {
    const { id, status, exitCode, durationMs, error, payload } = msg;
    const task = database_1.taskDb.findById(id);
    if (task) {
        const finalStatus = status === 'ok' ? 'completed' : status === 'error' ? 'failed' : status;
        database_1.taskDb.updateStatus(id, finalStatus, error);
        if (task.worker_id) {
            database_1.workerDb.updateStatus(task.worker_id, 'online');
        }
        (0, journal_1.writeJournalEvent)({
            type: finalStatus === 'completed' ? 'task_completed' : 'task_failed',
            taskId: id,
            project: task.project,
            actor: client.workerId || 'worker',
            data: { status, exitCode, durationMs, error, payload },
        });
    }
    // Broadcast result
    wsManager_1.wsManager.broadcastTaskUpdate(id, { status, exitCode, durationMs, error, payload });
}
// ── Task abort ───────────────────────────────────────────────────────────
function handleTaskAbort(client, msg) {
    const { id, reason } = msg;
    const task = database_1.taskDb.findById(id);
    if (!task)
        return;
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
    database_1.taskDb.updateStatus(id, 'cancelled');
    if (task.worker_id) {
        database_1.workerDb.updateStatus(task.worker_id, 'online');
    }
    (0, journal_1.writeJournalEvent)({
        type: 'task_aborted',
        taskId: id,
        project: task.project,
        actor: 'ceo',
        data: { reason },
    });
    wsManager_1.wsManager.broadcastTaskUpdate(id, { status: 'cancelled', reason });
}
// ── Worker heartbeat over WS ────────────────────────────────────────────
function handleWorkerHeartbeat(client, msg) {
    if (!client.workerId)
        return;
    const { status, systemInfo, currentTaskId } = msg;
    database_1.workerDb.updateHeartbeat(client.workerId, status || 'online', JSON.stringify(systemInfo || {}), currentTaskId);
    wsManager_1.wsManager.broadcastWorkerUpdate(client.workerId, {
        status,
        systemInfo,
        currentTaskId,
        lastHeartbeat: new Date().toISOString(),
    });
}
// ── Broadcast helpers ───────────────────────────────────────────────────
function broadcastToWorkers(message) {
    const data = JSON.stringify(message);
    for (const client of clients.values()) {
        if (client.clientType === 'worker' && client.ws.readyState === ws_1.default.OPEN) {
            client.ws.send(data);
        }
    }
}
exports.broadcastToWorkers = broadcastToWorkers;
// ── Low-level send ──────────────────────────────────────────────────────
function sendTo(clientId, message) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === ws_1.default.OPEN) {
        client.ws.send(JSON.stringify(message));
    }
}
exports.sendTo = sendTo;
//# sourceMappingURL=wsHandler.js.map