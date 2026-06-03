"use strict";
// ============================================================
// Agent OS - Control Plane - Worker Routes
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../services/database");
const wsManager_1 = require("../services/wsManager");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Get all workers
router.get('/', (req, res) => {
    const workers = database_1.workerDb.findAll().map((w) => formatWorker(w));
    res.json({ workers });
});
// Get worker by ID
router.get('/:id', (req, res) => {
    const worker = database_1.workerDb.findById(req.params.id);
    if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
    }
    res.json({ worker: formatWorker(worker) });
});
// Register new worker
router.post('/register', (req, res) => {
    const { name, hostname, tailscaleIp } = req.body;
    if (!name || !hostname || !tailscaleIp) {
        return res.status(400).json({ error: 'name, hostname, and tailscaleIp are required' });
    }
    // Generate worker token
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const id = (0, uuid_1.v4)();
    const worker = {
        id,
        name,
        hostname,
        tailscaleIp,
        status: 'online',
        token,
        registeredAt: new Date().toISOString(),
    };
    database_1.workerDb.insert(worker);
    console.log(`[Worker] Registered: ${name} (${tailscaleIp})`);
    wsManager_1.wsManager.broadcast({ type: 'worker_registered', worker: formatWorker(worker) });
    res.status(201).json({
        worker: formatWorker(worker),
        config: {
            id,
            token,
            controlUrl: process.env.CONTROL_URL || `http://localhost:3700`,
            heartbeatInterval: types_1.HEARTBEAT_INTERVAL_MS,
        },
    });
});
// Worker heartbeat
router.post('/:id/heartbeat', (req, res) => {
    const worker = database_1.workerDb.findById(req.params.id);
    if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
    }
    // Validate token
    const token = req.headers['x-worker-token'];
    if (worker.token !== token) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    const { status, systemInfo, currentTaskId } = req.body;
    database_1.workerDb.updateHeartbeat(req.params.id, status || 'online', JSON.stringify(systemInfo || {}), currentTaskId);
    wsManager_1.wsManager.broadcastWorkerUpdate(req.params.id, {
        status: status || 'online',
        systemInfo,
        currentTaskId,
        lastHeartbeat: new Date().toISOString(),
    });
    res.json({ success: true, timestamp: new Date().toISOString() });
});
// Delete worker
router.delete('/:id', (req, res) => {
    const worker = database_1.workerDb.findById(req.params.id);
    if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
    }
    database_1.workerDb.delete(req.params.id);
    console.log(`[Worker] Deleted: ${worker.name}`);
    wsManager_1.wsManager.broadcast({ type: 'worker_removed', workerId: req.params.id });
    res.json({ success: true });
});
function formatWorker(w) {
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
exports.default = router;
//# sourceMappingURL=workers.js.map