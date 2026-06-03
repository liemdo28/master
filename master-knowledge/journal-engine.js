'use strict';

const fs = require('fs');
const path = require('path');

const JOURNAL_DIR = path.join(__dirname, '../master-journal/events');

/**
 * Reads all JSONL files in the journal directory, parses each line as a JSON event.
 * Files are sorted by filename (date ascending).
 * @returns {Array} all events
 */
function loadAllEvents() {
  let files;
  try {
    files = fs.readdirSync(JOURNAL_DIR)
      .filter((f) => f.endsWith('.jsonl'))
      .sort();
  } catch (err) {
    return [];
  }

  const events = [];
  for (const file of files) {
    const filePath = path.join(JOURNAL_DIR, file);
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        // skip malformed lines
      }
    }
  }
  return events;
}

/**
 * Returns the most recent N events (newest last in JSONL, so we slice from end).
 * @param {number} [n=20]
 */
function getRecentEvents(n = 20) {
  const events = loadAllEvents();
  const recent = events.slice(-n);
  return {
    events: recent,
    total: recent.length,
    source: JOURNAL_DIR,
  };
}

/**
 * Returns events where type contains "failed" or "error", or data.status === "failed".
 */
function getFailedEvents() {
  const events = loadAllEvents();
  const failed = events.filter((e) => {
    if (!e) return false;
    const t = (e.type || '').toLowerCase();
    if (t.includes('fail') || t.includes('error')) return true;
    if (e.data && e.data.status && e.data.status.toLowerCase().includes('fail')) return true;
    return false;
  });
  return {
    events: failed,
    total: failed.length,
    source: JOURNAL_DIR,
  };
}

/**
 * Returns all events whose project field matches (case-insensitive, partial).
 * @param {string} name
 */
function getEventsForProject(name) {
  if (!name) return { events: [], total: 0, source: JOURNAL_DIR };
  const lower = name.toLowerCase();
  const events = loadAllEvents();
  const matched = events.filter(
    (e) => e && e.project && e.project.toLowerCase().includes(lower)
  );
  return {
    projectQuery: name,
    events: matched,
    total: matched.length,
    source: JOURNAL_DIR,
  };
}

/**
 * Returns all events matching a specific type (case-insensitive, partial).
 * @param {string} type - e.g. "task_completed", "task_failed"
 */
function getEventsByType(type) {
  if (!type) return { events: [], total: 0, source: JOURNAL_DIR };
  const lower = type.toLowerCase();
  const events = loadAllEvents();
  const matched = events.filter(
    (e) => e && e.type && e.type.toLowerCase().includes(lower)
  );
  return {
    typeQuery: type,
    events: matched,
    total: matched.length,
    source: JOURNAL_DIR,
  };
}

module.exports = {
  loadAllEvents,
  getRecentEvents,
  getFailedEvents,
  getEventsForProject,
  getEventsByType,
};
