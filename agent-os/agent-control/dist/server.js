"use strict";
// ============================================================
// Agent OS - Control Plane - Main Server
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const path = __importStar(require("path"));
const database_1 = require("./services/database");
const approvalEngine_1 = require("./services/approvalEngine");
const wsManager_1 = require("./services/wsManager");
const taskQueue_1 = require("./services/taskQueue");
// Routes
const tasks_1 = __importDefault(require("./routes/tasks"));
const workers_1 = __importDefault(require("./routes/workers"));
const projects_1 = __importDefault(require("./routes/projects"));
const chat_1 = __importDefault(require("./routes/chat"));
const kill_1 = __importDefault(require("./routes/kill"));
const approvals_1 = __importDefault(require("./routes/approvals"));
const snapshots_1 = __importDefault(require("./routes/snapshots"));
const PORT = process.env.PORT || 3700;
async function main() {
    console.log('================================================');
    console.log('  Agent OS Control Plane - Starting...');
    console.log('================================================');
    // Initialize database
    (0, database_1.initDatabase)();
    // Create Express app
    const app = (0, express_1.default)();
    // Middleware
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Serve static files (dashboard)
    app.use(express_1.default.static(path.join(__dirname, '..', 'public')));
    // Initialize approval schema
    (0, approvalEngine_1.initApprovalSchema)();
    // API Routes
    app.use('/api/tasks', tasks_1.default);
    app.use('/api/workers', workers_1.default);
    app.use('/api/projects', projects_1.default);
    app.use('/api/chat', chat_1.default);
    app.use('/api/kill', kill_1.default);
    app.use('/api/approvals', approvals_1.default);
    app.use('/api/snapshots', snapshots_1.default);
    // Manual queue trigger (useful after server restart)
    app.post('/api/queue/process', (req, res) => {
        taskQueue_1.taskQueue.processQueue();
        res.json({ ok: true, message: 'Queue processing triggered' });
    });
    // Health check
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            wsClients: wsManager_1.wsManager.getClientCount(),
        });
    });
    // Stats endpoint
    app.get('/api/stats', (req, res) => {
        const tasks = taskQueue_1.taskQueue.getTasks();
        res.json({
            totalTasks: tasks.length,
            pendingTasks: tasks.filter((t) => t.status === 'pending').length,
            runningTasks: tasks.filter((t) => t.status === 'running').length,
            completedTasks: tasks.filter((t) => t.status === 'completed').length,
            failedTasks: tasks.filter((t) => t.status === 'failed').length,
        });
    });
    // Create HTTP server
    const server = http_1.default.createServer(app);
    // Initialize WebSocket
    wsManager_1.wsManager.initialize(server);
    // Start server
    server.listen(PORT, () => {
        console.log(`[Server] Agent OS Control Plane running on port ${PORT}`);
        console.log(`[Server] Dashboard: http://localhost:${PORT}`);
        console.log(`[Server] Chat UI:   http://localhost:${PORT}/chat.html`);
        console.log(`[Server] WebSocket: ws://localhost:${PORT}/ws`);
        console.log(`[Server] API: http://localhost:${PORT}/api`);
        console.log('================================================');
        // On startup: reset orphaned "running" tasks back to pending
        setTimeout(() => {
            const running = taskQueue_1.taskQueue.getTasks('running');
            if (running.length > 0) {
                console.log(`[Server] Resetting ${running.length} orphaned running task(s) to pending`);
                for (const t of running) {
                    taskQueue_1.taskQueue.updateTaskStatus(t.id, 'pending');
                }
            }
            // Then process queue for pending tasks
            const pending = taskQueue_1.taskQueue.getTasks('pending');
            if (pending.length > 0) {
                console.log(`[Server] Processing ${pending.length} pending task(s)`);
                taskQueue_1.taskQueue.processQueue();
            }
        }, 3000); // wait 3s for workers to reconnect WebSocket
    });
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('[Server] Shutting down...');
        server.close(() => {
            console.log('[Server] Closed');
            process.exit(0);
        });
    });
}
main().catch(console.error);
//# sourceMappingURL=server.js.map