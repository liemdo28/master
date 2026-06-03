"use strict";
// ============================================================
// Agent OS - Control Plane - Task Routes
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskQueue_1 = require("../services/taskQueue");
const database_1 = require("../services/database");
const types_1 = require("../types");
const journal_1 = require("../services/journal");
const router = (0, express_1.Router)();
// Get all tasks
router.get('/', (req, res) => {
    const { status } = req.query;
    const tasks = taskQueue_1.taskQueue.getTasks(status);
    res.json({ tasks });
});
// Get task by ID
router.get('/:id', (req, res) => {
    const task = taskQueue_1.taskQueue.getTask(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ task });
});
// Create new task
router.post('/', (req, res) => {
    const { type, project, priority, payload } = req.body;
    if (!type || !project) {
        return res.status(400).json({ error: 'type and project are required' });
    }
    const validTypes = Object.values(types_1.TaskType);
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }
    const task = taskQueue_1.taskQueue.createTask({
        type,
        project,
        priority: priority || types_1.TaskPriority.MEDIUM,
        payload,
        createdBy: req.headers['x-user-id'] || 'ceo',
    });
    res.status(201).json({ task });
});
// Cancel task
router.post('/:id/cancel', (req, res) => {
    const success = taskQueue_1.taskQueue.cancelTask(req.params.id);
    if (!success) {
        return res.status(400).json({ error: 'Cannot cancel task' });
    }
    res.json({ success: true });
});
// Retry task
router.post('/:id/retry', (req, res) => {
    const task = taskQueue_1.taskQueue.retryTask(req.params.id);
    if (!task) {
        return res.status(400).json({ error: 'Cannot retry task' });
    }
    res.json({ task });
});
// Worker progress update
router.post('/:id/progress', (req, res) => {
    const task = database_1.taskDb.findById(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    if (task.worker_id) {
        const worker = database_1.workerDb.findById(task.worker_id);
        const token = req.headers['x-worker-token'];
        if (!worker || worker.token !== token) {
            return res.status(401).json({ error: 'Invalid worker token' });
        }
    }
    taskQueue_1.taskQueue.addLog(req.params.id, 'info', req.body.message || 'Progress update', {
        progress: req.body.progress,
    });
    (0, journal_1.writeJournalEvent)({ type: 'task_progress', taskId: req.params.id, project: task.project, data: req.body });
    res.json({ success: true });
});
// Worker completion callback
router.post('/:id/complete', (req, res) => {
    const task = database_1.taskDb.findById(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    if (task.worker_id) {
        const worker = database_1.workerDb.findById(task.worker_id);
        const token = req.headers['x-worker-token'];
        if (!worker || worker.token !== token) {
            return res.status(401).json({ error: 'Invalid worker token' });
        }
    }
    for (const log of req.body.logs || []) {
        taskQueue_1.taskQueue.addLog(req.params.id, log.level || 'info', log.message || '', log.data);
    }
    const payload = req.body.payload ?? null;
    if (payload !== null) {
        database_1.taskDb.setResultPayload(req.params.id, payload);
    }
    taskQueue_1.taskQueue.completeTask(req.params.id, Boolean(req.body.success), req.body.error, payload);
    res.json({ success: true });
});
// Get task logs
router.get('/:id/logs', (req, res) => {
    const task = database_1.taskDb.findById(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    const logs = database_1.taskLogDb.findByTaskId(req.params.id);
    res.json({ logs: logs.map((l) => ({
            id: l.id,
            taskId: l.task_id,
            timestamp: l.timestamp,
            level: l.level,
            message: l.message,
            data: l.data ? JSON.parse(l.data) : null,
        })) });
});
// Get task artifacts
router.get('/:id/artifacts', (req, res) => {
    const task = database_1.taskDb.findById(req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    const artifacts = database_1.artifactDb.findByTaskId(req.params.id);
    res.json({ artifacts });
});
exports.default = router;
//# sourceMappingURL=tasks.js.map