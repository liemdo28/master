"use strict";
// ============================================================
// Agent OS - Control Plane - WebSocket Manager
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = void 0;
const ws_1 = require("ws");
const wsHandler_1 = require("./wsHandler");
class WsManager {
    wss = null;
    clients = new Map();
    initialize(server) {
        this.wss = new ws_1.WebSocketServer({ server, path: '/ws' });
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateId();
            const client = {
                id: clientId,
                ws,
                subscribedTasks: new Set(),
                subscribedWorkers: new Set(),
            };
            this.clients.set(clientId, client);
            console.log(`[WS] Client connected: ${clientId}`);
            // Register with the new handler system
            (0, wsHandler_1.registerClient)(clientId, ws);
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    // Route through new handler for ping/pong/dispatch
                    (0, wsHandler_1.handleWsMessage)(clientId, data);
                    // Also handle legacy subscriptions
                    this.handleMessage(client, msg);
                }
                catch (e) {
                    console.error('[WS] Invalid message:', e);
                }
            });
            ws.on('close', () => {
                this.clients.delete(clientId);
                (0, wsHandler_1.removeClient)(clientId);
                console.log(`[WS] Client disconnected: ${clientId}`);
            });
            ws.on('error', (err) => {
                console.error(`[WS] Client error: ${clientId}`, err);
            });
            // Send welcome message
            this.sendToClient(clientId, { type: 'connected', clientId });
        });
        console.log('[WS] WebSocket server initialized on /ws');
    }
    handleMessage(client, msg) {
        switch (msg.type) {
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
            // CEO Chat: approve or cancel a task from the chat UI
            case 'task_approve':
            case 'task_cancel': {
                if (!msg.taskId)
                    break;
                // Lazy-import to avoid circular deps
                Promise.resolve().then(() => __importStar(require('../services/approvalEngine'))).then(({ approveTask, denyTask }) => {
                    Promise.resolve().then(() => __importStar(require('../services/taskQueue'))).then(({ taskQueue }) => {
                        if (msg.type === 'task_approve') {
                            approveTask(msg.taskId, 'ceo');
                            taskQueue.approveTask(msg.taskId);
                        }
                        else {
                            denyTask(msg.taskId, 'ceo');
                            taskQueue.updateTaskStatus(msg.taskId, 'cancelled');
                        }
                    });
                });
                break;
            }
        }
    }
    // Broadcast log to all subscribed clients
    broadcastLog(taskId, log) {
        const message = JSON.stringify({ type: 'log', taskId, log });
        this.clients.forEach(client => {
            if (client.subscribedTasks.has(taskId) && client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
    }
    // Broadcast task update
    broadcastTaskUpdate(taskId, update) {
        const message = JSON.stringify({ type: 'task_update', taskId, update });
        this.clients.forEach(client => {
            if (client.subscribedTasks.has(taskId) && client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
    }
    // Broadcast worker update
    broadcastWorkerUpdate(workerId, update) {
        const message = JSON.stringify({ type: 'worker_update', workerId, update });
        this.clients.forEach(client => {
            if (client.subscribedWorkers.has(workerId) && client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
    }
    // Broadcast to all clients
    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                client.ws.send(data);
            }
        });
    }
    // Send to specific client
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === ws_1.WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }
    generateId() {
        return Math.random().toString(36).substring(2, 15);
    }
    getClientCount() {
        return this.clients.size;
    }
}
exports.wsManager = new WsManager();
//# sourceMappingURL=wsManager.js.map