// ============================================================
// agentctl — API Client
// ============================================================

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { AgentctlConfig } from './config';

export interface Worker {
  id: string;
  name: string;
  hostname: string;
  tailscaleIp?: string;
  status: string;
  registeredAt: string;
  lastHeartbeat?: string;
  systemInfo?: any;
  currentTaskId?: string;
}

export interface Task {
  id: string;
  type: string;
  status: string;
  priority: string;
  project: string;
  createdBy: string;
  workerId?: string;
  payload: any;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface TaskLog {
  id: string;
  taskId: string;
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

export interface PingResult {
  worker: string;
  latencyMs: number;
  status: string;
  version?: string;
  hostname?: string;
}

export interface ExecResult {
  taskId: string;
  status: string;
  exitCode?: number;
  durationMs?: number;
  output?: string;
  error?: string;
}

export interface ServiceStatus {
  name: string;
  state: 'running' | 'stopped' | 'unknown';
  pid?: number;
  uptimeSec?: number;
  port?: number;
  lastLines?: string[];
}

export class AgentctlApi {
  private client: AxiosInstance;
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private config: AgentctlConfig;
  private workerToken: string | null = null;

  constructor(config: AgentctlConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.controlUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    // Derive WS URL from HTTP URL
    const url = new URL(config.controlUrl);
    this.wsUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws`;
  }

  // ── Workers ─────────────────────────────────────────────────────────────

  async listWorkers(): Promise<Worker[]> {
    const res = await this.client.get('/api/workers');
    return res.data.workers;
  }

  async getWorker(nameOrId: string): Promise<Worker | null> {
    try {
      const workers = await this.listWorkers();
      return workers.find(w =>
        w.name === nameOrId || w.id === nameOrId || w.hostname === nameOrId
      ) || null;
    } catch {
      return null;
    }
  }

  // ── Ping ────────────────────────────────────────────────────────────────

  async ping(workerName?: string): Promise<PingResult> {
    const target = workerName || this.config.workerName;
    const t0 = Date.now();

    // Create a WS connection dedicated to the ping
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Ping timeout'));
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'ping',
          workerName: target,
          ts: new Date().toISOString(),
        }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'pong') {
            clearTimeout(timeout);
            ws.close();
            resolve({
              worker: msg.workerName || target,
              latencyMs: Date.now() - t0,
              status: 'online',
              version: msg.version,
              hostname: msg.hostname,
            });
          }
        } catch { /* ignore */ }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  // ── Tasks ───────────────────────────────────────────────────────────────

  async createTask(params: {
    type: string;
    project: string;
    payload?: any;
    priority?: string;
    workerName?: string;
  }): Promise<Task> {
    const res = await this.client.post('/api/tasks', {
      type: params.type,
      project: params.project,
      payload: {
        ...params.payload,
        _targetWorker: params.workerName,
      },
      priority: params.priority || 'medium',
    });
    return res.data.task;
  }

  async listTasks(status?: string, limit = 50): Promise<Task[]> {
    const params: any = { limit };
    if (status) params.status = status;
    const res = await this.client.get('/api/tasks', { params });
    return res.data.tasks;
  }

  async getTask(taskId: string): Promise<Task> {
    const res = await this.client.get(`/api/tasks/${taskId}`);
    return res.data.task;
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.client.post(`/api/tasks/${taskId}/cancel`);
  }

  async getTaskLogs(taskId: string): Promise<TaskLog[]> {
    const res = await this.client.get(`/api/tasks/${taskId}/logs`);
    return res.data.logs;
  }

  async getTaskLogsStream(taskId: string, onLog: (log: TaskLog) => void): Promise<() => void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.ws!.send(JSON.stringify({ type: 'subscribe', taskId }));
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'log' && msg.taskId === taskId) {
            onLog(msg.log);
          }
        } catch { /* ignore */ }
      });

      const cleanup = () => {
        if (this.ws) {
          this.ws.send(JSON.stringify({ type: 'unsubscribe', taskId }));
          this.ws.close();
          this.ws = null;
        }
      };

      resolve(cleanup);
    });
  }

  // ── Exec ───────────────────────────────────────────────────────────────

  async exec(params: {
    command: string;
    args?: string[];
    workerName?: string;
    timeoutSec?: number;
    stream?: boolean;
  }): Promise<ExecResult> {
    const { command, args = [], workerName, timeoutSec = 60, stream = true } = params;

    // Build the task payload
    const payload: any = {
      command,
      args,
      timeoutSec,
      stream,
    };

    // Create task with the appropriate type
    const taskType = command;
    const task = await this.createTask({
      type: taskType,
      project: 'agent-ctl',
      payload,
      workerName,
    });

    // Wait for task to complete (or timeout)
    const deadline = Date.now() + timeoutSec * 1000;
    while (Date.now() < deadline) {
      const updated = await this.getTask(task.id);
      if (updated.status === 'completed') {
        const logs = await this.getTaskLogs(task.id);
        const output = logs.map(l => `[${l.level}] ${l.message}`).join('\n');
        return {
          taskId: task.id,
          status: 'ok',
          output,
          durationMs: updated.completedAt && updated.startedAt
            ? new Date(updated.completedAt).getTime() - new Date(updated.startedAt).getTime()
            : undefined,
        };
      }
      if (updated.status === 'failed') {
        return {
          taskId: task.id,
          status: 'error',
          error: updated.error || 'Task failed',
        };
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // Timeout
    await this.cancelTask(task.id);
    return {
      taskId: task.id,
      status: 'timeout',
      error: `Task timed out after ${timeoutSec}s`,
    };
  }

  // ── Shell ───────────────────────────────────────────────────────────────

  async shell(command: string, workerName?: string, timeoutSec = 60): Promise<ExecResult> {
    return this.exec({ command: 'shell', args: [command], workerName, timeoutSec, stream: false });
  }

  // ── Audit ───────────────────────────────────────────────────────────────

  async audit(projectPath: string, workerName?: string): Promise<{ taskId: string; summary: string; reportPath?: string }> {
    const task = await this.createTask({
      type: 'audit',
      project: projectPath,
      payload: { path: projectPath },
      workerName,
    });

    // Poll for completion (max 5 min per brief)
    const deadline = Date.now() + 300 * 1000;
    while (Date.now() < deadline) {
      const updated = await this.getTask(task.id);
      if (updated.status === 'completed') {
        const logs = await this.getTaskLogs(task.id);
        const summaryLog = logs.find((l: TaskLog) => l.message.includes('summary'));
        const reportPathLog = logs.find((l: TaskLog) => l.message.includes('report_path'));
        return {
          taskId: task.id,
          summary: summaryLog?.message || logs[logs.length - 1]?.message || 'Audit complete',
          reportPath: reportPathLog?.data?.reportPath,
        };
      }
      if (updated.status === 'failed') {
        throw new Error(updated.error || 'Audit failed');
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Audit timed out after 5 minutes');
  }

  // ── Services ────────────────────────────────────────────────────────────

  async startService(serviceName: string, workerName?: string): Promise<ServiceStatus> {
    const task = await this.createTask({
      type: 'start-service',
      project: 'agent-ctl',
      payload: { serviceName },
      workerName,
    });

    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const updated = await this.getTask(task.id);
      if (updated.status === 'completed' || updated.status === 'failed') {
        const logs = await this.getTaskLogs(task.id);
        const lastLog = logs[logs.length - 1];
        return {
          name: serviceName,
          state: updated.status === 'completed' ? 'running' : 'stopped',
          lastLines: logs.slice(-20).map((l: TaskLog) => l.message),
          ...(lastLog?.data || {}),
        };
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return { name: serviceName, state: 'unknown' };
  }

  async stopService(serviceName: string, workerName?: string): Promise<ServiceStatus> {
    const task = await this.createTask({
      type: 'stop-service',
      project: 'agent-ctl',
      payload: { serviceName },
      workerName,
    });
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const updated = await this.getTask(task.id);
      if (updated.status === 'completed') {
        return { name: serviceName, state: 'stopped' };
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return { name: serviceName, state: 'unknown' };
  }

  async serviceStatus(serviceName: string, workerName?: string): Promise<ServiceStatus> {
    try {
      const task = await this.createTask({
        type: 'status-service',
        project: 'agent-ctl',
        payload: { serviceName },
        workerName,
      });
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const updated = await this.getTask(task.id);
        if (updated.status === 'completed' || updated.status === 'failed') {
          const logs = await this.getTaskLogs(task.id);
          return {
            name: serviceName,
            state: updated.status === 'completed' ? 'running' : 'stopped',
            lastLines: logs.slice(-20).map((l: TaskLog) => l.message),
            ...(logs[logs.length - 1]?.data || {}),
          };
        }
        await new Promise(r => setTimeout(r, 500));
      }
    } catch { /* fall through */ }
    return { name: serviceName, state: 'unknown' };
  }

  // ── Config ─────────────────────────────────────────────────────────────

  async configure(controlUrl: string, workerName: string): Promise<void> {
    const { saveConfig } = await import('./config');
    saveConfig({ controlUrl, workerName });
  }
}
