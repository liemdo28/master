/**
 * Parse Vietnamese/English reminder commands into structured triggers.
 * "nhắc anh nghỉ sau 1 tiếng" → { type: 'once', delayMs: 3600000 }
 * "nhắc uống nước mỗi 2 tiếng" → { type: 'interval', intervalMs: 7200000 }
 * "nhắc anh lúc 9 giờ sáng" → { type: 'daily', hour: 9, minute: 0 }
 */

export interface ParsedReminder {
  message: string;
  type: 'once' | 'interval' | 'daily';
  delayMs?: number;
  intervalMs?: number;
  hour?: number;
  minute?: number;
  original: string;
}

function parseTime(value: string, unit: string): number {
  const n = parseFloat(value);
  const u = unit.toLowerCase();
  if (u.includes('giây') || u.includes('second')) return n * 1000;
  if (u.includes('phút') || u.includes('minute') || u.includes('min')) return n * 60_000;
  if (u.includes('tiếng') || u.includes('giờ') || u.includes('hour')) return n * 3_600_000;
  if (u.includes('ngày') || u.includes('day')) return n * 86_400_000;
  return n * 60_000; // default minutes
}

export function parseReminderCommand(text: string): ParsedReminder | null {
  const t = text;

  // Extract what to remind about — after command keyword
  const msgMatch = t.match(
    /nhắc(?:\s+anh)?\s+(.+?)(?:\s+(?:sau|mỗi|lúc|every|after|at)\s|$)/i
  ) || t.match(/remind(?:\s+me)?\s+(?:to\s+)?(.+?)(?:\s+(?:every|after|at|in)\s|$)/i);
  const message = msgMatch?.[1]?.trim() || extractDefaultMessage(t);

  // INTERVAL: "mỗi X tiếng/phút", "every X hours/minutes"
  const intervalMatch = t.match(
    /(?:mỗi|every)\s+([\d.,]+)\s*(tiếng|giờ|phút|giây|giây|hour|minute|min|second)/i
  );
  if (intervalMatch) {
    return {
      message, type: 'interval',
      intervalMs: parseTime(intervalMatch[1], intervalMatch[2]),
      original: text,
    };
  }

  // DAILY: "lúc X giờ", "at X am/pm", "hàng ngày lúc"
  const dailyMatch = t.match(
    /(?:lúc|at)\s+(\d{1,2})(?::(\d{2}))?\s*(?:giờ\s*)?(sáng|chiều|tối|am|pm)?/i
  );
  if (dailyMatch && (t.includes('hàng ngày') || t.includes('daily') || t.includes('every day') || t.includes('mỗi ngày'))) {
    let hour = parseInt(dailyMatch[1]);
    const minute = parseInt(dailyMatch[2] || '0');
    const period = dailyMatch[3]?.toLowerCase();
    if ((period === 'chiều' || period === 'tối' || period === 'pm') && hour < 12) hour += 12;
    return { message, type: 'daily', hour, minute, original: text };
  }

  // ONCE: "sau X tiếng/phút", "in X minutes/hours", "after X"
  const onceMatch = t.match(
    /(?:sau|in|after)\s+([\d.,]+)\s*(tiếng|giờ|phút|giây|hour|minute|min|second)/i
  );
  if (onceMatch) {
    return {
      message, type: 'once',
      delayMs: parseTime(onceMatch[1], onceMatch[2]),
      original: text,
    };
  }

  return null;
}

function extractDefaultMessage(text: string): string {
  // Remove command scaffolding
  return text
    .replace(/^(?:mi[,\s]+)?nhắc(?:\s+anh)?/i, '')
    .replace(/(?:sau|mỗi|lúc|every|after|at|in)\s+[\d.,]+\s*\w+/i, '')
    .trim() || 'Reminder';
}
