/**
 * GoogleCalendarVisibilityConnector.mjs
 * Reads Google Calendar cache for today's events, upcoming meetings.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR  = path.join(GLOBAL_DIR, 'visibility', 'google-calendar');
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

export class GoogleCalendarVisibilityConnector {
  constructor() {
    this.id = 'google-calendar';
    this.name = 'Google Calendar';
  }

  isConfigured() { return fs.existsSync(TOKEN_PATH); }

  getSnapshot() {
    if (!this.isConfigured()) {
      return {
        status: 'CONNECTOR_NOT_CONFIGURED',
        connector: 'google-calendar',
        setup: 'Open /api/auth/google/start → connect Google account',
        data: null,
      };
    }
    const cacheFile = path.join(CACHE_DIR, 'events_cache.json');
    if (!fs.existsSync(cacheFile)) {
      return { status: 'CACHE_EMPTY', connector: 'google-calendar', data: null };
    }
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return { status: 'ok', connector: 'google-calendar', source: cacheFile, last_sync: data.synced_at, data };
    } catch (e) {
      return { status: 'error', connector: 'google-calendar', error: e.message, data: null };
    }
  }

  /** Get today's events */
  getTodayEvents() {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;

    const today = new Date().toISOString().split('T')[0];
    const events = (snap.data.events || []).filter(e => {
      const start = e.start?.dateTime || e.start?.date || '';
      return start.startsWith(today);
    });

    return {
      status: 'ok',
      source: 'calendar-cache',
      date: today,
      count: events.length,
      events: events.map(e => ({
        id: e.id,
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location,
        attendees: (e.attendees || []).map(a => a.email),
        meeting_link: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri,
      })),
    };
  }

  /** Get upcoming events (next N days) */
  getUpcomingEvents(days = 7) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;

    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);
    const events = (snap.data.events || []).filter(e => {
      const start = new Date(e.start?.dateTime || e.start?.date || now);
      return start >= now && start <= end;
    }).sort((a, b) => {
      const da = new Date(a.start?.dateTime || a.start?.date);
      const db = new Date(b.start?.dateTime || b.start?.date);
      return da - db;
    });

    return {
      status: 'ok',
      source: 'calendar-cache',
      days_ahead: days,
      count: events.length,
      events: events.slice(0, 20),
    };
  }

  /** Find free slots for a meeting (simple: check what's NOT booked today+tomorrow) */
  findFreeSlots(daysAhead = 2) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;

    const slots = [];
    for (let d = 0; d < daysAhead; d++) {
      const day = new Date();
      day.setDate(day.getDate() + d + 1);
      const dateStr = day.toISOString().split('T')[0];
      const booked = (snap.data.events || [])
        .filter(e => (e.start?.dateTime || '').startsWith(dateStr))
        .map(e => parseInt(e.start.dateTime.split('T')[1].split(':')[0]));
      // Work hours 9-17, find unbooked slots
      for (let h = 9; h < 17; h++) {
        if (!booked.includes(h)) {
          slots.push({ date: dateStr, time: `${h}:00`, available: true });
        }
      }
    }
    return { status: 'ok', source: 'calendar-cache', slots: slots.slice(0, 10) };
  }

  getSummaryText() {
    const snap = this.getSnapshot();
    if (snap.status === 'CONNECTOR_NOT_CONFIGURED') return `📆 Calendar: Not configured — ${snap.setup}`;
    if (snap.status !== 'ok') return `📆 Calendar: ${snap.status}`;
    const today = this.getTodayEvents();
    if (today.status !== 'ok') return `📆 Calendar: cache exists, no events parsed`;
    if (today.count === 0) return `📆 Calendar: No events today`;
    return `📆 Calendar: ${today.count} events today — ${today.events.map(e => e.title).join(', ')}`;
  }
}

export const calendarConnector = new GoogleCalendarVisibilityConnector();
