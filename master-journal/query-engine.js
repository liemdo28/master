'use strict';

/**
 * Journal Query Engine - reads JSONL event files from master-journal/events/.
 * CommonJS, Node.js built-ins only.
 *
 * Event format (from actual 2026-06-01.jsonl):
 * {
 *   timestamp: "2026-06-01T12:28:46.958Z",
 *   type: "task_created" | "task_started" | "task_completed" | "task_failed" |
 *         "task_cancelled" | "approval_denied" | "snapshot_started" |
 *         "kill_task" | "control_ping" | "task_pending" | ...,
 *   taskId: "<uuid>",
 *   project: "<project name>",
 *   actor: "<actor>",
 *   risk: "safe" | "elevated" | "dangerous",   // optional
 *   data: { ... }                               // optional
 * }
 */

const fs = require('fs');
const path = require('path');

const EVENTS_DIR = path.join(__dirname, 'events');

/**
 * Parse a JSONL file and return an array of event objects.
 * Returns [] if the file doesn't exist or can't be read.
 * @param {string} filePath
 * @returns {object[]}
 */
function parseJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return [];
  }
  const events = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch (_) {
      // skip malformed lines
    }
  }
  return events;
}

/**
 * Return all JSONL event files sorted by filename (date ascending).
 * @returns {string[]} absolute file paths
 */
function getAllEventFiles() {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  return fs
    .readdirSync(EVENTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .map(f => path.join(EVENTS_DIR, f));
}

/**
 * Return the last N events across all JSONL files (chronological order, most recent last).
 * @param {number} [n=10]
 * @returns {object[]}
 */
function getRecentEvents(n = 10) {
  const files = getAllEventFiles();
  // Collect all events (files are date-sorted; we need the tail)
  let all = [];
  for (const file of files) {
    all = all.concat(parseJsonl(file));
  }
  return all.slice(-n);
}

/**
 * Return all events where type contains "failed" or data.error exists.
 * @returns {object[]}
 */
function getFailedEvents() {
  const files = getAllEventFiles();
  const results = [];
  for (const file of files) {
    for (const event of parseJsonl(file)) {
      const typeHasFailed = typeof event.type === 'string' && event.type.includes('failed');
      const dataHasError = event.data && event.data.error !== undefined;
      if (typeHasFailed || dataHasError) {
        results.push(event);
      }
    }
  }
  return results;
}

/**
 * Return events from today's date file (YYYY-MM-DD.jsonl).
 * Uses the current date.
 * @returns {object[]}
 */
function getTodayEvents() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return getEventsByDate(today);
}

/**
 * Return all events for a specific project name.
 * Matches on the event.project field (case-sensitive substring match).
 * @param {string} projectName
 * @returns {object[]}
 */
function getProjectEvents(projectName) {
  if (!projectName) return [];
  const files = getAllEventFiles();
  const results = [];
  for (const file of files) {
    for (const event of parseJsonl(file)) {
      if (typeof event.project === 'string' && event.project.includes(projectName)) {
        results.push(event);
      }
    }
  }
  return results;
}

/**
 * Return events from a specific date's JSONL file.
 * @param {string} date - YYYY-MM-DD
 * @returns {object[]|"UNKNOWN"} array of events, or "UNKNOWN" if file doesn't exist
 */
function getEventsByDate(date) {
  if (!date) return 'UNKNOWN';
  const filePath = path.join(EVENTS_DIR, `${date}.jsonl`);
  if (!fs.existsSync(filePath)) return 'UNKNOWN';
  return parseJsonl(filePath);
}

module.exports = {
  getRecentEvents,
  getFailedEvents,
  getTodayEvents,
  getProjectEvents,
  getEventsByDate,
};
