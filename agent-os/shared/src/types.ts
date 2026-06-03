// ============================================================
// Agent OS - Shared Types
// ============================================================

// Task Status
export enum TaskStatus {
  PENDING = 'pending',
  WAITING_APPROVAL = 'waiting_approval',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Task Types
export enum TaskType {
  BUILD = 'build',
  QA = 'qa',
  GIT_SYNC = 'git_sync',
  AUDIT = 'audit',
  SCRIPT = 'script',
  CLINE = 'cline',
  DEPLOY = 'deploy',
  LAUNCH = 'launch',
  CLOUD = 'cloud',
}

// Chat message
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'ceo' | 'agent';
  content: string;
  task_id?: string;
  created_at: string;
}

// Parsed intent from CEO message
export interface ParsedIntent {
  action: 'build' | 'audit' | 'qa' | 'deploy' | 'cline' | 'git' | 'open' | 'cloud' | 'unknown';
  project: string;
  raw_text: string;
  confidence: number;
  worker_suggestion: string;
  approval_required: boolean;
  extracted_params: Record<string, string>;
}

// Task Priority
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Worker Status
export enum WorkerStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
  ERROR = 'error',
}

// Task Definition
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  createdBy: string;
  workerId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// Task Log Entry
export interface TaskLog {
  id: string;
  taskId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

// Task Artifact
export interface TaskArtifact {
  id: string;
  taskId: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

// Worker Definition
export interface Worker {
  id: string;
  name: string;
  hostname: string;
  tailscaleIp: string;
  status: WorkerStatus;
  token: string;
  registeredAt: string;
  lastHeartbeat?: string;
  systemInfo?: SystemInfo;
  currentTaskId?: string;
}

// System Info reported by worker
export interface SystemInfo {
  cpuUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  diskTotal: number;
  diskUsed: number;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptime: number;
}

// Heartbeat payload
export interface HeartbeatPayload {
  workerId: string;
  token: string;
  status: WorkerStatus;
  systemInfo: SystemInfo;
  currentTaskId?: string;
  timestamp: string;
}

// Project Discovery
export interface DiscoveredProject {
  id: string;
  name: string;
  path: string;
  language: string[];
  framework: string[];
  hasGit: boolean;
  hasDocker: boolean;
  hasNodeModules: boolean;
  packageManager?: string;
  lastModified: string;
}

// Create Task Request
export interface CreateTaskRequest {
  type: TaskType;
  project: string;
  priority?: TaskPriority;
  payload?: Record<string, unknown>;
}

// Worker Registration Request
export interface WorkerRegisterRequest {
  name: string;
  hostname: string;
  tailscaleIp: string;
  token: string;
}

// WebSocket Message Types
export enum WsMessageType {
  LOG = 'log',
  TASK_UPDATE = 'task_update',
  WORKER_UPDATE = 'worker_update',
  HEARTBEAT = 'heartbeat',
  TASK_ASSIGN = 'task_assign',
  TASK_RESULT = 'task_result',
}

export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
  timestamp: string;
}

// Execution record for audit
export interface Execution {
  id: string;
  taskId: string;
  workerId: string;
  command: string;
  exitCode?: number;
  startedAt: string;
  completedAt?: string;
  stdout?: string;
  stderr?: string;
}
