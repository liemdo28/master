"use strict";
/**
 * Reminder Store — in-memory reminders with setTimeout execution.
 * Supports: one-shot, recurring (interval), daily (time-of-day).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderEvents = void 0;
exports.createOnce = createOnce;
exports.createInterval = createInterval;
exports.createDaily = createDaily;
exports.cancelReminder = cancelReminder;
exports.listReminders = listReminders;
exports.getActive = getActive;
const events_1 = require("events");
const uuid_1 = require("uuid");
exports.reminderEvents = new events_1.EventEmitter();
const reminders = new Map();
const timers = new Map();
function scheduleTimer(r) {
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
function fire(r) {
    if (!r.active)
        return;
    r.fired_count += 1;
    exports.reminderEvents.emit('reminder', r);
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
function clearExisting(id) {
    const t = timers.get(id);
    if (t) {
        clearTimeout(t);
        timers.delete(id);
    }
}
function createOnce(message, delayMs) {
    const trigger = new Date(Date.now() + delayMs);
    const r = {
        id: (0, uuid_1.v4)(), message, type: 'once',
        created_at: new Date().toISOString(),
        trigger_at: trigger.toISOString(),
        next_trigger: trigger.toISOString(),
        fired_count: 0, active: true,
    };
    reminders.set(r.id, r);
    scheduleTimer(r);
    return r;
}
function createInterval(message, intervalMs) {
    const next = new Date(Date.now() + intervalMs);
    const r = {
        id: (0, uuid_1.v4)(), message, type: 'interval',
        created_at: new Date().toISOString(),
        interval_ms: intervalMs,
        next_trigger: next.toISOString(),
        fired_count: 0, active: true,
    };
    reminders.set(r.id, r);
    scheduleTimer(r);
    return r;
}
function createDaily(message, hour, minute) {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now)
        next.setDate(next.getDate() + 1);
    const r = {
        id: (0, uuid_1.v4)(), message, type: 'daily',
        created_at: new Date().toISOString(),
        trigger_at: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        next_trigger: next.toISOString(),
        fired_count: 0, active: true,
    };
    reminders.set(r.id, r);
    scheduleTimer(r);
    return r;
}
function cancelReminder(id) {
    const r = reminders.get(id);
    if (!r)
        return false;
    r.active = false;
    clearExisting(id);
    reminders.set(id, r);
    return true;
}
function listReminders() {
    return [...reminders.values()].sort((a, b) => new Date(a.next_trigger).getTime() - new Date(b.next_trigger).getTime());
}
function getActive() {
    return listReminders().filter(r => r.active);
}
