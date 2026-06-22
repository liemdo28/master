import { Router, Request, Response } from 'express';
import {
  createOnce, createInterval, createDaily,
  cancelReminder, listReminders, getActive,
} from '../reminders/reminder-store';
import { parseReminderCommand } from '../reminders/reminder-parser';

export const remindersRouter = Router();

remindersRouter.get('/', (_req: Request, res: Response) => {
  res.json(listReminders());
});

remindersRouter.get('/active', (_req: Request, res: Response) => {
  res.json(getActive());
});

// Natural language command: POST /api/reminders/parse { text: "nhắc anh nghỉ sau 1 tiếng" }
remindersRouter.post('/parse', (req: Request, res: Response) => {
  const { text } = req.body as { text: string };
  if (!text) return res.status(400).json({ error: 'text required' });

  const parsed = parseReminderCommand(text);
  if (!parsed) return res.status(422).json({ error: 'Không parse được reminder. Thử: "nhắc anh nghỉ sau 1 tiếng"' });

  let reminder;
  if (parsed.type === 'once' && parsed.delayMs) {
    reminder = createOnce(parsed.message, parsed.delayMs);
  } else if (parsed.type === 'interval' && parsed.intervalMs) {
    reminder = createInterval(parsed.message, parsed.intervalMs);
  } else if (parsed.type === 'daily' && parsed.hour !== undefined && parsed.minute !== undefined) {
    reminder = createDaily(parsed.message, parsed.hour, parsed.minute);
  } else {
    return res.status(422).json({ error: 'Thiếu thông tin thời gian' });
  }

  res.status(201).json({ reminder, parsed });
});

// Direct create
remindersRouter.post('/', (req: Request, res: Response) => {
  const { type, message, delay_ms, interval_ms, hour, minute } = req.body as {
    type: string; message: string;
    delay_ms?: number; interval_ms?: number; hour?: number; minute?: number;
  };
  if (!type || !message) return res.status(400).json({ error: 'type, message required' });

  let reminder;
  if (type === 'once' && delay_ms) reminder = createOnce(message, delay_ms);
  else if (type === 'interval' && interval_ms) reminder = createInterval(message, interval_ms);
  else if (type === 'daily' && hour !== undefined && minute !== undefined) reminder = createDaily(message, hour, minute);
  else return res.status(400).json({ error: 'Invalid params for type' });

  res.status(201).json(reminder);
});

remindersRouter.delete('/:id', (req: Request, res: Response) => {
  const ok = cancelReminder(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});
