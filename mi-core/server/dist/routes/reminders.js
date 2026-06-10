"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remindersRouter = void 0;
const express_1 = require("express");
const reminder_store_1 = require("../reminders/reminder-store");
const reminder_parser_1 = require("../reminders/reminder-parser");
exports.remindersRouter = (0, express_1.Router)();
exports.remindersRouter.get('/', (_req, res) => {
    res.json((0, reminder_store_1.listReminders)());
});
exports.remindersRouter.get('/active', (_req, res) => {
    res.json((0, reminder_store_1.getActive)());
});
// Natural language command: POST /api/reminders/parse { text: "nhắc anh nghỉ sau 1 tiếng" }
exports.remindersRouter.post('/parse', (req, res) => {
    const { text } = req.body;
    if (!text)
        return res.status(400).json({ error: 'text required' });
    const parsed = (0, reminder_parser_1.parseReminderCommand)(text);
    if (!parsed)
        return res.status(422).json({ error: 'Không parse được reminder. Thử: "nhắc anh nghỉ sau 1 tiếng"' });
    let reminder;
    if (parsed.type === 'once' && parsed.delayMs) {
        reminder = (0, reminder_store_1.createOnce)(parsed.message, parsed.delayMs);
    }
    else if (parsed.type === 'interval' && parsed.intervalMs) {
        reminder = (0, reminder_store_1.createInterval)(parsed.message, parsed.intervalMs);
    }
    else if (parsed.type === 'daily' && parsed.hour !== undefined && parsed.minute !== undefined) {
        reminder = (0, reminder_store_1.createDaily)(parsed.message, parsed.hour, parsed.minute);
    }
    else {
        return res.status(422).json({ error: 'Thiếu thông tin thời gian' });
    }
    res.status(201).json({ reminder, parsed });
});
// Direct create
exports.remindersRouter.post('/', (req, res) => {
    const { type, message, delay_ms, interval_ms, hour, minute } = req.body;
    if (!type || !message)
        return res.status(400).json({ error: 'type, message required' });
    let reminder;
    if (type === 'once' && delay_ms)
        reminder = (0, reminder_store_1.createOnce)(message, delay_ms);
    else if (type === 'interval' && interval_ms)
        reminder = (0, reminder_store_1.createInterval)(message, interval_ms);
    else if (type === 'daily' && hour !== undefined && minute !== undefined)
        reminder = (0, reminder_store_1.createDaily)(message, hour, minute);
    else
        return res.status(400).json({ error: 'Invalid params for type' });
    res.status(201).json(reminder);
});
exports.remindersRouter.delete('/:id', (req, res) => {
    const ok = (0, reminder_store_1.cancelReminder)(req.params.id);
    if (!ok)
        return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
});
