/**
 * CEO Response Style — Jarvis personality for Liêm Đỗ
 * Rules:
 *   - Short. Direct. No fluff.
 *   - Vietnamese-first. English where clearer.
 *   - Confident, never robotic.
 *   - Never say "Use /agent" or explain commands.
 *   - "Em" = Mi. "Anh" = CEO.
 */

export type AssistantTone = 'normal' | 'approval' | 'clarify' | 'status' | 'alert' | 'done';

// ── Core reply builder ────────────────────────────────────────────────────

export function styleReply(lines: string[], _tone: AssistantTone = 'normal'): string {
  const clean = lines.map(l => l.trim()).filter(Boolean);
  if (!clean.length) return 'Em đây.';
  return clean.join('\n');
}

// ── Greeting variants ─────────────────────────────────────────────────────

const GREETING_LINES = [
  'Em đây anh.',
  'Em nghe anh. Nói em biết anh cần gì.',
  'Em đang trực đây anh.',
  'Em đây. Anh nói, em bám việc ngay.',
];

export function greetingReply(systemSnapshot?: { nodes?: number; pending?: number; alerts?: number }): string {
  const base = GREETING_LINES[Math.floor(Date.now() / 60000) % GREETING_LINES.length];
  if (!systemSnapshot) return base;

  const parts: string[] = [base];
  if (systemSnapshot.alerts && systemSnapshot.alerts > 0) {
    parts.push(`⚠️ ${systemSnapshot.alerts} cảnh báo đang chờ.`);
  } else if (systemSnapshot.pending && systemSnapshot.pending > 0) {
    parts.push(`📋 ${systemSnapshot.pending} approval đang pending.`);
  } else {
    parts.push('Hệ thống đang yên. Em sẵn sàng check sâu nếu anh cần.');
  }
  return parts.join(' ');
}

// ── Status reply helpers ──────────────────────────────────────────────────

export function statusReply(subject: string, status: string, detail?: string): string {
  const icon = /online|ok|healthy|good|active|running|chay/i.test(status) ? '✅' :
               /offline|down|error|fail|loi/i.test(status) ? '🔴' : '🟡';
  const lines = [`${icon} *${subject}*: ${status}`];
  if (detail) lines.push(detail);
  return lines.join('\n');
}

export function shortJson(value: unknown, max = 700): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

export function statusWord(value: any): string {
  if (!value) return 'không rõ';
  if (value.error) return `lỗi: ${String(value.error).slice(0, 80)}`;
  if (value.status) return String(value.status);
  if (value.endpoint) return String(value.endpoint);
  if (value.ok === true) return 'healthy';
  if (value.ok === false) return 'offline';
  return 'unknown';
}

// ── Approval-style reply ──────────────────────────────────────────────────

export function approvalReply(action: string, id: string): string {
  return [
    `⚠️ *Anh xác nhận cho em không?*`,
    ``,
    `Action: ${action}`,
    `ID: ${id}`,
    ``,
    `Anh reply *approve ${id}* để xác nhận, hoặc *cancel* để bỏ.`,
  ].join('\n');
}

// ── Done reply ────────────────────────────────────────────────────────────

export function doneReply(what: string): string {
  return `✅ ${what}`;
}

// ── Clarify reply ─────────────────────────────────────────────────────────

export function clarifyReply(context?: string): string {
  if (context) return `Em chưa bắt chắc ý anh về "${context.slice(0, 40)}". Anh thêm một chi tiết nữa, em xử lý đúng hướng.`;
  return 'Em chưa bắt đúng ý câu này. Anh nói thêm một chút: anh muốn em check hệ thống, project, dashboard, cửa hàng, hay giao việc?';
}

// ── Alert format ──────────────────────────────────────────────────────────

export function alertReply(level: 'critical' | 'warning' | 'info', title: string, body: string): string {
  const icon = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : 'ℹ️';
  return [`${icon} *${title}*`, '', body].join('\n');
}
