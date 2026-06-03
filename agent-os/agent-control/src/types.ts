// Local control-plane task types. Kept inside src so the control build does not
// compile files outside rootDir.

export enum TaskStatus {
  PENDING = 'pending',
  WAITING_APPROVAL = 'waiting_approval',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

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
  // D2-D6 control plane commands
  PING = 'ping',
  SHELL = 'shell',
  OPEN_ANTIGRAVITY = 'open-antigravity',
  CLOSE_ANTIGRAVITY = 'close-antigravity',
  START_API_PROXY = 'start-api-proxy',
  STOP_API_PROXY = 'stop-api-proxy',
  STATUS_API_PROXY = 'status-api-proxy',
  CLINE_PROMPT = 'cline-prompt',
  RUN_SCRIPT = 'run-script',
  FETCH_FILE = 'fetch-file',
  START_SERVICE = 'start-service',
  STOP_SERVICE = 'stop-service',
  STATUS_SERVICE = 'status-service',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export const HEARTBEAT_INTERVAL_MS = 5000;
