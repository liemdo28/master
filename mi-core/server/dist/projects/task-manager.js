"use strict";
/**
 * Task Manager — create/update/assign/complete tasks via Dashboard + Asana
 * All write actions go through approval gate.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskDraft = createTaskDraft;
exports.parseTaskFromMessage = parseTaskFromMessage;
exports.getPendingTaskDrafts = getPendingTaskDrafts;
exports.formatTaskDraftResponse = formatTaskDraftResponse;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gate_1 = require("../approval/gate");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const DASHBOARD_API = process.env.DASHBOARD_API || 'http://dashboard.bakudanramen.com';
const ASANA_TOKEN = process.env.ASANA_TOKEN || '';
const DRAFTS_PATH = path_1.default.join(GLOBAL_DIR, 'mi-core', 'task-drafts.json');
function loadDrafts() {
    try {
        return JSON.parse(fs_1.default.readFileSync(DRAFTS_PATH, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveDrafts(drafts) {
    fs_1.default.mkdirSync(path_1.default.dirname(DRAFTS_PATH), { recursive: true });
    fs_1.default.writeFileSync(DRAFTS_PATH, JSON.stringify(drafts, null, 2));
}
function generateId() {
    return 'task_' + Date.now().toString(36);
}
// ── Create task draft (requires approval before execution) ─────────────────
function createTaskDraft(params) {
    const platform = params.platform || 'dashboard';
    const draft = {
        id: generateId(),
        title: params.title,
        description: params.description,
        assignee: params.assignee,
        due_date: params.due_date,
        priority: params.priority || 'medium',
        project: params.project,
        platform,
        status: 'pending_approval',
        created_at: new Date().toISOString(),
    };
    const approval = (0, gate_1.enqueue)({
        risk_level: 2,
        category: 'task-create',
        target: platform,
        description: `Create task: "${params.title}"${params.assignee ? ` → ${params.assignee}` : ''}${params.due_date ? ` (due: ${params.due_date})` : ''}`,
        before_state: 'No task exists',
        rollback_plan: 'Reject the approval to cancel task creation',
    });
    draft.approval_id = approval.id;
    const drafts = loadDrafts();
    drafts.push(draft);
    saveDrafts(drafts);
    return draft;
}
// ── Parse natural language task request ────────────────────────────────────
function parseTaskFromMessage(message) {
    // Extract title
    let title = message
        .replace(/^(create|tạo|giao|add|thêm)\s+(task|việc|công việc|nhiệm vụ)\s*/i, '')
        .replace(/\s+(for|cho|giao cho)\s+\w+.*/i, '')
        .replace(/\s+(by|due|hạn|deadline)\s+.*/i, '')
        .trim();
    // Extract assignee
    const assigneeMatch = message.match(/(?:for|cho|giao cho|assign.*to)\s+([A-Za-z]+)/i);
    const assignee = assigneeMatch?.[1];
    // Extract due date
    const dueMatch = message.match(/(?:by|due|hạn|deadline|vào)\s+(.+?)(?:\s|$)/i);
    let due_date;
    if (dueMatch) {
        const raw = dueMatch[1].toLowerCase();
        const now = new Date();
        if (raw.includes('tomorrow') || raw.includes('ngày mai')) {
            now.setDate(now.getDate() + 1);
            due_date = now.toISOString().split('T')[0];
        }
        else if (raw.includes('friday') || raw.includes('thứ 6')) {
            const day = now.getDay();
            now.setDate(now.getDate() + (5 - day + 7) % 7);
            due_date = now.toISOString().split('T')[0];
        }
        else if (/\d{1,2}\/\d{1,2}/.test(raw)) {
            const [m, d] = raw.split('/').map(Number);
            due_date = `${now.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }
    // Priority
    const priority = /urgent|khẩn|asap|priority.*high/i.test(message) ? 'high' : 'medium';
    return { title: title || message.slice(0, 80), assignee, due_date, priority };
}
// ── List pending task drafts ────────────────────────────────────────────────
function getPendingTaskDrafts() {
    return loadDrafts().filter(d => d.status === 'pending_approval');
}
// ── Format task summary for Mi response ────────────────────────────────────
function formatTaskDraftResponse(draft) {
    return [
        `✅ Task draft created:`,
        `  Title: "${draft.title}"`,
        draft.assignee ? `  Assignee: ${draft.assignee}` : '',
        draft.due_date ? `  Due: ${draft.due_date}` : '',
        `  Platform: ${draft.platform}`,
        `  Priority: ${draft.priority}`,
        ``,
        `→ Approval #${draft.approval_id} required before creating`,
        `[Approve] [Edit] [Reject]`,
    ].filter(s => s !== undefined).join('\n');
}
