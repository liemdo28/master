/**
 * Google Calendar Connector — reads today's + upcoming events.
 * Read-only. Caches to .local-agent-global/visibility/google-calendar/
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { getAuthedClient } from './google-auth';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'google-calendar');

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  calendar: string;
  is_all_day: boolean;
  attendees: string[];
  status: string;
}

export interface CalendarSnapshot {
  synced_at: string;
  today: string;
  events_today: CalendarEvent[];
  events_upcoming: CalendarEvent[];   // next 7 days
  calendars: string[];
}

export async function syncCalendar(): Promise<CalendarSnapshot> {
  const auth = await getAuthedClient();
  const cal = google.calendar({ version: 'v3', auth });

  // Get calendar list
  const calList = await cal.calendarList.list();
  const calendars = calList.data.items?.map(c => c.summary || '') || [];
  const calMap: Record<string, string> = {};
  for (const c of calList.data.items || []) {
    if (c.id && c.summary) calMap[c.id] = c.summary;
  }

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

  const allEvents: CalendarEvent[] = [];

  // Fetch from each calendar
  for (const calItem of calList.data.items || []) {
    if (calItem.selected === false) continue;
    try {
      const eventsRes = await cal.events.list({
        calendarId: calItem.id!,
        timeMin: todayStart.toISOString(),
        timeMax: weekEnd.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });

      for (const e of eventsRes.data.items || []) {
        const isAllDay = !e.start?.dateTime;
        allEvents.push({
          id: e.id || '',
          title: e.summary || '(no title)',
          start: e.start?.dateTime || e.start?.date || '',
          end: e.end?.dateTime || e.end?.date || '',
          location: e.location ?? undefined,
          description: e.description?.slice(0, 300) ?? undefined,
          calendar: calMap[calItem.id!] || calItem.id!,
          is_all_day: isAllDay,
          attendees: (e.attendees || []).map(a => a.email || a.displayName || '').filter(Boolean),
          status: e.status || 'confirmed',
        });
      }
    } catch { /* skip inaccessible calendar */ }
  }

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const eventsToday = allEvents.filter(e => {
    const d = new Date(e.start);
    return d >= todayStart && d <= todayEnd;
  });
  const eventsUpcoming = allEvents.filter(e => new Date(e.start) > todayEnd);

  const snapshot: CalendarSnapshot = {
    synced_at: new Date().toISOString(),
    today: now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }),
    events_today: eventsToday,
    events_upcoming: eventsUpcoming.slice(0, 20),
    calendars,
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
    today_count: eventsToday.length, upcoming_count: eventsUpcoming.length, synced_at: snapshot.synced_at,
  }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));

  return snapshot;
}

export function getCachedCalendar(): CalendarSnapshot | null {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8')); }
  catch { return null; }
}

export function getTodayEvents(): CalendarEvent[] {
  return getCachedCalendar()?.events_today || [];
}
