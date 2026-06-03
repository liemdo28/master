// ============================================================
// Agent OS - Control Plane - WebSocket Manager
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { registerClient, removeClient, handleWsMessage, sendPongToClient } from './wsHandler';

interface WsClient {
  id: string;
  ws: WebSocket;
  subscribedTasks: Set<string>;
  subscribedWorkers: Set<string>;
}

class WsManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WsClient> = new Map();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateId();
      const client: WsClient = {
        id: clientId,
        ws,
        subscribedTasks: new Set(),
        subscribedWorkers: new Set(),
      };
      this.clients.set(clientId, client);
      console.log(`[WS] Client connected: ${clientId}`);

      // Register with the new handler system
      registerClient(clientId, ws);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          // Route through new handler for ping/pong/dispatch
          handleWsMessage(clientId, data as Buffer);
          // Also handle legacy subscriptions
          this.handleMessage(client, msg);
        } catch (e) {
          console.error('[WS] Invalid message:', e);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        removeClient(clientId);
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

  private handleMessage(client: WsClient, msg: any): void {
    switch (msg.type) {
      case 'subscribe':
        if (msg.taskId) client.subscribedTasks.add(msg.taskId);
        if (msg.workerId) client.subscribedWorkers.add(msg.workerId);
        break;
      case 'unsubscribe':
        if (msg.taskId) client.subscribedTasks.delete(msg.taskId);
        if (msg.workerId) client.subscribedWorkers.delete(msg.workerId);
        break;
      // CEO Chat: approve or cancel a task from the chat UI
      case 'task_approve':
      case 'task_cancel': {
        if (!msg.taskId) break;
        // Lazy-import to avoid circular deps
        import('../services/approvalEngine').then(({ approveTask, denyTask }) => {
          import('../services/taskQueue').then(({ taskQueue }) => {
            if (msg.type === 'task_approve') {
              approveTask(msg.taskId, 'ceo');
              taskQueue.approveTask(msg.taskId);
            } else {
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
  broadcastLog(taskId: string, log: any): void {
    const message = JSON.stringify({ type: 'log', taskId, log });
    this.clients.forEach(client => {
      if (client.subscribedTasks.has(taskId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  // Broadcast task update
  broadcastTaskUpdate(taskId: string, update: any): void {
    const message = JSON.stringify({ type: 'task_update', taskId, update });
    this.clients.forEach(client => {
      if (client.subscribedTasks.has(taskId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  // Broadcast worker update
  broadcastWorkerUpdate(workerId: string, update: any): void {
    const message = JSON.stringify({ type: 'worker_update', workerId, update });
    this.clients.forEach(client => {
      if (client.subscribedWorkers.has(workerId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  // Broadcast to all clients
  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }

  // Send to specific client
  sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WsManager();
