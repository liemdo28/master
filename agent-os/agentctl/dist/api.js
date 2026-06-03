"use strict";
// ============================================================
// agentctl — API Client
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentctlApi = void 0;
const axios_1 = __importDefault(require("axios"));
const ws_1 = __importDefault(require("ws"));
class AgentctlApi {
    constructor(config) {
        this.ws = null;
        this.workerToken = null;
        this.config = config;
        this.client = axios_1.default.create({
            baseURL: config.controlUrl,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
        });
        // Derive WS URL from HTTP URL
        const url = new URL(config.controlUrl);
        this.wsUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws`;
    }
    // ── Workers ─────────────────────────────────────────────────────────────
    async listWorkers() {
        const res = await this.client.get('/api/workers');
        return res.data.workers;
    }
    async getWorker(nameOrId) {
        try {
            const workers = await this.listWorkers();
            return workers.find(w => w.name === nameOrId || w.id === nameOrId || w.hostname === nameOrId) || null;
        }
        catch {
            return null;
        }
    }
    // ── Ping ────────────────────────────────────────────────────────────────
    async ping(workerName) {
        const target = workerName || this.config.workerName;
        const t0 = Date.now();
        // Create a WS connection dedicated to the ping
        return new Promise((resolve, reject) => {
            const ws = new ws_1.default(this.wsUrl);
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
                }
                catch { /* ignore */ }
            });
            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    // ── Tasks ───────────────────────────────────────────────────────────────
    async createTask(params) {
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
    async listTasks(status, limit = 50) {
        const params = { limit };
        if (status)
            params.status = status;
        const res = await this.client.get('/api/tasks', { params });
        return res.data.tasks;
    }
    async getTask(taskId) {
        const res = await this.client.get(`/api/tasks/${taskId}`);
        return res.data.task;
    }
    async cancelTask(taskId) {
        await this.client.post(`/api/tasks/${taskId}/cancel`);
    }
    async getTaskLogs(taskId) {
        const res = await this.client.get(`/api/tasks/${taskId}/logs`);
        return res.data.logs;
    }
    async getTaskLogsStream(taskId, onLog) {
        return new Promise((resolve) => {
            this.ws = new ws_1.default(this.wsUrl);
            this.ws.on('open', () => {
                this.ws.send(JSON.stringify({ type: 'subscribe', taskId }));
            });
            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'log' && msg.taskId === taskId) {
                        onLog(msg.log);
                    }
                }
                catch { /* ignore */ }
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
    async exec(params) {
        const { command, args = [], workerName, timeoutSec = 60, stream = true } = params;
        // Build the task payload
        const payload = {
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
    async shell(command, workerName, timeoutSec = 60) {
        return this.exec({ command: 'shell', args: [command], workerName, timeoutSec, stream: false });
    }
    // ── Audit ───────────────────────────────────────────────────────────────
    async audit(projectPath, workerName) {
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
                const summaryLog = logs.find((l) => l.message.includes('summary'));
                const reportPathLog = logs.find((l) => l.message.includes('report_path'));
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
    async startService(serviceName, workerName) {
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
                    lastLines: logs.slice(-20).map((l) => l.message),
                    ...(lastLog?.data || {}),
                };
            }
            await new Promise(r => setTimeout(r, 500));
        }
        return { name: serviceName, state: 'unknown' };
    }
    async stopService(serviceName, workerName) {
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
    async serviceStatus(serviceName, workerName) {
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
                        lastLines: logs.slice(-20).map((l) => l.message),
                        ...(logs[logs.length - 1]?.data || {}),
                    };
                }
                await new Promise(r => setTimeout(r, 500));
            }
        }
        catch { /* fall through */ }
        return { name: serviceName, state: 'unknown' };
    }
    // ── Config ─────────────────────────────────────────────────────────────
    async configure(controlUrl, workerName) {
        const { saveConfig } = await Promise.resolve().then(() => __importStar(require('./config')));
        saveConfig({ controlUrl, workerName });
    }
}
exports.AgentctlApi = AgentctlApi;
