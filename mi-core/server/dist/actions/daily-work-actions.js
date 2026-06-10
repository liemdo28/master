"use strict";
/**
 * daily-work-actions.ts
 * TypeScript entry for daily work actions in the pipeline.
 * Handles: file search, find+send, create-event, create-task,
 *          drive upload, content scheduling, store queries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDailyWorkAction = isDailyWorkAction;
exports.handleDailyWorkAction = handleDailyWorkAction;
const file_search_1 = require("./file-search");
const store_context_1 = require("../memory2/store-context");
const gate_1 = require("../approval/gate");
/** Detect if message is a daily-work action */
function isDailyWorkAction(message) {
    return /tìm file|find file|gửi.*cho.*file|send.*file|tạo meeting|create meeting|tạo lịch|upload.*drive|lên drive|tìm.*rồi gửi/i.test(message) ||
        /raw là|bakudan ở|store nào|ở đâu|bakudan là|raw sushi bar ở/i.test(message) ||
        /maria là|hoang là|nguyên là|david là|ai là/i.test(message);
}
/** Handle a daily-work action, returns ActionResult or null */
async function handleDailyWorkAction(message) {
    const msg = message;
    // ── Store identity queries ──────────────────────────────────────────────
    if (/raw là|bakudan ở|store nào|ở đâu.*(?:raw|bakudan)|(?:raw|bakudan).*ở đâu|bakudan là|raw sushi bar là/i.test(msg)) {
        const answer = (0, store_context_1.answerStoreQuery)(msg);
        if (answer) {
            return { type: 'store-query', reply: answer, requires_approval: false, sources: ['federated-memory'] };
        }
    }
    // ── People identity queries ──────────────────────────────────────────────
    if (/maria là|hoang là|nguyên là|david là|ai là|who is/i.test(msg)) {
        const nameMatch = msg.match(/(?:ai là|who is|là ai)\s*([A-Za-zÀ-Ỹà-ỹ]+)/i) ||
            msg.match(/([A-Za-zÀ-Ỹà-ỹ]+)\s*(?:là ai|là gì|is who)/i);
        const name = nameMatch?.[1];
        if (name) {
            const person = (0, store_context_1.resolvePerson)(name);
            if (person) {
                return {
                    type: 'people-query',
                    reply: `👤 **${person.name}** — ${person.role}\nStores: ${person.stores.join(', ')}`,
                    requires_approval: false,
                    sources: ['federated-memory'],
                };
            }
        }
    }
    // ── File search ─────────────────────────────────────────────────────────
    if (/^(?:tìm|find|search)\s+(?:file|report|báo cáo)/i.test(msg.trim()) &&
        !/gửi|send|upload|for|cho/.test(msg)) {
        const query = msg.replace(/^(?:tìm|find|search)\s+(?:file|report|báo cáo)?\s*/i, '').trim();
        const files = (0, file_search_1.searchLocalFiles)(query, 5);
        const reply = (0, file_search_1.formatFileResults)(files, query);
        return { type: 'file-search', reply, requires_approval: false, sources: ['local-filesystem'] };
    }
    // ── Find file + send ────────────────────────────────────────────────────
    if (/tìm.*rồi gửi|find.*then send|gửi file.*cho|send.*file.*to/i.test(msg)) {
        // Extract file query
        const fileQueryMatch = msg.match(/(?:tìm|find)\s+(?:file\s+)?(.+?)(?:\s+rồi|\s+then|\s+và gửi|\s+and send)/i);
        const fileQuery = fileQueryMatch?.[1]?.trim() || '';
        // Extract recipient
        const recipientMatch = msg.match(/(?:gửi cho|send to|cho|for)\s+([A-Za-zÀ-Ỹà-ỹ@.]+)/i);
        const recipientRaw = recipientMatch?.[1] || '';
        // Security: check if recipient name is a person we know
        const person = (0, store_context_1.resolvePerson)(recipientRaw);
        const recipientName = person?.name || recipientRaw;
        // Find file
        const files = (0, file_search_1.searchLocalFiles)(fileQuery, 5);
        if (!Array.isArray(files) || files.length === 0) {
            return {
                type: 'find-and-send',
                reply: `Em không tìm thấy file "${fileQuery}". Anh mô tả cụ thể hơn nhé (ví dụ: tên file, loại file, tháng)?`,
                requires_approval: false,
                sources: ['local-filesystem'],
            };
        }
        // Ambiguous
        if (files.length > 1) {
            return {
                type: 'find-and-send',
                reply: `Em tìm thấy ${files.length} file liên quan đến "${fileQuery}":\n\n` +
                    files.map((f, i) => `${i + 1}. ${f.score}% — **${f.name}**\n   📂 ${f.path}`).join('\n') +
                    `\n\nAnh muốn gửi file nào cho ${recipientName}?`,
                requires_approval: false,
                sources: ['local-filesystem'],
                data: { files, recipient: recipientRaw, ambiguous: true },
            };
        }
        // Single file found
        const file = files[0];
        const blockCheck = (0, file_search_1.checkFileBlocked)(file.path);
        if (blockCheck.blocked) {
            return {
                type: 'find-and-send',
                reply: blockCheck.reason,
                requires_approval: false,
                sources: ['security-gate'],
            };
        }
        // No email for recipient?
        if (!person?.stores && !/@/.test(recipientRaw)) {
            return {
                type: 'find-and-send',
                reply: `Em tìm thấy file: **${file.name}** (${file.modified})\n\nNhưng em chưa có email của "${recipientRaw}". Anh cung cấp email để em tạo draft gửi nhé?`,
                requires_approval: false,
                sources: ['local-filesystem'],
                data: { file, recipient: recipientRaw, needs_email: true },
            };
        }
        // Create email draft action
        const approval = (0, gate_1.enqueue)({
            risk_level: 2,
            category: 'send-email',
            target: recipientRaw,
            description: `Send email to ${recipientName} with attachment: ${file.name}`,
            before_state: 'Email draft ready, not sent',
            rollback_plan: 'Email cannot be unsent — confirm before approving',
        });
        return {
            type: 'find-and-send',
            reply: [
                `📧 Email Draft Ready:`,
                `To: ${recipientName}`,
                `Attachment: **${file.name}** (${file.modified})`,
                `📂 ${file.path}`,
                ``,
                `→ Approval #${approval.id} required before sending`,
                `[Approve] [Edit] [Reject]`,
            ].join('\n'),
            requires_approval: true,
            approval_id: approval.id,
            sources: ['local-filesystem', 'email-action', 'approval-gate'],
        };
    }
    // ── Create calendar meeting ─────────────────────────────────────────────
    if (/tạo meeting|create meeting|schedule meeting|tạo lịch họp|đặt lịch họp/i.test(msg)) {
        const titleMatch = msg.match(/meeting\s+(?:với|with)?\s*([A-Za-zÀ-Ỹà-ỹ\s]+?)(?:\s+\d|\s+lúc|\s+at|\s+ngày|$)/i);
        const title = titleMatch?.[1]?.trim() || 'Meeting';
        const timeMatch = msg.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM|h))\b/);
        const timeStr = timeMatch?.[1] || '10:00AM';
        const dateStr = /ngày mai|mai|tomorrow/i.test(msg) ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        })() : new Date().toISOString().split('T')[0];
        const person = (0, store_context_1.resolvePerson)(msg);
        const attendeeStr = person ? ` với ${person.name}` : '';
        const approval = (0, gate_1.enqueue)({
            risk_level: 2,
            category: 'create-event',
            target: 'google-calendar',
            description: `Create meeting: "${title}"${attendeeStr} on ${dateStr} at ${timeStr}`,
            before_state: 'No event scheduled',
            rollback_plan: 'Delete/cancel event via Google Calendar',
        });
        return {
            type: 'create-event',
            reply: [
                `📆 Calendar Event Draft:`,
                `Title: ${title}${attendeeStr}`,
                `Date: ${dateStr} at ${timeStr}`,
                person ? `Attendee: ${person.name} (${person.role})` : '',
                ``,
                `→ Approval #${approval.id} required`,
                `[Approve] [Edit] [Reject]`,
            ].filter(Boolean).join('\n'),
            requires_approval: true,
            approval_id: approval.id,
            sources: ['calendar-action', 'approval-gate'],
        };
    }
    // ── Drive upload ────────────────────────────────────────────────────────
    if (/upload.*(?:drive|lên drive)|lên.*drive|put.*drive/i.test(msg)) {
        const queryMatch = msg.match(/upload\s+(.+?)\s+(?:lên|to)\s+drive|lên drive\s+(.+)/i);
        const query = queryMatch?.[1] || queryMatch?.[2] || '';
        if (!query) {
            return {
                type: 'upload-drive',
                reply: `Anh muốn upload file gì lên Drive? Cho em biết tên file cụ thể.`,
                requires_approval: false,
                sources: [],
            };
        }
        const files = (0, file_search_1.searchLocalFiles)(query, 3);
        if (!Array.isArray(files) || files.length === 0) {
            return {
                type: 'upload-drive',
                reply: `Em không tìm thấy file "${query}" để upload.`,
                requires_approval: false,
                sources: ['local-filesystem'],
            };
        }
        const file = files[0];
        const blockCheck = (0, file_search_1.checkFileBlocked)(file.path);
        if (blockCheck.blocked) {
            return { type: 'upload-drive', reply: blockCheck.reason, requires_approval: false, sources: ['security-gate'] };
        }
        const approval = (0, gate_1.enqueue)({
            risk_level: 2,
            category: 'upload-file',
            target: 'google-drive',
            description: `Upload "${file.name}" to Google Drive`,
            before_state: `File at ${file.path}`,
            rollback_plan: 'Delete uploaded file from Drive',
        });
        return {
            type: 'upload-drive',
            reply: [
                `☁️ Drive Upload Draft:`,
                `File: **${file.name}**`,
                `📂 ${file.path}`,
                `Modified: ${file.modified}`,
                ``,
                `→ Approval #${approval.id} required`,
                `[Approve] [Edit] [Reject]`,
            ].join('\n'),
            requires_approval: true,
            approval_id: approval.id,
            sources: ['local-filesystem', 'drive-action', 'approval-gate'],
        };
    }
    return null;
}
