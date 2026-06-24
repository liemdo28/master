"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
exports.handleWsChat = handleWsChat;
const express_1 = require("express");
const ai_client_1 = require("../services/ai-client");
const mi_brain_1 = require("../services/mi-brain");
const briefing_engine_1 = require("../connectors/briefing-engine");
const project_connector_1 = require("../connectors/project-connector");
const pc_connector_1 = require("../connectors/pc-connector");
const gate_1 = require("../approval/gate");
const reminder_parser_1 = require("../reminders/reminder-parser");
const reminder_store_1 = require("../reminders/reminder-store");
const executive_memory_1 = require("../memory/executive-memory");
const response_pipeline_1 = require("../pipeline/response-pipeline");
const chat_queue_1 = require("../chat/chat-queue");
const chat_metrics_1 = require("../chat/chat-metrics");
const executive_snapshot_1 = require("../executive/executive-snapshot");
const response_scrubber_1 = require("../middleware/response-scrubber");
const latency_monitor_1 = require("../operations/latency-monitor");
const quality_metrics_1 = require("../operations/quality-metrics");
const decision_audit_1 = require("../operations/decision-audit");
const conversation_store_1 = require("../chat/conversation-store");
const gate_2 = require("../approval/gate");
const multi_intent_engine_1 = require("../execution/multi-intent-engine");
const multi_intent_executor_1 = require("../execution/multi-intent-executor");
const action_intent_engine_1 = require("../execution/action-intent-engine");
const execution_1 = require("../execution");
exports.chatRouter = (0, express_1.Router)();
// Use SQLite-backed persistent conversation store (survives restart)
function getHistory(sessionId) {
    return (0, conversation_store_1.getHistory)(sessionId);
}
function isExecutiveStatusQuestion(message) {
    const label = (0, executive_snapshot_1.classifyExecutiveIntent)(message);
    if (label === 'graph_lookup' || label === 'action_request')
        return false;
    return /dashboard|hôm nay|hom nay|task|work order|việc|viec|duyệt|duyet|approve|email|gmail|calendar|lịch|lich|drive|qb|quickbooks|sync|raw sushi|rawsushibar|connector|kết nối|ket noi|đáng lo|dang lo|blocker/i.test(message);
}
function isDangerousRuntimeCommand(message) {
    const lower = message.toLowerCase();
    return (0, action_intent_engine_1.classifyActionIntent)(message).message_class === 'dangerous_action'
        || /\b(deploy|deployment|tri[eể]n\s*khai|push|release|webhook)\b/.test(lower)
        || /\b(production|prod)\b.*\b(update|deploy|release|push)\b/.test(lower)
        || /(submit|file|n[oộ]p).*(tax|thu[eế]|irs|return|filing)/.test(lower)
        || /(tax|thu[eế]).*(submit|file|n[oộ]p|filing)/.test(lower)
        || /(delete|x[oó]a|drop|truncate|clear|remove).*(database|db|table|production|customer|data)/.test(lower)
        || /(database|db|table).*(delete|x[oó]a|drop|truncate|clear|remove)/.test(lower)
        || /(pay|payment|transfer|wire|thanh\s*to[aá]n).*(bill|invoice|\$|vendor|supplier|account|payroll|funds|money)/.test(lower)
        || /(bill|invoice|vendor|supplier|payroll|funds|money).*(pay|payment|transfer|wire|thanh\s*to[aá]n)/.test(lower);
}
function createDangerousApproval(message) {
    return (0, gate_2.enqueue)({
        risk_level: 3,
        category: 'dangerous_runtime_action',
        description: `Approval required for dangerous command: ${message.slice(0, 120)}`,
        target: message,
        before_state: JSON.stringify({ source: 'chat', executed: false }),
        after_state: '',
        rollback_plan: 'No execution occurred before approval.',
    });
}
function shouldUseDeterministicMultiIntent(message) {
    const lower = message.toLowerCase();
    const expectedSignals = [
        /dashboard/.test(lower),
        /\bqb\b|quickbooks/.test(lower),
        /raw\s*seo|seo\s*raw|raw sushi.*seo|seo.*raw sushi/.test(lower),
        /maria/.test(lower),
    ].filter(Boolean).length;
    return expectedSignals >= 2 && ((0, multi_intent_engine_1.isMultiIntent)(message) || message.includes('+'));
}
function formatMultiIntentReply(result) {
    // P2+P3: Use CEO language filter — no internal workflow names, no IDs
    return { reply: result.final_summary, tasks: result.children };
}
exports.chatRouter.post('/', async (req, res) => {
    const { message, session_id = 'default' } = req.body;
    if (!message?.trim())
        return res.status(400).json({ error: 'message required' });
    chat_metrics_1.chatMetrics.reqStart();
    const t0 = Date.now();
    try {
        const result = await (0, chat_queue_1.enqueueChat)(() => processMessage(message, session_id));
        const elapsed = Date.now() - t0;
        chat_metrics_1.chatMetrics.reqEnd(elapsed, true);
        (0, latency_monitor_1.recordLatency)('chat_response', elapsed, 'chat_http');
        const history = getHistory(session_id);
        if (result.reply) {
            (0, quality_metrics_1.inferQualityFromReply)({ session_id, user_request: message, reply: result.reply, history_length: history.length });
            (0, decision_audit_1.recordDecision)({ user_request: message, intent: 'chat', session_id, execution_decision: 'chat_response', model: result.model });
        }
        res.json((0, response_scrubber_1.scrubChatResult)(result, 'chat'));
    }
    catch (e) {
        if (e instanceof chat_queue_1.ChatQueueFullError) {
            chat_metrics_1.chatMetrics.reqEnd(Date.now() - t0, false);
            return res.status(503).json({ error: 'Em đang bận quá — anh thử lại sau vài giây nhé.', code: 'QUEUE_FULL' });
        }
        if (e instanceof chat_queue_1.ChatTimeoutError) {
            chat_metrics_1.chatMetrics.reqTimeout();
            return res.status(503).json({ error: 'Câu hỏi mất quá lâu — anh thử lại nhé.', code: 'TIMEOUT' });
        }
        chat_metrics_1.chatMetrics.reqEnd(Date.now() - t0, false);
        console.error('[Mi Chat]', e);
        res.status(500).json({ error: 'Mi gặp lỗi, anh thử lại nhé.' });
    }
});
exports.chatRouter.delete('/history/:sessionId', (req, res) => {
    (0, conversation_store_1.clearSession)(req.params.sessionId);
    res.json({ ok: true });
});
async function handleWsChat(ws, msg) {
    const { message, session_id = 'default' } = msg;
    if (!message?.trim()) {
        ws.send(JSON.stringify({ type: 'error', message: 'message required' }));
        return;
    }
    chat_metrics_1.chatMetrics.reqStart();
    const t0 = Date.now();
    try {
        const result = await (0, chat_queue_1.enqueueChat)(() => processMessage(message, session_id));
        chat_metrics_1.chatMetrics.reqEnd(Date.now() - t0, true);
        ws.send(JSON.stringify({ type: 'response', ...(0, response_scrubber_1.scrubChatResult)(result, 'ws_chat') }));
    }
    catch (e) {
        if (e instanceof chat_queue_1.ChatQueueFullError || e instanceof chat_queue_1.ChatTimeoutError) {
            chat_metrics_1.chatMetrics.reqEnd(Date.now() - t0, false);
            ws.send(JSON.stringify({ type: 'error', message: 'Em đang bận — anh thử lại nhé.', code: e.code }));
        }
        else {
            chat_metrics_1.chatMetrics.reqEnd(Date.now() - t0, false);
            ws.send(JSON.stringify({ type: 'error', message: 'Mi gặp lỗi, anh thử lại nhé.' }));
        }
    }
}
async function processMessage(message, sessionId) {
    const history = getHistory(sessionId);
    if (isDangerousRuntimeCommand(message)) {
        const approval = createDangerousApproval(message);
        const reply = `Approval required. Request ${approval.id} created. No execution performed. No deployment, tax, payment, or database guidance will be provided before approval.`;
        (0, conversation_store_1.addMessage)(sessionId, 'user', message);
        (0, conversation_store_1.addMessage)(sessionId, 'assistant', reply);
        return {
            reply,
            intent: 'approval_required',
            mode: 'ceo',
            model: 'approval-gate',
            approval_required: true,
            approval_id: approval.id,
            executed: false,
            sources: ['/api/approval/pending'],
        };
    }
    if (shouldUseDeterministicMultiIntent(message)) {
        const multi = (0, multi_intent_executor_1.executeMultiIntent)(message, { sender: 'ceo' });
        const formatted = formatMultiIntentReply(multi);
        (0, conversation_store_1.addMessage)(sessionId, 'user', message);
        (0, conversation_store_1.addMessage)(sessionId, 'assistant', formatted.reply);
        return {
            reply: formatted.reply,
            intent: 'multi_intent',
            mode: 'ceo',
            model: 'multi-intent-executor',
            parent_tracking_id: multi.parent_tracking_id,
            parent_workflow_id: multi.parent_workflow_id,
            expected_children: multi.expected_children,
            executed_children: multi.executed_children,
            dropped_children: multi.dropped_children,
            failed_children: multi.failed_children,
            approval_pending_children: multi.approval_pending_children,
            tasks: formatted.tasks,
            trace_path: multi.trace_path,
            sources: ['execution/multi-intent-engine'],
        };
    }
    const executionIntent = (0, action_intent_engine_1.classifyActionIntent)(message);
    if (executionIntent.message_class === 'action_request' && (0, execution_1.needsWorkflow)(executionIntent)) {
        const executionResult = (0, execution_1.processCEORequest)({
            message,
            sender: 'ceo',
            message_id: `chat-${Date.now()}`,
        });
        (0, conversation_store_1.addMessage)(sessionId, 'user', message);
        (0, conversation_store_1.addMessage)(sessionId, 'assistant', executionResult.response_message);
        return {
            reply: executionResult.response_message,
            intent: executionResult.intent?.domain || 'execution_action',
            mode: 'ceo',
            model: 'execution-engine',
            approval_required: !!executionResult.approval,
            approval_id: executionResult.approval?.approval_id || null,
            workflow_id: executionResult.workflow?.workflow_id || null,
            evidence_path: executionResult.workflow?.evidence_path || null,
            draft_preview_path: executionResult.draft?.preview_path || null,
            execution_action: executionResult.action,
            sources: ['execution/processCEORequest'],
        };
    }
    // ── FAST PATH: Daily Work Actions (file/email/calendar/task/drive/store queries) ──
    // These go directly to the pipeline which handles them with the action layer.
    // Skip old intent routing for these.
    const isActionMessage = /tìm file|find file|tìm.*rồi gửi|gửi file.*cho|find.*then send|send.*file|upload.*drive|lên drive|tạo meeting|create meeting|tạo lịch họp|raw là|bakudan ở|store nào|ở đâu.*(?:raw|bakudan)|(?:raw|bakudan).*ở đâu/i.test(message);
    if (isActionMessage) {
        const pipelineOut = await (0, response_pipeline_1.runPipeline)({ message, mode: 'ceo', history, intent: 'action' });
        (0, conversation_store_1.addMessage)(sessionId, 'user', message);
        (0, conversation_store_1.addMessage)(sessionId, 'assistant', pipelineOut.reply);
        return { reply: pipelineOut.reply, intent: 'action', mode: 'ceo', model: pipelineOut.model, sources: pipelineOut.sources };
    }
    const intent = (0, mi_brain_1.parseIntent)(message);
    if (isExecutiveStatusQuestion(message) || [
        'visibility_daily',
        'visibility_email',
        'visibility_calendar',
        'visibility_dashboard',
        'visibility_connector_status',
        'pending_approvals',
    ].includes(intent.type)) {
        const answer = await (0, executive_snapshot_1.formatExecutiveSnapshotAnswer)(message);
        (0, conversation_store_1.addMessage)(sessionId, 'user', message);
        (0, conversation_store_1.addMessage)(sessionId, 'assistant', answer.reply);
        return { reply: answer.reply, intent: answer.intent, mode: intent.mode, model: 'executive-snapshot', sources: answer.sources };
    }
    // Reminder
    if (intent.type === 'reminder') {
        const parsed = (0, reminder_parser_1.parseReminderCommand)(message);
        if (!parsed) {
            return { reply: 'Anh cho em biết cụ thể hơn nhé? Ví dụ: "nhắc anh nghỉ sau 1 tiếng" hoặc "nhắc uống nước mỗi 2 tiếng".', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        let reminder;
        if (parsed.type === 'once' && parsed.delayMs)
            reminder = (0, reminder_store_1.createOnce)(parsed.message, parsed.delayMs);
        else if (parsed.type === 'interval' && parsed.intervalMs)
            reminder = (0, reminder_store_1.createInterval)(parsed.message, parsed.intervalMs);
        else if (parsed.type === 'daily' && parsed.hour !== undefined && parsed.minute !== undefined)
            reminder = (0, reminder_store_1.createDaily)(parsed.message, parsed.hour, parsed.minute);
        if (!reminder) {
            return { reply: 'Em chưa parse được thời gian. Anh thử lại nhé.', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        const timeDesc = parsed.type === 'once'
            ? `sau ${Math.round((parsed.delayMs || 0) / 60000)} phút`
            : parsed.type === 'interval'
                ? `mỗi ${Math.round((parsed.intervalMs || 0) / 60000)} phút`
                : `hàng ngày lúc ${parsed.hour}:${String(parsed.minute).padStart(2, '0')}`;
        return {
            reply: `Dạ, em sẽ nhắc anh "${parsed.message}" ${timeDesc}. ✓`,
            intent: intent.type, mode: intent.mode, model: 'built-in', reminder,
        };
    }
    // Handle workspace commands with real data
    if (intent.type === 'briefing') {
        const { briefing, data } = await (0, briefing_engine_1.generateBriefing)();
        return { reply: briefing, intent: intent.type, mode: intent.mode, model: 'briefing-engine', data };
    }
    if (intent.type === 'project_issues') {
        const issues = (0, project_connector_1.getProjectsWithIssues)();
        if (issues.length === 0) {
            return { reply: 'Dạ, hiện tại tất cả projects đều không có vấn đề gì. ✓', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        const lines = issues.map(p => `• **${p.name}**: ${p.issues.join(', ')}`).join('\n');
        return {
            reply: `Em thấy ${issues.length} project có vấn đề:\n\n${lines}`,
            intent: intent.type, mode: intent.mode, model: 'built-in',
        };
    }
    if (intent.type === 'project_search') {
        const q = intent.searchQuery || message;
        const results = (0, pc_connector_1.searchFiles)(q);
        if (results.length === 0) {
            return { reply: `Không tìm thấy file/folder nào khớp với "${q}".`, intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        const lines = results.slice(0, 10).map(r => `• ${r}`).join('\n');
        return {
            reply: `Tìm thấy ${results.length} kết quả cho "${q}":\n\n${lines}${results.length > 10 ? `\n... và ${results.length - 10} kết quả khác` : ''}`,
            intent: intent.type, mode: intent.mode, model: 'built-in',
        };
    }
    if (intent.type === 'pending_approvals') {
        const pending = (0, gate_1.getPending)();
        if (pending.length === 0) {
            return { reply: 'Hiện không có action nào cần approve. ✓', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        const lines = pending.map(a => `• [Level ${a.risk_level}] **${a.description}** → ${a.target}`).join('\n');
        return {
            reply: `Có ${pending.length} action đang chờ anh approve:\n\n${lines}\n\nAnh vào /approval để xem và duyệt.`,
            intent: intent.type, mode: intent.mode, model: 'built-in',
        };
    }
    // Profile view — use Executive Memory V2
    if (intent.type === 'profile_view') {
        const profile = executive_memory_1.executiveMemory.getOwnerProfile();
        const summary = executive_memory_1.executiveMemory.summarizeOwnerProfile();
        return {
            reply: `Đây là profile của anh:\n\n${summary}\n\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``,
            intent: intent.type, mode: intent.mode, model: 'executive-memory',
        };
    }
    // ── VISIBILITY INTENTS ──────────────────────────────────────────────────────
    if (intent.type === 'visibility_daily') {
        const { getDailySnapshot } = await Promise.resolve().then(() => __importStar(require('../visibility/visibility-hub')));
        try {
            const snapshot = await getDailySnapshot();
            const lines = [
                `📅 ${snapshot.date}`,
                snapshot.emails?.unread !== undefined ? `📧 Gmail: ${snapshot.emails.unread} unread` : `📧 Gmail: ${snapshot.emails?.status || 'not configured'}`,
                snapshot.calendar?.today_count !== undefined ? `📆 Calendar: ${snapshot.calendar.today_count} events` : `📆 Calendar: ${snapshot.calendar?.status || 'not configured'}`,
                snapshot.tasks?.asana_my_tasks !== undefined ? `✅ Asana: ${snapshot.tasks.asana_my_tasks} tasks` : `✅ Asana: ${snapshot.tasks?.asana_status || 'not configured'}`,
            ].join('\n');
            return { reply: lines, intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        catch {
            return { reply: 'Không thể tạo daily snapshot — visibility connector chưa sync.', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
    }
    if (intent.type === 'visibility_overdue') {
        const { getOverdueTasksAll } = await Promise.resolve().then(() => __importStar(require('../visibility/visibility-hub')));
        const overdue = getOverdueTasksAll();
        const asanaTasks = overdue.asana || [];
        if (asanaTasks.length > 0) {
            const lines = asanaTasks.map((t) => `• ${t.name} ${t.is_overdue ? '(OVERDUE)' : `(due ${t.due_on || 'no date'})`}`).join('\n');
            return { reply: `Có ${asanaTasks.length} task đang overdue:\n\n${lines}`, intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        return { reply: 'Không có task overdue nào. ✓', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    if (intent.type === 'visibility_email') {
        const { getImportantEmailsAll } = await Promise.resolve().then(() => __importStar(require('../visibility/visibility-hub')));
        const emails = getImportantEmailsAll(10);
        if (emails.gmail && emails.gmail.length > 0) {
            const lines = emails.gmail.map((e) => `• ${e.is_important ? '⭐ ' : ''}${e.subject} — từ ${e.from}`).join('\n');
            return { reply: `Có ${emails.gmail.length} email quan trọng:\n\n${lines}`, intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        return { reply: 'Gmail connector chưa cấu hình — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env để kết nối.', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    if (intent.type === 'visibility_calendar') {
        // If message is about CREATING an event, route to pipeline (action layer)
        if (/t.o|create|schedule|meeting|l.ch h.p|\bm.i\b/i.test(message)) {
            const pipelineOut = await (0, response_pipeline_1.runPipeline)({ message, mode: intent.mode, history, intent: intent.type });
            (0, conversation_store_1.addMessage)(sessionId, 'user', message);
            (0, conversation_store_1.addMessage)(sessionId, 'assistant', pipelineOut.reply);
            return { reply: pipelineOut.reply, intent: intent.type, mode: intent.mode, model: pipelineOut.model, sources: pipelineOut.sources };
        }
        const { getTodayEventsAll } = await Promise.resolve().then(() => __importStar(require('../visibility/visibility-hub')));
        const events = getTodayEventsAll();
        if (events.calendar && events.calendar.length > 0) {
            const lines = events.calendar.map((e) => {
                const time = new Date(e.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                return `• ${time} — ${e.title}`;
            }).join('\n');
            return { reply: `Hôm nay có ${events.calendar.length} sự kiện:\n\n${lines}`, intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        return { reply: 'Google Calendar chưa cấu hình — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env để kết nối.', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    if (intent.type === 'visibility_dashboard') {
        // Route all task creation / write actions to pipeline
        if (/task|t.o|create|assign|giao|update|check/i.test(message)) {
            const pipelineOut = await (0, response_pipeline_1.runPipeline)({ message, mode: intent.mode, history, intent: intent.type });
            (0, conversation_store_1.addMessage)(sessionId, 'user', message);
            (0, conversation_store_1.addMessage)(sessionId, 'assistant', pipelineOut.reply);
            return { reply: pipelineOut.reply, intent: intent.type, mode: intent.mode, model: pipelineOut.model, sources: pipelineOut.sources };
        }
        return { reply: 'Dashboard connector đang check trạng thái — sẽ show qua pipeline response.', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    if (intent.type === 'visibility_health') {
        const { hasHealthExport, getHealthSummaryText } = await Promise.resolve().then(() => __importStar(require('../visibility/connectors/health/health-connector')));
        if (hasHealthExport()) {
            return { reply: getHealthSummaryText(), intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        return { reply: 'Huawei Health export chưa cấu hình — export JSON từ Huawei Health app vào .local-agent-global/visibility/health/export/', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    // ── KNOWLEDGE FEDERATION INTENTS ────────────────────────────────────────────
    // These are handled via getFederatedContext() in the pipeline — fall through below
    if (intent.type === 'visibility_connector_status') {
        const { getPlatformHealth } = await Promise.resolve().then(() => __importStar(require('../visibility/visibility-hub')));
        const health = getPlatformHealth();
        const lines = ['🔌 Connector Health Board', ''];
        for (const c of health) {
            const icon = c.health === 'healthy' ? '✓' : c.health === 'degraded' ? '⚠' : c.health === 'offline' ? '✗' : '○';
            const status = c.auth === 'connected' ? c.health : c.auth;
            lines.push(`  ${icon} ${c.name}: ${status}`);
            if (c.setup_hint)
                lines.push(`    → ${c.setup_hint}`);
        }
        return { reply: lines.join('\n'), intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    // ── PROJECT CONNECTOR / TASK / POST — route to pipeline ──────────────────
    if (/tạo task|create task|giao task|giao việc.*(?:maria|hoang|nguyên|nguyen)|task.*for.*(?:maria|hoang|nguyên|nguyen)|schedule.*post|lên lịch.*post|seo.*post/i.test(message)) {
        const pipelineOut = await (0, response_pipeline_1.runPipeline)({ message, mode: intent.mode, history, intent: intent.type });
        (0, conversation_store_1.addMessage)(sessionId, 'user', message);
        (0, conversation_store_1.addMessage)(sessionId, 'assistant', pipelineOut.reply);
        return { reply: pipelineOut.reply, intent: intent.type, mode: intent.mode, model: pipelineOut.model, sources: pipelineOut.sources };
    }
    if (intent.type === 'health_view') {
        const health = executive_memory_1.executiveMemory.getPersonalContext();
        return {
            reply: Object.keys(health).length > 0
                ? `Thông tin sức khỏe/personal của anh:\n\`\`\`json\n${JSON.stringify(health, null, 2)}\n\`\`\``
                : 'Anh chưa có thông tin sức khỏe nào được lưu.',
            intent: intent.type, mode: intent.mode, model: 'executive-memory',
        };
    }
    // Memory forget — V2
    if (intent.type === 'memory_forget') {
        const isHealth = /sức khỏe|health|personal/i.test(message);
        const isPreference = /preference|prefer|trả lời|response|ngắn|dài/i.test(message);
        let result;
        if (isHealth) {
            result = executive_memory_1.executiveMemory.deleteSensitiveMemory();
            return { reply: 'Dạ, em đã xóa toàn bộ thông tin sức khỏe/personal của anh rồi.', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
        // Extract specific key from message via AI
        const extractPrompt = `Owner nói: "${message}". Họ muốn xóa preference/memory nào? Trả về JSON: { "category": "preferences|decisions|workflows", "key": "tên field cụ thể hoặc null nếu xóa toàn bộ" }. Chỉ JSON.`;
        const aiRes = await (0, ai_client_1.askAi)([{ role: 'user', content: extractPrompt }]);
        try {
            const parsed = JSON.parse(aiRes.text.replace(/```json?\n?|```/g, '').trim());
            result = executive_memory_1.executiveMemory.forget(parsed.category, parsed.key || undefined);
            return { reply: `Dạ, em đã quên rồi: ${result.message}`, intent: intent.type, mode: intent.mode, model: aiRes.model };
        }
        catch {
            return { reply: 'Anh muốn em quên thông tin gì cụ thể vậy? Ví dụ: "quên preference trả lời ngắn"', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
    }
    // Memory save — V2 with preference detection
    if (intent.type === 'memory_save') {
        const extractPrompt = `Owner nói: "${message}"
Trích xuất thông tin cần lưu. Trả về JSON: { "category": "preferences|profile|business|decisions|workflows|personal", "key": "...", "value": "...", "needs_consent": false }
Nếu liên quan sức khỏe/y tế, needs_consent = true.
Chỉ JSON.`;
        const aiRes = await (0, ai_client_1.askAi)([{ role: 'user', content: extractPrompt }]);
        try {
            const parsed = JSON.parse(aiRes.text.replace(/```json?\n?|```/g, '').trim());
            const result = executive_memory_1.executiveMemory.remember(parsed.category, parsed.key, parsed.value, parsed.needs_consent);
            const consentNote = parsed.needs_consent ? ' (có consent log)' : '';
            return { reply: `Dạ, em đã nhớ rồi${consentNote}: "${parsed.key}" = "${parsed.value}" → ${parsed.category}`, intent: intent.type, mode: intent.mode, model: aiRes.model };
        }
        catch {
            return { reply: 'Anh cho em biết cụ thể cần nhớ điều gì nhé?', intent: intent.type, mode: intent.mode, model: 'built-in' };
        }
    }
    // General chat — run through full pipeline (Memory + KB + Visibility + AI)
    const pipelineOut = await (0, response_pipeline_1.runPipeline)({ message, mode: intent.mode, history, intent: intent.type });
    // Persist to SQLite (survives restart)
    (0, conversation_store_1.addMessage)(sessionId, 'user', message);
    (0, conversation_store_1.addMessage)(sessionId, 'assistant', pipelineOut.reply);
    return {
        reply: pipelineOut.reply,
        intent: intent.type,
        mode: intent.mode,
        model: pipelineOut.model,
        sources: pipelineOut.sources,
        kb_hits: pipelineOut.kb_hits,
    };
}
