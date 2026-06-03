// ============================================================
// Agent OS - Control Plane - Task Queue Service
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { taskDb, taskLogDb, workerDb } from './database';
import { wsManager } from './wsManager';
import { TaskType, TaskPriority, TaskStatus } from '../types';
import { assessTaskRisk, createApproval } from './approvalEngine';
import { writeAiMemoryEntry, writeJournalEvent } from './journal';
import { createMasterSnapshot } from './snapshotService';

class TaskQueue {
  private processing = false;

  // Create a new task
  createTask(params: {
    type: TaskType;
    project: string;
    priority?: TaskPriority;
    createdBy?: string;
    payload?: Record<string, any>;
    initialStatus?: TaskStatus;
  }): any {
    const risk = assessTaskRisk({ type: params.type, payload: params.payload });
    const status = params.initialStatus ?? (risk.approvalRequired ? TaskStatus.WAITING_APPROVAL : TaskStatus.PENDING);
    const task = {
      id: uuidv4(),
      type: params.type,
      status,
      priority: params.priority || TaskPriority.MEDIUM,
      project: params.project,
      createdBy: params.createdBy || 'ceo',
      payload: JSON.stringify(params.payload || {}),
      createdAt: new Date().toISOString(),
    };

    taskDb.insert(task);
    const formattedTask = this.formatTask(task);
    console.log(`[Queue] Task created: ${task.id} (${task.type}) for ${task.project} [${status}]`);

    const approval = createApproval(task.id, risk.riskLevel, task.createdBy);
    writeJournalEvent({
      type: 'task_created',
      taskId: task.id,
      project: task.project,
      actor: task.createdBy,
      risk: risk.riskLevel,
      data: { task: formattedTask, approval, riskReasons: risk.reasons },
    });
    this.addLog(task.id, 'info', 'Task created', { risk });

    wsManager.broadcast({ type: 'task_created', task: formattedTask, approval, risk });

    // Only queue immediately if not waiting for approval
    if (status === TaskStatus.PENDING) {
      this.processQueue();
    }

    return formattedTask;
  }

  // Update task status (used by chat/approval flow)
  updateTaskStatus(taskId: string, status: string, error?: string): void {
    const updates: Record<string, any> = { status };
    if (error) updates.error = error;
    if (status === 'cancelled' || status === 'failed' || status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    taskDb.update(taskId, updates);
    writeJournalEvent({ type: `task_${status}`, taskId, actor: 'agent-os', data: { error } });
    wsManager.broadcastTaskUpdate(taskId, { status, error });
    if (status === 'pending') {
      this.processQueue();
    }
  }

  // Approve a waiting_approval task — move to pending
  approveTask(taskId: string): void {
    this.updateTaskStatus(taskId, 'pending');
    console.log(`[Queue] Task ${taskId} approved → pending`);
  }

  // Get next pending task and assign to available worker
  processQueue(): void {
    if (this.processing) return;
    this.processing = true;

    try {
      // Find available workers (online and not busy)
      const workers = workerDb.findAll().filter((w: any) => w.status === 'online');
      
      if (workers.length === 0) {
        console.log('[Queue] No workers available');
        return;
      }

      // Get pending tasks ordered by priority
      const pendingTasks = taskDb.findPending();
      
      if (pendingTasks.length === 0) {
        return;
      }

      // Assign tasks to workers
      for (let i = 0; i < Math.min(pendingTasks.length, workers.length); i++) {
        const task = pendingTasks[i];
        const worker = workers[i];

        taskDb.assignToWorker(task.id, worker.id);
        workerDb.updateStatus(worker.id, 'busy', task.id);

        console.log(`[Queue] Task ${task.id} assigned to worker ${worker.id}`);

        const formattedTask = this.formatTask(taskDb.findById(task.id));
        wsManager.broadcast({
          type: 'task_assign',
          workerId: worker.id,
          task: formattedTask,
          timestamp: new Date().toISOString(),
        });
        wsManager.broadcastTaskUpdate(task.id, { status: 'running', workerId: worker.id });
        wsManager.broadcastWorkerUpdate(worker.id, { status: 'busy', currentTaskId: task.id });
        writeJournalEvent({ type: 'task_started', taskId: task.id, project: task.project, actor: worker.id });
      }
    } finally {
      this.processing = false;
    }
  }

  // Cancel a task
  cancelTask(taskId: string): boolean {
    const task = taskDb.findById(taskId);
    if (!task) return false;

    if (task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }

    taskDb.updateStatus(taskId, 'cancelled');
    
    // If worker was assigned, free it
    if (task.worker_id) {
      workerDb.updateStatus(task.worker_id, 'online');
    }

    console.log(`[Queue] Task ${taskId} cancelled`);
    writeJournalEvent({ type: 'task_cancelled', taskId, project: task.project, actor: 'agent-os' });
    wsManager.broadcastTaskUpdate(taskId, { status: 'cancelled' });

    return true;
  }

  // Retry a failed task
  retryTask(taskId: string): any | null {
    const task = taskDb.findById(taskId);
    if (!task) return null;

    if (task.status !== 'failed') {
      return null;
    }

    taskDb.update(taskId, { status: 'pending', error: null, started_at: null, completed_at: null, worker_id: null });
    
    console.log(`[Queue] Task ${taskId} queued for retry`);
    wsManager.broadcastTaskUpdate(taskId, { status: 'pending' });

    this.processQueue();
    return this.formatTask(taskDb.findById(taskId));
  }

  // Complete a task (called by worker)
  completeTask(taskId: string, success: boolean, error?: string, payload?: any): void {
    const task = taskDb.findById(taskId);
    if (!task) return;

    taskDb.updateStatus(taskId, success ? 'completed' : 'failed', error);

    // Free the worker
    if (task.worker_id) {
      workerDb.updateStatus(task.worker_id, 'online');
    }

    console.log(`[Queue] Task ${taskId} ${success ? 'completed' : 'failed'}`);
    wsManager.broadcastTaskUpdate(taskId, { status: success ? 'completed' : 'failed', error, payload });
    writeJournalEvent({
      type: success ? 'task_completed' : 'task_failed',
      taskId,
      project: task.project,
      actor: task.worker_id || 'worker',
      data: { error },
    });
    writeAiMemoryEntry({
      taskId,
      project: task.project,
      technicalReason: `Agent OS executed ${task.type} task through worker ${task.worker_id || 'unknown'}.`,
      risk: success ? 'Task completed; review artifacts before release.' : `Task failed: ${error || 'unknown error'}`,
      qaCoverage: task.type === 'qa' ? 'QA task executed.' : 'Run QA Platform before release.',
    });

    if (success && ['build', 'qa', 'script', 'cline'].includes(task.type)) {
      try {
        const snapshot = createMasterSnapshot(`task ${task.type} completed`, taskId);
        this.addLog(taskId, 'info', 'Master snapshot created', snapshot);
      } catch (snapshotError: any) {
        this.addLog(taskId, 'warn', 'Master snapshot failed', { error: snapshotError.message });
      }
    }

    // Process queue for next tasks
    this.processQueue();
  }

  // Get task by ID
  getTask(taskId: string): any {
    return this.formatTask(taskDb.findById(taskId));
  }

  // Get all tasks
  getTasks(status?: string): any[] {
    return taskDb.findAll(status).map((t: any) => this.formatTask(t));
  }

  // Format task for API response
  private formatTask(task: any): any {
    if (!task) return null;
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
  addLog(taskId: string, level: string, message: string, data?: any): void {
    const log = {
      id: uuidv4(),
      taskId,
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data) : undefined,
    };
    taskLogDb.insert(log);
    wsManager.broadcastLog(taskId, log);
  }
}

export const taskQueue = new TaskQueue();
