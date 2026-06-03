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
export declare class AgentctlApi {
    private client;
    private ws;
    private wsUrl;
    private config;
    private workerToken;
    constructor(config: AgentctlConfig);
    listWorkers(): Promise<Worker[]>;
    getWorker(nameOrId: string): Promise<Worker | null>;
    ping(workerName?: string): Promise<PingResult>;
    createTask(params: {
        type: string;
        project: string;
        payload?: any;
        priority?: string;
        workerName?: string;
    }): Promise<Task>;
    listTasks(status?: string, limit?: number): Promise<Task[]>;
    getTask(taskId: string): Promise<Task>;
    cancelTask(taskId: string): Promise<void>;
    getTaskLogs(taskId: string): Promise<TaskLog[]>;
    getTaskLogsStream(taskId: string, onLog: (log: TaskLog) => void): Promise<() => void>;
    exec(params: {
        command: string;
        args?: string[];
        workerName?: string;
        timeoutSec?: number;
        stream?: boolean;
    }): Promise<ExecResult>;
    shell(command: string, workerName?: string, timeoutSec?: number): Promise<ExecResult>;
    audit(projectPath: string, workerName?: string): Promise<{
        taskId: string;
        summary: string;
        reportPath?: string;
    }>;
    startService(serviceName: string, workerName?: string): Promise<ServiceStatus>;
    stopService(serviceName: string, workerName?: string): Promise<ServiceStatus>;
    serviceStatus(serviceName: string, workerName?: string): Promise<ServiceStatus>;
    configure(controlUrl: string, workerName: string): Promise<void>;
}
