"use strict";
// ============================================================
// Agent OS - Control Plane - Chat Route
// CEO-facing chat interface API
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const intentEngine_1 = require("../services/intentEngine");
const agentCommander_1 = require("../services/agentCommander");
const approvalEngine_1 = require("../services/approvalEngine");
const taskQueue_1 = require("../services/taskQueue");
const wsManager_1 = require("../services/wsManager");
const router = (0, express_1.Router)();
// Chat message history (in-memory for MVP, move to DB later)
const chatHistory = [];
/**
 * POST /api/chat — Send a message to Agent OS
 * CEO types natural language, system responds with task creation
 */
router.post('/', (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
    }
    const trimmed = message.trim();
    if (!trimmed) {
        return res.status(400).json({ error: 'message cannot be empty' });
    }
    // Parse intent
    const intent = (0, intentEngine_1.parseIntent)(trimmed);
    const commanderPlan = (0, agentCommander_1.createCommanderPlan)(trimmed, intent);
    // Store user message
    const userMsg = {
        id: (0, uuid_1.v4)(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
    };
    chatHistory.push(userMsg);
    // Unknown free text must not become a script task. Agent Commander may still
    // recognize broader CEO intents such as "Audit dashboard.bakudanramen.com".
    if (!intent.supported && !commanderPlan.recognized) {
        const sysMsg = {
            id: (0, uuid_1.v4)(),
            role: 'system',
            content: (0, intentEngine_1.getUnsupportedCommandMessage)(intent.suggestions),
            timestamp: new Date().toISOString(),
            intent,
            commanderPlan,
        };
        chatHistory.push(sysMsg);
        return res.json({ messages: [userMsg, sysMsg], unsupported: true });
    }
    // Handle query-type intents (no task creation)
    if (commanderPlan.taskType === 'query' || (intent.supported && intent.type === 'query')) {
        const queryResponse = handleQuery(trimmed);
        const sysMsg = {
            id: (0, uuid_1.v4)(),
            role: 'system',
            content: `${(0, agentCommander_1.formatCommanderPlan)(commanderPlan)}\n\n${queryResponse}`,
            timestamp: new Date().toISOString(),
            intent,
            commanderPlan,
        };
        chatHistory.push(sysMsg);
        return res.json({ messages: [userMsg, sysMsg], commanderPlan });
    }
    if (!commanderPlan.canExecuteNow || commanderPlan.taskType === 'plan_only') {
        const sysMsg = {
            id: (0, uuid_1.v4)(),
            role: 'system',
            content: (0, agentCommander_1.formatCommanderPlan)(commanderPlan),
            timestamp: new Date().toISOString(),
            intent,
            commanderPlan,
        };
        chatHistory.push(sysMsg);
        return res.json({ messages: [userMsg, sysMsg], commanderPlan, planOnly: true });
    }
    // Create task
    const task = taskQueue_1.taskQueue.createTask({
        type: commanderPlan.taskType,
        project: commanderPlan.project,
        priority: commanderPlan.priority,
        payload: {
            ...intent.payload,
            ...commanderPlan.payload,
            commanderPlan,
        },
        createdBy: 'ceo',
    });
    // If requires approval, set task to waiting
    let statusMessage;
    if (commanderPlan.requiresApproval) {
        statusMessage = `${(0, agentCommander_1.formatCommanderPlan)(commanderPlan)}\n\n${(0, intentEngine_1.describeIntent)(intent)}\n\nTask #${task.id.slice(0, 8)} created — **waiting for approval**.\nRisk: ${commanderPlan.riskLevel.toUpperCase()}\n\nType "approve ${task.id.slice(0, 8)}" to approve.`;
    }
    else {
        statusMessage = `${(0, agentCommander_1.formatCommanderPlan)(commanderPlan)}\n\n${intent.supported ? (0, intentEngine_1.describeIntent)(intent) : 'Dynamic commander intent'}\n\nTask #${task.id.slice(0, 8)} created — auto-approved and queued.\nProject: ${commanderPlan.project}`;
    }
    // Store system response
    const sysMsg = {
        id: (0, uuid_1.v4)(),
        role: 'system',
        content: statusMessage,
        timestamp: new Date().toISOString(),
        taskId: task.id,
        intent,
        commanderPlan,
    };
    chatHistory.push(sysMsg);
    // Broadcast via WebSocket
    wsManager_1.wsManager.broadcast({
        type: 'chat_message',
        payload: sysMsg,
        timestamp: new Date().toISOString(),
    });
    res.json({
        messages: [userMsg, sysMsg],
        task: {
            id: task.id,
            type: commanderPlan.taskType,
            project: commanderPlan.project,
            status: commanderPlan.requiresApproval ? 'waiting_approval' : 'pending',
            riskLevel: commanderPlan.riskLevel,
            requiresApproval: commanderPlan.requiresApproval,
        },
        commanderPlan,
    });
});
/**
 * GET /api/chat/history — Get chat history
 */
router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const messages = chatHistory.slice(-limit);
    res.json({ messages });
});
/**
 * POST /api/chat/approve — Approve a task via chat
 */
router.post('/approve', (req, res) => {
    const { taskId } = req.body;
    if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
    }
    // Find task by partial ID
    const tasks = taskQueue_1.taskQueue.getTasks();
    const task = tasks.find((t) => t.id.startsWith(taskId));
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    const approval = (0, approvalEngine_1.approveTask)(task.id, 'ceo');
    if (!approval) {
        return res.status(400).json({ error: 'No pending approval for this task' });
    }
    // Move task to pending (ready for execution)
    taskQueue_1.taskQueue.updateTaskStatus(task.id, 'pending');
    const sysMsg = {
        id: (0, uuid_1.v4)(),
        role: 'system',
        content: `✅ Task #${task.id.slice(0, 8)} approved and queued for execution.`,
        timestamp: new Date().toISOString(),
        taskId: task.id,
    };
    chatHistory.push(sysMsg);
    wsManager_1.wsManager.broadcast({
        type: 'approval_resolved',
        payload: { taskId: task.id, status: 'approved' },
        timestamp: new Date().toISOString(),
    });
    res.json({ success: true, message: sysMsg.content });
});
/**
 * POST /api/chat/deny — Deny a task via chat
 */
router.post('/deny', (req, res) => {
    const { taskId, reason } = req.body;
    if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
    }
    const tasks = taskQueue_1.taskQueue.getTasks();
    const task = tasks.find((t) => t.id.startsWith(taskId));
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    const approval = (0, approvalEngine_1.denyTask)(task.id, 'ceo', reason);
    if (!approval) {
        return res.status(400).json({ error: 'No pending approval for this task' });
    }
    taskQueue_1.taskQueue.updateTaskStatus(task.id, 'cancelled');
    const sysMsg = {
        id: (0, uuid_1.v4)(),
        role: 'system',
        content: `❌ Task #${task.id.slice(0, 8)} denied.${reason ? ` Reason: ${reason}` : ''}`,
        timestamp: new Date().toISOString(),
        taskId: task.id,
    };
    chatHistory.push(sysMsg);
    wsManager_1.wsManager.broadcast({
        type: 'approval_resolved',
        payload: { taskId: task.id, status: 'denied' },
        timestamp: new Date().toISOString(),
    });
    res.json({ success: true, message: sysMsg.content });
});
/**
 * GET /api/chat/pending — Get pending approvals
 */
router.get('/pending', (req, res) => {
    const pending = (0, approvalEngine_1.getPendingApprovals)();
    res.json({ approvals: pending });
});
/**
 * Handle query-type messages (no task creation)
 */
function handleQuery(message) {
    const lower = message.toLowerCase();
    if (lower.includes('status') || lower.includes('tasks')) {
        const tasks = taskQueue_1.taskQueue.getTasks();
        const pending = tasks.filter((t) => t.status === 'pending').length;
        const running = tasks.filter((t) => t.status === 'running').length;
        const completed = tasks.filter((t) => t.status === 'completed').length;
        return `📊 Task Status:\n• Pending: ${pending}\n• Running: ${running}\n• Completed: ${completed}\n• Total: ${tasks.length}`;
    }
    if (lower.includes('workers')) {
        return '👥 Worker status: Check the Workers tab for live status.';
    }
    if (lower.includes('projects')) {
        return '📁 Projects: Check the Projects tab for discovered projects.';
    }
    return '🤖 I can help you with:\n• Audit, Build, QA, Git operations\n• Start API proxy, Open apps\n• Deploy (requires approval)\n• Show status, tasks, workers';
}
exports.default = router;
//# sourceMappingURL=chat.js.map