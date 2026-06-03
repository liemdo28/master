// ============================================================
// Agent OS - Control Plane - Main Server
// ============================================================

import express from 'express';
import cors from 'cors';
import http from 'http';
import * as path from 'path';
import { initDatabase } from './services/database';
import { initApprovalSchema } from './services/approvalEngine';
import { wsManager } from './services/wsManager';
import { taskQueue } from './services/taskQueue';

// Routes
import taskRoutes from './routes/tasks';
import workerRoutes from './routes/workers';
import projectRoutes from './routes/projects';
import chatRoutes from './routes/chat';
import killRoutes from './routes/kill';
import approvalRoutes from './routes/approvals';
import snapshotRoutes from './routes/snapshots';

const PORT = process.env.PORT || 3700;

async function main() {
  console.log('================================================');
  console.log('  Agent OS Control Plane - Starting...');
  console.log('================================================');

  // Initialize database
  initDatabase();

  // Create Express app
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Serve static files (dashboard)
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Initialize approval schema
  initApprovalSchema();

  // API Routes
  app.use('/api/tasks', taskRoutes);
  app.use('/api/workers', workerRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/kill', killRoutes);
  app.use('/api/approvals', approvalRoutes);
  app.use('/api/snapshots', snapshotRoutes);

  // Manual queue trigger (useful after server restart)
  app.post('/api/queue/process', (req, res) => {
    taskQueue.processQueue();
    res.json({ ok: true, message: 'Queue processing triggered' });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      wsClients: wsManager.getClientCount(),
    });
  });

  // Stats endpoint
  app.get('/api/stats', (req, res) => {
    const tasks = taskQueue.getTasks();
    res.json({
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t: any) => t.status === 'pending').length,
      runningTasks: tasks.filter((t: any) => t.status === 'running').length,
      completedTasks: tasks.filter((t: any) => t.status === 'completed').length,
      failedTasks: tasks.filter((t: any) => t.status === 'failed').length,
    });
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket
  wsManager.initialize(server);

  // Start server
  server.listen(PORT, () => {
    console.log(`[Server] Agent OS Control Plane running on port ${PORT}`);
    console.log(`[Server] Dashboard: http://localhost:${PORT}`);
    console.log(`[Server] Chat UI:   http://localhost:${PORT}/chat.html`);
    console.log(`[Server] WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`[Server] API: http://localhost:${PORT}/api`);
    console.log('================================================');

    // On startup: reset orphaned "running" tasks back to pending
    setTimeout(() => {
      const running = taskQueue.getTasks('running');
      if (running.length > 0) {
        console.log(`[Server] Resetting ${running.length} orphaned running task(s) to pending`);
        for (const t of running) {
          taskQueue.updateTaskStatus(t.id, 'pending');
        }
      }
      // Then process queue for pending tasks
      const pending = taskQueue.getTasks('pending');
      if (pending.length > 0) {
        console.log(`[Server] Processing ${pending.length} pending task(s)`);
        taskQueue.processQueue();
      }
    }, 3000); // wait 3s for workers to reconnect WebSocket
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] Shutting down...');
    server.close(() => {
      console.log('[Server] Closed');
      process.exit(0);
    });
  });
}

main().catch(console.error);
