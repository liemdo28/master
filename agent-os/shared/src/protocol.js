"use strict";
// ============================================================
// Agent OS - Communication Protocol
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEADER_TASK_SIGNATURE = exports.HEADER_WORKER_TOKEN = exports.WORKER_TIMEOUT_MS = exports.HEARTBEAT_INTERVAL_MS = exports.DEFAULT_WORKER_PORT = exports.DEFAULT_CONTROL_PORT = exports.API_ROUTES = void 0;
// API Routes
exports.API_ROUTES = {
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
};
// Default ports
exports.DEFAULT_CONTROL_PORT = 3700;
exports.DEFAULT_WORKER_PORT = 3701;
exports.HEARTBEAT_INTERVAL_MS = 5000;
exports.WORKER_TIMEOUT_MS = 15000;
// HTTP Headers
exports.HEADER_WORKER_TOKEN = 'x-worker-token';
exports.HEADER_TASK_SIGNATURE = 'x-task-signature';
//# sourceMappingURL=protocol.js.map