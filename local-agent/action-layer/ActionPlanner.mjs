/**
 * ActionPlanner.mjs
 * Converts CEO natural language intent into action plans.
 * Intent → targets → action draft → approval gate → execute
 */

import { FileActionService }     from './FileActionService.mjs';
import { EmailActionService }    from './EmailActionService.mjs';
import { CalendarActionService } from './CalendarActionService.mjs';
import { DriveActionService }    from './DriveActionService.mjs';
import { AsanaActionService }    from './AsanaActionService.mjs';
import { DashboardActionService } from './DashboardActionService.mjs';
import { WebsiteActionService }  from './WebsiteActionService.mjs';
import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';
import { auditLog }              from './ActionAuditLog.mjs';

/**
 * Primary entry point: plan an action from CEO message.
 * Returns { action_type, result, requires_approval, formatted_response }
 */
export async function planAction(message, context = {}) {
  const msg = message.toLowerCase().trim();
  const { resolvedContact, resolvedStore, resolvedFile } = context;

  // ── File operations ──────────────────────────────────────────────────────
  if (/tìm file|find file|search file|tìm báo cáo|find report/i.test(message)) {
    const query = extractFileQuery(message);
    const result = FileActionService.findFile(query);
    return { action_type: 'find-file', result, requires_approval: false,
      formatted_response: formatFileSearchResult(result, query) };
  }

  // Find file + send to someone
  if (/tìm.*rồi gửi|find.*then send|gửi file.*cho|send.*to/i.test(message)) {
    const query = extractFileQuery(message);
    const recipientRaw = extractRecipient(message);
    const recipient = resolvedContact || { email: recipientRaw, name: recipientRaw };

    if (!recipient?.email && !recipient?.name) {
      return { action_type: 'find-and-send', result: null, requires_approval: false,
        formatted_response: `Anh muốn gửi cho ai? Em chưa tìm thấy thông tin liên hệ. Vui lòng cung cấp email.` };
    }

    const result = await EmailActionService.findAndSend(query, recipient);
    return { action_type: 'find-and-send', result, requires_approval: true,
      formatted_response: result.formatted || result.message || JSON.stringify(result) };
  }

  // ── Email operations ─────────────────────────────────────────────────────
  if (/gửi email|send email|compose email|viết email/i.test(message)) {
    const recipient = resolvedContact || extractRecipientInfo(message);
    const subject = extractSubject(message) || 'Message from Mi';
    const body = extractBody(message) || '';

    if (!recipient?.email) {
      return { action_type: 'send-email', result: null, requires_approval: false,
        formatted_response: `Anh muốn gửi cho ai? Vui lòng cung cấp tên hoặc email người nhận.` };
    }

    const draft = EmailActionService.draftEmail({ to: recipient.email, to_name: recipient.name, subject, body });
    if (draft.blocked) return { action_type: 'send-email', result: draft, requires_approval: false, formatted_response: draft.reason };
    const queued = EmailActionService.queueSend(draft);
    return { action_type: 'send-email', result: queued, requires_approval: true, formatted_response: queued.formatted };
  }

  // ── Calendar operations ──────────────────────────────────────────────────
  if (/tạo meeting|create meeting|schedule meeting|tạo lịch|đặt lịch|create event/i.test(message)) {
    const title = extractEventTitle(message);
    const time  = extractTime(message);
    const date  = extractDate(message);
    const attendees = resolvedContact?.email ? [resolvedContact.email] : extractEmails(message);

    const result = CalendarActionService.createEvent({ title, date, time, attendees });
    return { action_type: 'create-event', result, requires_approval: true,
      formatted_response: result.preview + '\n\n' + result.formatted };
  }

  // ── Task creation ────────────────────────────────────────────────────────
  if (/tạo task|create task|giao task|giao việc|add task/i.test(message)) {
    const title    = extractTaskTitle(message);
    const assignee = resolvedContact?.name || extractPersonName(message);
    const due_date = extractDueDate(message);
    const store    = resolvedStore?.id;

    // Dashboard task (with store context) or Asana?
    const platform = resolvedStore ? 'dashboard' : 'asana';
    const result = platform === 'dashboard'
      ? DashboardActionService.createTask({ title, assignee, due_date, store: store || 'general' })
      : AsanaActionService.createTask({ title, assignee, due_date });

    return { action_type: 'create-task', result, requires_approval: true,
      formatted_response: result.preview + '\n\n' + result.formatted };
  }

  // ── Drive upload ─────────────────────────────────────────────────────────
  if (/upload.*drive|lên drive|put.*drive|tải lên drive/i.test(message)) {
    const query  = extractFileQuery(message);
    const found  = FileActionService.findLatest(query);
    if (!found) return { action_type: 'upload-drive', result: null, requires_approval: false,
      formatted_response: `Em không tìm thấy file "${query}" để upload.` };
    const result = DriveActionService.uploadFile(found.path);
    return { action_type: 'upload-drive', result, requires_approval: true,
      formatted_response: result.formatted || result.reason };
  }

  // ── Content scheduling ───────────────────────────────────────────────────
  if (/lên lịch post|schedule post|đăng bài|create post|tạo post/i.test(message)) {
    const business = resolvedStore?.id || (/raw|sushi/i.test(message) ? 'raw-sushi' : 'bakudan');
    const topic = extractTopic(message);
    const result = WebsiteActionService.createDraft({ business, type: 'social-post', topic });
    return { action_type: 'schedule-post', result, requires_approval: true,
      formatted_response: result.preview + '\n\n' + result.formatted };
  }

  // ── No action matched ────────────────────────────────────────────────────
  return null;
}

export function getPendingActions() {
  return ApprovalRequiredAction.getPending();
}

export function approveAction(actionId) {
  return ApprovalRequiredAction.approve(actionId);
}

export function rejectAction(actionId, reason) {
  return ApprovalRequiredAction.reject(actionId, reason);
}

// ── NLP helpers ─────────────────────────────────────────────────────────────

function extractFileQuery(msg) {
  const m = msg.match(/(?:tìm|find|search|gửi)\s+(?:file|report|báo cáo)?\s*[""']?([^""'\n,]+)[""']?(?:\s+rồi|\s+và|\s+then|$)/i);
  return m ? m[1].trim() : msg.replace(/^.*(?:tìm|find|search)\s*/i, '').split(/\s+(?:cho|for|to|rồi)\s+/i)[0].trim();
}

function extractRecipient(msg) {
  const m = msg.match(/(?:gửi\s+cho|send\s+to|for)\s+([A-ZÀ-Ỹa-zà-ỹ]+)/i);
  return m ? m[1] : null;
}

function extractRecipientInfo(msg) {
  const emailM = msg.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailM) return { email: emailM[0], name: '' };
  const nameM = msg.match(/(?:cho|to|for)\s+([A-ZÀ-Ỹa-zà-ỹ][a-zà-ỹ]+)/i);
  return nameM ? { email: null, name: nameM[1] } : null;
}

function extractSubject(msg) {
  const m = msg.match(/subject[:\s]+["']?([^"'\n]+)["']?/i);
  return m ? m[1].trim() : null;
}

function extractBody(msg) {
  const m = msg.match(/body[:\s]+["']?([^"'\n]+)["']?/i);
  return m ? m[1].trim() : null;
}

function extractEventTitle(msg) {
  return msg
    .replace(/tạo meeting|create meeting|schedule meeting|tạo lịch|đặt lịch|create event/gi, '')
    .replace(/\b(với|with|cho|for|at|vào|lúc|ngày mai|tomorrow|2pm|3pm|\d+am|\d+pm)\b.*/gi, '')
    .trim() || 'Meeting';
}

function extractTime(msg) {
  const m = msg.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))\b/);
  return m ? m[1] : '10:00AM';
}

function extractDate(msg) {
  if (/ngày mai|mai|tomorrow/i.test(msg)) return 'tomorrow';
  const m = msg.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : 'tomorrow';
}

function extractEmails(msg) {
  return (msg.match(/[\w.-]+@[\w.-]+\.\w+/g) || []);
}

function extractTaskTitle(msg) {
  return msg
    .replace(/tạo task|create task|giao task|giao việc|add task/gi, '')
    .replace(/\b(cho|for|to)\s+\w+/gi, '')
    .replace(/\b(by|due|hạn)\s+.*/gi, '')
    .trim() || 'New Task';
}

function extractPersonName(msg) {
  const m = msg.match(/(?:cho|for|to|giao cho|assign to)\s+([A-ZÀ-Ỹa-zà-ỹ]+)/i);
  return m ? m[1] : null;
}

function extractDueDate(msg) {
  if (/ngày mai|tomorrow/i.test(msg)) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  const m = msg.match(/(?:by|due|hạn)\s+(?:friday|thứ\s*6)/i);
  if (m) {
    const d = new Date(); const day = d.getDay();
    d.setDate(d.getDate() + (5 - day + 7) % 7 || 7);
    return d.toISOString().split('T')[0];
  }
  const dateM = msg.match(/\d{1,2}\/\d{1,2}/);
  if (dateM) {
    const [mo, dy] = dateM[0].split('/').map(Number);
    return `${new Date().getFullYear()}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
  }
  return null;
}

function extractTopic(msg) {
  const m = msg.match(/(?:về|about|topic|chủ đề)\s+(.+?)(?:\s+cho|\s+for|$)/i);
  return m ? m[1].trim() : null;
}

function formatFileSearchResult(result, query) {
  if (result.status !== 'ok' || result.count === 0) {
    return `Em không tìm thấy file nào liên quan đến "${query}". Anh muốn tìm trong thư mục cụ thể nào không?`;
  }
  const lines = [`📁 Tìm thấy ${result.count} file cho "${query}":\n`];
  for (const f of result.files) {
    lines.push(`${f.score}% match — **${f.name}**\n  📂 ${f.path}\n  📅 Sửa: ${f.modified}`);
  }
  if (result.count === 1) {
    lines.push(`\nAnh có muốn em gửi file này không? Cho em biết người nhận.`);
  }
  return lines.join('\n');
}
