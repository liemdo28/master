"use strict";
// ============================================================
// Agent OS - Control Plane - Task Queue Service
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueue = void 0;
const uuid_1 = require("uuid");
const database_1 = require("./database");
const wsManager_1 = require("./wsManager");
const types_1 = require("../types");
const approvalEngine_1 = require("./approvalEngine");
const journal_1 = require("./journal");
const snapshotService_1 = require("./snapshotService");
class TaskQueue {
    processing = false;
    // Create a new task
    createTask(params) {
        const risk = (0, approvalEngine_1.assessTaskRisk)({ type: params.type, payload: params.payload });
        const status = params.initialStatus ?? (risk.approvalRequired ? types_1.TaskStatus.WAITING_APPROVAL : types_1.TaskStatus.PENDING);
        const task = {
            id: (0, uuid_1.v4)(),
            type: params.type,
            status,
            priority: params.priority || types_1.TaskPriority.MEDIUM,
            project: params.project,
            createdBy: params.createdBy || 'ceo',
            payload: JSON.stringify(params.payload || {}),
            createdAt: new Date().toISOString(),
        };
        database_1.taskDb.insert(task);
        const formattedTask = this.formatTask(task);
        console.log(`[Queue] Task created: ${task.id} (${task.type}) for ${task.project} [${status}]`);
        const approval = (0, approvalEngine_1.createApproval)(task.id, risk.riskLevel, task.createdBy);
        (0, journal_1.writeJournalEvent)({
            type: 'task_created',
            taskId: task.id,
            project: task.project,
            actor: task.createdBy,
            risk: risk.riskLevel,
            data: { task: formattedTask, approval, riskReasons: risk.reasons },
        });
        this.addLog(task.id, 'info', 'Task created', { risk });
        wsManager_1.wsManager.broadcast({ type: 'task_created', task: formattedTask, approval, risk });
        // Only queue immediately if not waiting for approval
        if (status === types_1.TaskStatus.PENDING) {
            this.processQueue();
        }
        return formattedTask;
    }
    // Update task status (used by chat/approval flow)
    updateTaskStatus(taskId, status, error) {
        const updates = { status };
        if (error)
            updates.error = error;
        if (status === 'cancelled' || status === 'failed' || status === 'completed') {
            updates.completedAt = new Date().toISOString();
        }
        database_1.taskDb.update(taskId, updates);
        (0, journal_1.writeJournalEvent)({ type: `task_${status}`, taskId, actor: 'agent-os', data: { error } });
        wsManager_1.wsManager.broadcastTaskUpdate(taskId, { status, error });
        if (status === 'pending') {
            this.processQueue();
        }
    }
    // Approve a waiting_approval task — move to pending
    approveTask(taskId) {
        this.updateTaskStatus(taskId, 'pending');
        console.log(`[Queue] Task ${taskId} approved → pending`);
    }
    // Get next pending task and assign to available worker
    processQueue() {
        if (this.processing)
            return;
        this.processing = true;
        try {
            // Find available workers (online and not busy)
            const workers = database_1.workerDb.findAll().filter((w) => w.status === 'online');
            if (workers.length === 0) {
                console.log('[Queue] No workers available');
                return;
            }
            // Get pending tasks ordered by priority
            const pendingTasks = database_1.taskDb.findPending();
            if (pendingTasks.length === 0) {
                return;
            }
            // Assign tasks to workers
            for (let i = 0; i < Math.min(pendingTasks.length, workers.length); i++) {
                const task = pendingTasks[i];
                const worker = workers[i];
                database_1.taskDb.assignToWorker(task.id, worker.id);
                database_1.workerDb.updateStatus(worker.id, 'busy', task.id);
                console.log(`[Queue] Task ${task.id} assigned to worker ${worker.id}`);
                const formattedTask = this.formatTask(database_1.taskDb.findById(task.id));
                wsManager_1.wsManager.broadcast({
                    type: 'task_assign',
                    workerId: worker.id,
                    task: formattedTask,
                    timestamp: new Date().toISOString(),
                });
                wsManager_1.wsManager.broadcastTaskUpdate(task.id, { status: 'running', workerId: worker.id });
                wsManager_1.wsManager.broadcastWorkerUpdate(worker.id, { status: 'busy', currentTaskId: task.id });
                (0, journal_1.writeJournalEvent)({ type: 'task_started', taskId: task.id, project: task.project, actor: worker.id });
            }
        }
        finally {
            this.processing = false;
        }
    }
    // Cancel a task
    cancelTask(taskId) {
        const task = database_1.taskDb.findById(taskId);
        if (!task)
            return false;
        if (task.status === 'completed' || task.status === 'cancelled') {
            return false;
        }
        database_1.taskDb.updateStatus(taskId, 'cancelled');
        // If worker was assigned, free it
        if (task.worker_id) {
            database_1.workerDb.updateStatus(task.worker_id, 'online');
        }
        console.log(`[Queue] Task ${taskId} cancelled`);
        (0, journal_1.writeJournalEvent)({ type: 'task_cancelled', taskId, project: task.project, actor: 'agent-os' });
        wsManager_1.wsManager.broadcastTaskUpdate(taskId, { status: 'cancelled' });
        return true;
    }
    // Retry a failed task
    retryTask(taskId) {
        const task = database_1.taskDb.findById(taskId);
        if (!task)
            return null;
        if (task.status !== 'failed') {
            return null;
        }
        database_1.taskDb.update(taskId, { status: 'pending', error: null, started_at: null, completed_at: null, worker_id: null });
        console.log(`[Queue] Task ${taskId} queued for retry`);
        wsManager_1.wsManager.broadcastTaskUpdate(taskId, { status: 'pending' });
        this.processQueue();
        return this.formatTask(database_1.taskDb.findById(taskId));
    }
    // Complete a task (called by worker)
    completeTask(taskId, success, error, payload) {
        const task = database_1.taskDb.findById(taskId);
        if (!task)
            return;
        database_1.taskDb.updateStatus(taskId, success ? 'completed' : 'failed', error);
        // Free the worker
        if (task.worker_id) {
            database_1.workerDb.updateStatus(task.worker_id, 'online');
        }
        console.log(`[Queue] Task ${taskId} ${success ? 'completed' : 'failed'}`);
        wsManager_1.wsManager.broadcastTaskUpdate(taskId, { status: success ? 'completed' : 'failed', error, payload });
        (0, journal_1.writeJournalEvent)({
            type: success ? 'task_completed' : 'task_failed',
            taskId,
            project: task.project,
            actor: task.worker_id || 'worker',
            data: { error },
        });
        (0, journal_1.writeAiMemoryEntry)({
            taskId,
            project: task.project,
            technicalReason: `Agent OS executed ${task.type} task through worker ${task.worker_id || 'unknown'}.`,
            risk: success ? 'Task completed; review artifacts before release.' : `Task failed: ${error || 'unknown error'}`,
            qaCoverage: task.type === 'qa' ? 'QA task executed.' : 'Run QA Platform before release.',
        });
        if (success && ['build', 'qa', 'script', 'cline'].includes(task.type)) {
            try {
                const snapshot = (0, snapshotService_1.createMasterSnapshot)(`task ${task.type} completed`, taskId);
                this.addLog(taskId, 'info', 'Master snapshot created', snapshot);
            }
            catch (snapshotError) {
                this.addLog(taskId, 'warn', 'Master snapshot failed', { error: snapshotError.message });
            }
        }
        // Process queue for next tasks
        this.processQueue();
    }
    // Get task by ID
    getTask(taskId) {
        return this.formatTask(database_1.taskDb.findById(taskId));
    }
    // Get all tasks
    getTasks(status) {
        return database_1.taskDb.findAll(status).map((t) => this.formatTask(t));
    }
    // Format task for API response
    formatTask(task) {
        if (!task)
            return null;
        return {
            id: task.id,
            type: task.type,
            status: task.status,
            priority: task.priority,
            project: task.project,
            createdBy: task.created_by,
            workerId: task.worker_id,
            payload: JSON.parse(task.payload || '{}'),
            createdAt: task.created_at,
            startedAt: task.started_at,
            completedAt: task.completed_at,
            error: task.error,
            resultPayload: task.result_payload ? JSON.parse(task.result_payload) : null,
        };
    }
    // Add log entry
    addLog(taskId, level, message, data) {
        const log = {
            id: (0, uuid_1.v4)(),
            taskId,
            timestamp: new Date().toISOString(),
            level,
            message,
            data: data ? JSON.stringify(data) : undefined,
        };
        database_1.taskLogDb.insert(log);
        wsManager_1.wsManager.broadcastLog(taskId, log);
    }
}
exports.taskQueue = new TaskQueue();
//# sourceMappingURL=taskQueue.js.map