// ============================================================
// Agent OS - Control Plane - Worker Routes
// ============================================================

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { workerDb, workerDb as workerDbImport } from '../services/database';
import { wsManager } from '../services/wsManager';
import { HEARTBEAT_INTERVAL_MS } from '../types';

const router = Router();

// Get all workers
router.get('/', (req: Request, res: Response) => {
  const workers = workerDb.findAll().map((w: any) => formatWorker(w));
  res.json({ workers });
});

// Get worker by ID
router.get('/:id', (req: Request, res: Response) => {
  const worker = workerDb.findById(req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }
  res.json({ worker: formatWorker(worker) });
});

// Register new worker
router.post('/register', (req: Request, res: Response) => {
  const { name, hostname, tailscaleIp } = req.body;

  if (!name || !hostname || !tailscaleIp) {
    return res.status(400).json({ error: 'name, hostname, and tailscaleIp are required' });
  }

  // Generate worker token
  const token = crypto.randomBytes(32).toString('hex');
  const id = uuidv4();

  const worker = {
    id,
    name,
    hostname,
    tailscaleIp,
    status: 'online',
    token,
    registeredAt: new Date().toISOString(),
  };

  workerDb.insert(worker);

  console.log(`[Worker] Registered: ${name} (${tailscaleIp})`);
  wsManager.broadcast({ type: 'worker_registered', worker: formatWorker(worker) });

  res.status(201).json({
    worker: formatWorker(worker),
    config: {
      id,
      token,
      controlUrl: process.env.CONTROL_URL || `http://localhost:3700`,
      heartbeatInterval: HEARTBEAT_INTERVAL_MS,
    },
  });
});

// Worker heartbeat
router.post('/:id/heartbeat', (req: Request, res: Response) => {
  const worker = workerDb.findById(req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  // Validate token
  const token = req.headers['x-worker-token'] as string;
  if (worker.token !== token) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { status, systemInfo, currentTaskId } = req.body;

  workerDb.updateHeartbeat(
    req.params.id,
    status || 'online',
    JSON.stringify(systemInfo || {}),
    currentTaskId
  );

  wsManager.broadcastWorkerUpdate(req.params.id, {
    status: status || 'online',
    systemInfo,
    currentTaskId,
    lastHeartbeat: new Date().toISOString(),
  });

  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Delete worker
router.delete('/:id', (req: Request, res: Response) => {
  const worker = workerDb.findById(req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  workerDb.delete(req.params.id);
  console.log(`[Worker] Deleted: ${worker.name}`);
  wsManager.broadcast({ type: 'worker_removed', workerId: req.params.id });

  res.json({ success: true });
});

function formatWorker(w: any) {
  return {
    id: w.id,
    name: w.name,
    hostname: w.hostname,
    tailscaleIp: w.tailscale_ip,
    status: w.status,
    token: w.token,
    registeredAt: w.registered_at,
    lastHeartbeat: w.last_heartbeat,
    systemInfo: w.system_info ? JSON.parse(w.system_info) : null,
    currentTaskId: w.current_task_id,
  };
}

export default router;
