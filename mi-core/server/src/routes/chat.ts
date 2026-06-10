import { Router, Request, Response } from 'express';
import { WebSocket } from 'ws';
import { ownerProfile } from '../services/owner-profile';
import { askAi } from '../services/ai-client';
import { parseIntent, buildSystemPrompt, buildMessages } from '../services/mi-brain';
import { generateBriefing } from '../connectors/briefing-engine';
import { getProjectsWithIssues } from '../connectors/project-connector';
import { searchFiles } from '../connectors/pc-connector';
import { getPending } from '../approval/gate';
import { parseReminderCommand } from '../reminders/reminder-parser';
import { createOnce, createInterval, createDaily } from '../reminders/reminder-store';
import { executiveMemory } from '../memory/executive-memory';
import { runPipeline } from '../pipeline/response-pipeline';

export const chatRouter = Router();

// In-memory session history (per conversation session)
const sessions = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

function getHistory(sessionId: string) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  return sessions.get(sessionId)!;
}

chatRouter.post('/', async (req: Request, res: Response) => {
  const { message, session_id = 'default' } = req.body as { message: string; session_id?: string };
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  try {
    const result = await processMessage(message, session_id);
    res.json(result);
  } catch (e) {
    console.error('[Mi Chat]', e);
    res.status(500).json({ error: 'Mi gặp lỗi, anh thử lại nhé.' });
  }
});

chatRouter.delete('/history/:sessionId', (req: Request, res: Response) => {
  sessions.delete(req.params.sessionId);
  res.json({ ok: true });
});

export async function handleWsChat(ws: WebSocket, msg: { message: string; session_id?: string }) {
  const { message, session_id = 'default' } = msg;
  if (!message?.trim()) {
    ws.send(JSON.stringify({ type: 'error', message: 'message required' }));
    return;
  }
  try {
    const result = await processMessage(message, session_id);
    ws.send(JSON.stringify({ type: 'response', ...result }));
  } catch (e) {
    ws.send(JSON.stringify({ type: 'error', message: 'Mi gặp lỗi, anh thử lại nhé.' }));
  }
}

async function processMessage(message: string, sessionId: string) {
  const history = getHistory(sessionId);

  // ── FAST PATH: Daily Work Actions (file/email/calendar/task/drive/store queries) ──
  // These go directly to the pipeline which handles them with the action layer.
  // Skip old intent routing for these.
  const isActionMessage = /tìm file|find file|tìm.*rồi gửi|gửi file.*cho|find.*then send|send.*file|upload.*drive|lên drive|tạo meeting|create meeting|tạo lịch họp|raw là|bakudan ở|store nào|ở đâu.*(?:raw|bakudan)|(?:raw|bakudan).*ở đâu/i.test(message);

  if (isActionMessage) {
    const pipelineOut = await runPipeline({ message, mode: 'ceo', history, intent: 'action' });
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: pipelineOut.reply });
    if (history.length > 40) history.splice(0, 2);
    return { reply: pipelineOut.reply, intent: 'action', mode: 'ceo', model: pipelineOut.model, sources: pipelineOut.sources };
  }

  const intent = parseIntent(message);

  // Reminder
  if (intent.type === 'reminder') {
    const parsed = parseReminderCommand(message);
    if (!parsed) {
      return { reply: 'Anh cho em biết cụ thể hơn nhé? Ví dụ: "nhắc anh nghỉ sau 1 tiếng" hoặc "nhắc uống nước mỗi 2 tiếng".', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    let reminder;
    if (parsed.type === 'once' && parsed.delayMs) reminder = createOnce(parsed.message, parsed.delayMs);
    else if (parsed.type === 'interval' && parsed.intervalMs) reminder = createInterval(parsed.message, parsed.intervalMs);
    else if (parsed.type === 'daily' && parsed.hour !== undefined && parsed.minute !== undefined) reminder = createDaily(parsed.message, parsed.hour, parsed.minute);
    if (!reminder) {
      return { reply: 'Em chưa parse được thời gian. Anh thử lại nhé.', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    const timeDesc = parsed.type === 'once'
      ? `sau ${Math.round((parsed.delayMs || 0) / 60000)} phút`
      : parsed.type === 'interval'
      ? `mỗi ${Math.round((parsed.intervalMs || 0) / 60000)} phút`
      : `hàng ngày lúc ${parsed.hour}:${String(parsed.minute).padStart(2,'0')}`;
    return {
      reply: `Dạ, em sẽ nhắc anh "${parsed.message}" ${timeDesc}. ✓`,
      intent: intent.type, mode: intent.mode, model: 'built-in', reminder,
    };
  }

  // Handle workspace commands with real data
  if (intent.type === 'briefing') {
    const { briefing, data } = await generateBriefing();
    return { reply: briefing, intent: intent.type, mode: intent.mode, model: 'briefing-engine', data };
  }

  if (intent.type === 'project_issues') {
    const issues = getProjectsWithIssues();
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
    const results = searchFiles(q);
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
    const pending = getPending();
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
    const profile = executiveMemory.getOwnerProfile();
    const summary = executiveMemory.summarizeOwnerProfile();
    return {
      reply: `Đây là profile của anh:\n\n${summary}\n\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\``,
      intent: intent.type, mode: intent.mode, model: 'executive-memory',
    };
  }

  // ── VISIBILITY INTENTS ──────────────────────────────────────────────────────
  if (intent.type === 'visibility_daily') {
    const { getDailySnapshot } = await import('../visibility/visibility-hub');
    try {
      const snapshot = await getDailySnapshot();
      const lines = [
        `📅 ${snapshot.date}`,
        snapshot.emails?.unread !== undefined ? `📧 Gmail: ${snapshot.emails.unread} unread` : `📧 Gmail: ${snapshot.emails?.status || 'not configured'}`,
        snapshot.calendar?.today_count !== undefined ? `📆 Calendar: ${snapshot.calendar.today_count} events` : `📆 Calendar: ${snapshot.calendar?.status || 'not configured'}`,
        snapshot.tasks?.asana_my_tasks !== undefined ? `✅ Asana: ${snapshot.tasks.asana_my_tasks} tasks` : `✅ Asana: ${snapshot.tasks?.asana_status || 'not configured'}`,
      ].join('\n');
      return { reply: lines, intent: intent.type, mode: intent.mode, model: 'built-in' };
    } catch {
      return { reply: 'Không thể tạo daily snapshot — visibility connector chưa sync.', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
  }

  if (intent.type === 'visibility_overdue') {
    const { getOverdueTasksAll } = await import('../visibility/visibility-hub');
    const overdue = getOverdueTasksAll();
    const asanaTasks = overdue.asana || [];
    if (asanaTasks.length > 0) {
      const lines = asanaTasks.map((t: { name: string; is_overdue: boolean; due_on?: string }) =>
        `• ${t.name} ${t.is_overdue ? '(OVERDUE)' : `(due ${t.due_on || 'no date'})`}`
      ).join('\n');
      return { reply: `Có ${asanaTasks.length} task đang overdue:\n\n${lines}`, intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    return { reply: 'Không có task overdue nào. ✓', intent: intent.type, mode: intent.mode, model: 'built-in' };
  }

  if (intent.type === 'visibility_email') {
    const { getImportantEmailsAll } = await import('../visibility/visibility-hub');
    const emails = getImportantEmailsAll(10);
    if (emails.gmail && emails.gmail.length > 0) {
      const lines = emails.gmail.map((e: { subject: string; from: string; is_important?: boolean }) =>
        `• ${e.is_important ? '⭐ ' : ''}${e.subject} — từ ${e.from}`
      ).join('\n');
      return { reply: `Có ${emails.gmail.length} email quan trọng:\n\n${lines}`, intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    return { reply: 'Gmail connector chưa cấu hình — set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env để kết nối.', intent: intent.type, mode: intent.mode, model: 'built-in' };
  }

  if (intent.type === 'visibility_calendar') {
    // If message is about CREATING an event, route to pipeline (action layer)
    if (/t.o|create|schedule|meeting|l.ch h.p|\bm.i\b/i.test(message)) {
      const pipelineOut = await runPipeline({ message, mode: intent.mode, history, intent: intent.type });
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: pipelineOut.reply });
      if (history.length > 40) history.splice(0, 2);
      return { reply: pipelineOut.reply, intent: intent.type, mode: intent.mode, model: pipelineOut.model, sources: pipelineOut.sources };
    }
    const { getTodayEventsAll } = await import('../visibility/visibility-hub');
    const events = getTodayEventsAll();
    if (events.calendar && events.calendar.length > 0) {
      const lines = events.calendar.map((e: { title: string; start: string }) => {
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
      const pipelineOut = await runPipeline({ message, mode: intent.mode, history, intent: intent.type });
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: pipelineOut.reply });
      if (history.length > 40) history.splice(0, 2);
      return { reply: pipelineOut.reply, intent: intent.type, mode: intent.mode, model: pipelineOut.model, sources: pipelineOut.sources };
    }
    return { reply: 'Dashboard connector đang check trạng thái — sẽ show qua pipeline response.', intent: intent.type, mode: intent.mode, model: 'built-in' };
  }

  if (intent.type === 'visibility_health') {
    const { hasHealthExport, getHealthSummaryText } = await import('../visibility/connectors/health/health-connector');
    if (hasHealthExport()) {
      return { reply: getHealthSummaryText(), intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    return { reply: 'Huawei Health export chưa cấu hình — export JSON từ Huawei Health app vào .local-agent-global/visibility/health/export/', intent: intent.type, mode: intent.mode, model: 'built-in' };
  }

  // ── KNOWLEDGE FEDERATION INTENTS ────────────────────────────────────────────
  // These are handled via getFederatedContext() in the pipeline — fall through below

  if (intent.type === 'visibility_connector_status') {
    const { getPlatformHealth } = await import('../visibility/visibility-hub');
    const health = getPlatformHealth();
    const lines = ['🔌 Connector Health Board', ''];
    for (const c of health) {
      const icon = c.health === 'healthy' ? '✓' : c.health === 'degraded' ? '⚠' : c.health === 'offline' ? '✗' : '○';
      const status = c.auth === 'connected' ? c.health : c.auth;
      lines.push(`  ${icon} ${c.name}: ${status}`);
      if (c.setup_hint) lines.push(`    → ${c.setup_hint}`);
    }
    return { reply: lines.join('\n'), intent: intent.type, mode: intent.mode, model: 'built-in' };
  }

  // ── PROJECT CONNECTOR / TASK / POST — route to pipeline ──────────────────
  if (/tạo task|create task|giao task|giao việc.*(?:maria|hoang|nguyên|nguyen)|task.*for.*(?:maria|hoang|nguyên|nguyen)|schedule.*post|lên lịch.*post|seo.*post/i.test(message)) {
    const pipelineOut = await runPipeline({ message, mode: intent.mode, history, intent: intent.type });
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: pipelineOut.reply });
    if (history.length > 40) history.splice(0, 2);
    return { reply: pipelineOut.reply, intent: intent.type, mode: intent.mode, model: pipelineOut.model, sources: pipelineOut.sources };
  }

  if (intent.type === 'health_view') {
    const health = executiveMemory.getPersonalContext();
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
      result = executiveMemory.deleteSensitiveMemory();
      return { reply: 'Dạ, em đã xóa toàn bộ thông tin sức khỏe/personal của anh rồi.', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
    // Extract specific key from message via AI
    const extractPrompt = `Owner nói: "${message}". Họ muốn xóa preference/memory nào? Trả về JSON: { "category": "preferences|decisions|workflows", "key": "tên field cụ thể hoặc null nếu xóa toàn bộ" }. Chỉ JSON.`;
    const aiRes = await askAi([{ role: 'user', content: extractPrompt }]);
    try {
      const parsed = JSON.parse(aiRes.text.replace(/```json?\n?|```/g, '').trim());
      result = executiveMemory.forget(parsed.category, parsed.key || undefined);
      return { reply: `Dạ, em đã quên rồi: ${result.message}`, intent: intent.type, mode: intent.mode, model: aiRes.model };
    } catch {
      return { reply: 'Anh muốn em quên thông tin gì cụ thể vậy? Ví dụ: "quên preference trả lời ngắn"', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
  }

  // Memory save — V2 with preference detection
  if (intent.type === 'memory_save') {
    const extractPrompt = `Owner nói: "${message}"
Trích xuất thông tin cần lưu. Trả về JSON: { "category": "preferences|profile|business|decisions|workflows|personal", "key": "...", "value": "...", "needs_consent": false }
Nếu liên quan sức khỏe/y tế, needs_consent = true.
Chỉ JSON.`;
    const aiRes = await askAi([{ role: 'user', content: extractPrompt }]);
    try {
      const parsed = JSON.parse(aiRes.text.replace(/```json?\n?|```/g, '').trim());
      const result = executiveMemory.remember(parsed.category, parsed.key, parsed.value, parsed.needs_consent);
      const consentNote = parsed.needs_consent ? ' (có consent log)' : '';
      return { reply: `Dạ, em đã nhớ rồi${consentNote}: "${parsed.key}" = "${parsed.value}" → ${parsed.category}`, intent: intent.type, mode: intent.mode, model: aiRes.model };
    } catch {
      return { reply: 'Anh cho em biết cụ thể cần nhớ điều gì nhé?', intent: intent.type, mode: intent.mode, model: 'built-in' };
    }
  }

  // General chat — run through full pipeline (Memory + KB + Visibility + AI)
  const pipelineOut = await runPipeline({ message, mode: intent.mode, history, intent: intent.type });

  // Update session history
  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: pipelineOut.reply });
  if (history.length > 40) history.splice(0, 2);

  return {
    reply: pipelineOut.reply,
    intent: intent.type,
    mode: intent.mode,
    model: pipelineOut.model,
    sources: pipelineOut.sources,
    kb_hits: pipelineOut.kb_hits,
  };
}
