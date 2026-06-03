// ============================================================
// Agent OS - Communication Protocol
// ============================================================

// API Routes
export const API_ROUTES = {
  // Tasks
  TASKS: '/api/tasks',
  TASK_BY_ID: '/api/tasks/:id',
  TASK_CANCEL: '/api/tasks/:id/cancel',
  TASK_RETRY: '/api/tasks/:id/retry',
  TASK_LOGS: '/api/tasks/:id/logs',
  TASK_ARTIFACTS: '/api/tasks/:id/artifacts',

  // Workers
  WORKERS: '/api/workers',
  WORKER_BY_ID: '/api/workers/:id',
  WORKER_REGISTER: '/api/workers/register',
  WORKER_HEARTBEAT: '/api/workers/:id/heartbeat',

  // Projects
  PROJECTS: '/api/projects',
  PROJECT_SCAN: '/api/projects/scan',

  // System
  HEALTH: '/api/health',
  STATS: '/api/stats',
} as const;

// Default ports
export const DEFAULT_CONTROL_PORT = 3700;
export const DEFAULT_WORKER_PORT = 3701;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const WORKER_TIMEOUT_MS = 15000;

// HTTP Headers
export const HEADER_WORKER_TOKEN = 'x-worker-token';
export const HEADER_TASK_SIGNATURE = 'x-task-signature';
