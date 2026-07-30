/**
 * WhatsApp Daily Summary — WS3
 *
 * Generates a morning briefing Mi can send via WhatsApp.
 * Called by scheduler or on demand: "/mi tóm tắt hôm nay"
 */

import { getDailySnapshot } from '../visibility/visibility-hub';
import { getPending } from '../approval/gate';

export interface DailySummary {
  text: string;
  generated_at: string;
  sources: string[];
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  } catch { return iso; }
}

export async function generateDailySummary(): Promise<DailySummary> {
  const sources: string[] = [];
  const parts: string[] = [];

  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  parts.push(`📋 *Mi Daily Brief — ${dateStr}*`);
  parts.push('');

  // Visibility snapshot
  try {
    const snap = await getDailySnapshot();
    sources.push('visibility-hub');

    if (snap.emails?.unread !== undefined) {
      parts.push(`📧 *Email:* ${snap.emails.unread} chưa đọc, ${snap.emails.important || 0} quan trọng`);
    }

    if (snap.calendar?.today_count !== undefined) {
      parts.push(`📅 *Lịch:* ${snap.calendar.today_count} sự kiện hôm nay`);
      if (snap.calendar.events_today?.length) {
        const evts = snap.calendar.events_today.slice(0, 3)
          .map((e: { title: string; start?: string }) => `  • ${e.title}${e.start ? ' lúc ' + formatTime(e.start) : ''}`)
          .join('\n');
        parts.push(evts);
      }
    }

    if (snap.tasks?.asana_my_tasks !== undefined) {
      parts.push(`✅ *Tasks:* ${snap.tasks.asana_my_tasks} tasks, ${snap.tasks.asana_overdue || 0} quá hạn`);
    }

    if (snap.action_items?.length > 0) {
      parts.push('');
      parts.push('⚠️ *Cần xử lý:*');
      for (const item of snap.action_items.slice(0, 5)) {
        parts.push(`  • ${item}`);
      }
    }
  } catch { /* non-blocking */ }

  // Pending approvals
  const pending = getPending();
  if (pending.length > 0) {
    parts.push('');
    parts.push(`🔐 *Chờ duyệt:* ${pending.length} action(s)`);
    for (const a of pending.slice(0, 3)) {
      parts.push(`  • [L${a.risk_level}] ${a.description.slice(0, 80)}`);
    }
  }

  parts.push('');
  parts.push('_Trả lời: /mi [câu hỏi] để hỏi Mi_');

  return {
    text: parts.join('\n'),
    generated_at: now.toISOString(),
    sources,
  };
}

// ── Action extraction from WhatsApp messages ───────────────────────────────

export interface ExtractedAction {
  type: 'task' | 'meeting' | 'reminder' | 'email' | 'approval';
  description: string;
  assignee?: string;
  due?: string;
  raw: string;
}

export function extractActionsFromMessage(text: string): ExtractedAction[] {
  const actions: ExtractedAction[] = [];
  const t = text.toLowerCase();

  // Task extraction
  if (/giao.*cho|assign.*to|tạo task|create task/i.test(text)) {
    const assigneeMatch = text.match(/cho\s+(\w+)|for\s+(\w+)|assign\s+(\w+)/i);
    const assignee = assigneeMatch?.[1] || assigneeMatch?.[2] || assigneeMatch?.[3];
    actions.push({
      type: 'task',
      description: text.replace(/\/mi\s*/i, '').trim(),
      assignee,
      raw: text,
    });
  }

  // Meeting extraction
  if (/tạo meeting|book meeting|schedule.*with|họp.*với/i.test(text)) {
    const personMatch = text.match(/với\s+(\w+)|with\s+(\w+)/i);
    const person = personMatch?.[1] || personMatch?.[2];
    actions.push({
      type: 'meeting',
      description: text.replace(/\/mi\s*/i, '').trim(),
      assignee: person,
      raw: text,
    });
  }

  // Reminder extraction
  if (/nhắc|remind/i.test(t) && /\d|phút|giờ|minute|hour/i.test(t)) {
    actions.push({
      type: 'reminder',
      description: text.replace(/\/mi\s*/i, '').trim(),
      raw: text,
    });
  }

  // Email extraction
  if (/gửi email|send email/i.test(t)) {
    const toMatch = text.match(/cho\s+(\w+)|to\s+(\w+)/i);
    actions.push({
      type: 'email',
      description: text.replace(/\/mi\s*/i, '').trim(),
      assignee: toMatch?.[1] || toMatch?.[2],
      raw: text,
    });
  }

  return actions;
}
