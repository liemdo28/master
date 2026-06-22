/**
 * CalendarActionService.mjs
 * Create, update, cancel Google Calendar events. All require approval.
 */

import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';
import { calendarConnector } from '../universal-visibility/GoogleCalendarVisibilityConnector.mjs';

function parseTime(timeStr, dateStr) {
  // e.g. "2PM" → 14:00, "2:30PM" → 14:30
  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  const date = dateStr || new Date().toISOString().split('T')[0];
  return `${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
}

function nextDayDate(dayOffset = 1) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0];
}

export class CalendarActionService {
  /**
   * Create calendar event — requires approval
   * @param {object} params
   * @param {string} params.title
   * @param {string} params.date - ISO date or "mai" / "ngày mai" / "tomorrow"
   * @param {string} params.time - "2PM", "14:00", "2:30PM"
   * @param {number} [params.duration_min] - default 60
   * @param {string[]} [params.attendees] - email list
   * @param {string} [params.location]
   * @param {string} [params.description]
   */
  static createEvent(params) {
    const { title, date, time, duration_min = 60, attendees = [], location, description } = params;

    // Resolve date
    let resolvedDate = date;
    if (!date || /mai|tomorrow|ngày mai/i.test(date)) {
      resolvedDate = nextDayDate(1);
    } else if (/kia|ngày kia/i.test(date)) {
      resolvedDate = nextDayDate(2);
    } else if (!/\d{4}-\d{2}-\d{2}/.test(date)) {
      resolvedDate = nextDayDate(1); // default tomorrow
    }

    const startDateTime = parseTime(time || '10:00AM', resolvedDate);
    const endDate = new Date(startDateTime || `${resolvedDate}T10:00:00`);
    endDate.setMinutes(endDate.getMinutes() + duration_min);
    const endDateTime = endDate.toISOString().replace('.000Z', '');

    const eventDraft = {
      summary: title,
      start: { dateTime: startDateTime || `${resolvedDate}T10:00:00`, timeZone: 'America/Los_Angeles' },
      end:   { dateTime: endDateTime, timeZone: 'America/Los_Angeles' },
      attendees: attendees.map(e => ({ email: e })),
      location,
      description: description || `Created by Mi on ${new Date().toISOString().split('T')[0]}`,
    };

    const action = ApprovalRequiredAction.create({
      type: 'create-event',
      target: 'google-calendar',
      description: `Create event: "${title}" on ${resolvedDate} at ${time || '10:00AM'} (${duration_min}min)${attendees.length ? ` with ${attendees.join(', ')}` : ''}`,
      payload: eventDraft,
      before_state: 'No event scheduled',
      rollback_plan: 'Cancel/delete event via calendar after creation',
    });

    return {
      status: 'pending_approval',
      event_draft: eventDraft,
      action,
      formatted: ApprovalRequiredAction.formatForResponse(action),
      preview: [
        `📆 Calendar Event Draft:`,
        `Title: ${title}`,
        `Date: ${resolvedDate} at ${time || '10:00AM'}`,
        `Duration: ${duration_min} minutes`,
        attendees.length ? `Attendees: ${attendees.join(', ')}` : '',
        location ? `Location: ${location}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  /**
   * Find free time slots for scheduling
   */
  static findFreeSlots(daysAhead = 2) {
    return calendarConnector.findFreeSlots(daysAhead);
  }

  /**
   * Update an existing event — requires approval
   */
  static updateEvent(eventId, updates) {
    const action = ApprovalRequiredAction.create({
      type: 'update-event',
      target: 'google-calendar',
      description: `Update calendar event ${eventId}: ${JSON.stringify(updates)}`,
      payload: { eventId, updates },
      before_state: 'Event exists with original values',
      rollback_plan: 'Revert event to original values via Calendar',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /**
   * Cancel event — dangerous (level 3)
   */
  static cancelEvent(eventId, reason = '') {
    const action = ApprovalRequiredAction.create({
      type: 'cancel-event',
      target: 'google-calendar',
      description: `Cancel calendar event ${eventId}${reason ? ': ' + reason : ''}`,
      payload: { eventId, reason },
      before_state: 'Event is scheduled',
      rollback_plan: 'Cannot automatically restore cancelled event — re-create manually',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }
}
