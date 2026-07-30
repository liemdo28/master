/**
 * Reminder Store — in-memory reminders with setTimeout execution.
 * Supports: one-shot, recurring (interval), daily (time-of-day).
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

export type ReminderType = 'once' | 'interval' | 'daily';

export interface Reminder {
  id: string;
  message: string;
  type: ReminderType;
  created_at: string;
  trigger_at?: string;        // ISO for 'once'/'daily'
  interval_ms?: number;       // for 'interval'
  next_trigger: string;       // ISO — always set
  fired_count: number;
  active: boolean;
}

export const reminderEvents = new EventEmitter();
const reminders = new Map<string, Reminder>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleTimer(r: Reminder) {
  clearExisting(r.id);
  const delay = new Date(r.next_trigger).getTime() - Date.now();
  if (delay < 0 && r.type === 'once') {
    // Already passed — fire immediately then remove
    fire(r);
    return;
  }
  const timer = setTimeout(() => fire(r), Math.max(delay, 0));
  timers.set(r.id, timer);
}

function fire(r: Reminder) {
  if (!r.active) return;
  r.fired_count += 1;
  reminderEvents.emit('reminder', r);

  if (r.type === 'once') {
    r.active = false;
    reminders.set(r.id, r);
    return;
  }

  if (r.type === 'interval' && r.interval_ms) {
    const next = new Date(Date.now() + r.interval_ms);
    r.next_trigger = next.toISOString();
    reminders.set(r.id, r);
    scheduleTimer(r);
  }

  if (r.type === 'daily' && r.trigger_at) {
    const next = new Date(r.next_trigger);
    next.setDate(next.getDate() + 1);
    r.next_trigger = next.toISOString();
    reminders.set(r.id, r);
    scheduleTimer(r);
  }
}

function clearExisting(id: string) {
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
}

export function createOnce(message: string, delayMs: number): Reminder {
  const trigger = new Date(Date.now() + delayMs);
  const r: Reminder = {
    id: uuid(), message, type: 'once',
    created_at: new Date().toISOString(),
    trigger_at: trigger.toISOString(),
    next_trigger: trigger.toISOString(),
    fired_count: 0, active: true,
  };
  reminders.set(r.id, r);
  scheduleTimer(r);
  return r;
}

export function createInterval(message: string, intervalMs: number): Reminder {
  const next = new Date(Date.now() + intervalMs);
  const r: Reminder = {
    id: uuid(), message, type: 'interval',
    created_at: new Date().toISOString(),
    interval_ms: intervalMs,
    next_trigger: next.toISOString(),
    fired_count: 0, active: true,
  };
  reminders.set(r.id, r);
  scheduleTimer(r);
  return r;
}

export function createDaily(message: string, hour: number, minute: number): Reminder {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const r: Reminder = {
    id: uuid(), message, type: 'daily',
    created_at: new Date().toISOString(),
    trigger_at: `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`,
    next_trigger: next.toISOString(),
    fired_count: 0, active: true,
  };
  reminders.set(r.id, r);
  scheduleTimer(r);
  return r;
}

export function cancelReminder(id: string): boolean {
  const r = reminders.get(id);
  if (!r) return false;
  r.active = false;
  clearExisting(id);
  reminders.set(id, r);
  return true;
}

export function listReminders(): Reminder[] {
  return [...reminders.values()].sort(
    (a, b) => new Date(a.next_trigger).getTime() - new Date(b.next_trigger).getTime()
  );
}

export function getActive(): Reminder[] {
  return listReminders().filter(r => r.active);
}
