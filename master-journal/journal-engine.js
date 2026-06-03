'use strict';

/**
 * Journal Engine — Write Pipeline
 * CommonJS, Node.js built-ins only.
 *
 * Extends the read-only query-engine.js with write capabilities.
 * Append-only: events are never modified or deleted.
 *
 * Journal format:
 * master-journal/events/YYYY-MM-DD.jsonl
 *
 * Event standard:
 * {
 *   "eventId": "EVT-...",
 *   "type": "validation_completed",
 *   "taskId": "...",
 *   "status": "PASS | FAIL | UNKNOWN",
 *   "artifacts": [],
 *   "timestamp": "..."
 * }
 *
 * Rule:
 *   Validation xong phải có:
 *     - Artifact saved  (artifact-registry.createArtifact / registerArtifact)
 *     - Journal event written (journal-engine.writeEvent / createValidationEvent)
 *   Không ghi fake event.
 *   Không hardcode success.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Paths ────────────────────────────────────────────────────────────────────

const JOURNAL_DIR = __dirname;
const EVENTS_DIR = path.join(JOURNAL_DIR, 'events');

// ── Init ─────────────────────────────────────────────────────────────────────

function ensureEventsDir() {
  if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
  }
}

// ── ID generation ─────────────────────────────────────────────────────────────

/**
 * Generate a compact event ID.
 * @param {string} prefix  e.g. "EVT", "TSK", "VAL"
 * @returns {string}
 */
function generateEventId(prefix = 'EVT') {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ── File helpers ─────────────────────────────────────────────────────────────

/**
 * Return the JSONL path for a given date string (YYYY-MM-DD).
 * Defaults to today's date.
 *
 * @param {string} [dateStr]
 * @returns {string}
 */
function getEventsFile(dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  return path.join(EVENTS_DIR, `${date}.jsonl`);
}

/**
 * Append a line to the daily JSONL file. Creates the file if missing.
 *
 * @param {string} line
 * @param {string} [dateStr]  YYYY-MM-DD override
 */
function appendLine(line, dateStr) {
  ensureEventsDir();
  const filePath = getEventsFile(dateStr);
  fs.appendFileSync(filePath, line + '\n');
}

// ── Core write functions ──────────────────────────────────────────────────────

/**
 * Append a raw event object to the journal.
 * The caller is responsible for setting all required fields.
 *
 * @param {object} event  — must include eventId, type, taskId, timestamp
 * @returns {string}  the eventId that was written
 */
function appendEvent(event) {
  if (!event || !event.eventId) {
    throw new Error('appendEvent: event.eventId is required');
  }
  if (!event.timestamp) {
    event.timestamp = new Date().toISOString();
  }
  appendLine(JSON.stringify(event));
  return event.eventId;
}

/**
 * Write a structured event to the journal and return its eventId.
 *
 * @param {object} params
 * @param {string} params.type      — event type string
 * @param {string} params.taskId    — TASK-... ID
 * @param {string} [params.status]  — PASS | FAIL | UNKNOWN
 * @param {object} [params.data]    — additional payload
 * @param {string} [params.actor]    — who triggered this
 * @param {string} [params.project]  — project name
 * @returns {string}  the eventId
 */
function writeEvent({ type, taskId, status, data, actor, project }) {
  const event = {
    eventId: generateEventId('EVT'),
    type,
    taskId: taskId || null,
    status: status || 'UNKNOWN',
    artifacts: [],
    timestamp: new Date().toISOString(),
    data: data || {},
    actor: actor || null,
    project: project || null,
  };
  return appendEvent(event);
}

/**
 * Create a task lifecycle event (created / started / completed / failed / cancelled).
 *
 * @param {object} params
 * @param {string} params.action     — created | started | completed | failed | cancelled
 * @param {string} params.taskId
 * @param {string} [params.actor]
 * @param {string} [params.project]
 * @param {object} [params.data]
 * @returns {string}  eventId
 */
function createTaskEvent({ action, taskId, actor, project, data }) {
  if (!taskId) throw new Error('createTaskEvent: taskId is required');
  return writeEvent({
    type: `task_${action}`,
    taskId,
    actor,
    project,
    data,
  });
}

/**
 * Create a validation_completed event.
 * Status is determined by the actual validation result — never hardcoded.
 *
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.status    — PASS | FAIL | UNKNOWN
 * @param {string[]} [params.artifacts]  — list of artifactIds created
 * @param {object} [params.data]    — validation details
 * @param {string} [params.actor]
 * @param {string} [params.project]
 * @returns {string}  eventId
 */
function createValidationEvent({ taskId, status, artifacts, data, actor, project }) {
  if (!taskId) throw new Error('createValidationEvent: taskId is required');
  if (!status || !['PASS', 'FAIL', 'UNKNOWN'].includes(status)) {
    throw new Error('createValidationEvent: status must be PASS, FAIL, or UNKNOWN');
  }
  const event = {
    eventId: generateEventId('EVT'),
    type: 'validation_completed',
    taskId,
    status,
    artifacts: artifacts || [],
    timestamp: new Date().toISOString(),
    data: data || {},
    actor: actor || null,
    project: project || null,
  };
  return appendEvent(event);
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a JSONL file into an array of event objects.
 * @param {string} filePath
 * @returns {object[]}
 */
function parseJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        try { return JSON.parse(l); }
        catch (_) { return null; }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Return all event files sorted by filename.
 * @returns {string[]}
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
 * Return all events for a given taskId across all JSONL files.
 *
 * @param {string} taskId
 * @returns {object[]}
 */
function getEventsByTaskId(taskId) {
  if (!taskId) return [];
  const files = getAllEventFiles();
  const results = [];
  for (const file of files) {
    for (const event of parseJsonl(file)) {
      if (event.taskId === taskId) {
        results.push(event);
      }
    }
  }
  return results;
}

// ── Combined API ──────────────────────────────────────────────────────────────
// Re-export read functions from query-engine.js (if available) so this module
// is self-contained. Falls back gracefully if query-engine is missing.

let queryEngine;
try {
  queryEngine = require('./query-engine');
} catch (_) {
  queryEngine = null;
}

const getRecentEvents = queryEngine
  ? (n) => queryEngine.getRecentEvents(n)
  : function (n = 10) {
      const files = getAllEventFiles();
      let all = [];
      for (const f of files) all = all.concat(parseJsonl(f));
      return all.slice(-n);
    };

const getFailedEvents = queryEngine
  ? () => queryEngine.getFailedEvents()
  : function () {
      const files = getAllEventFiles();
      const results = [];
      for (const f of files) {
        for (const e of parseJsonl(f)) {
          if (
            (typeof e.type === 'string' && e.type.includes('failed')) ||
            (e.data && e.data.error !== undefined)
          ) {
            results.push(e);
          }
        }
      }
      return results;
    };

const getTodayEvents = queryEngine
  ? () => queryEngine.getTodayEvents()
  : function () {
      const file = getEventsFile();
      return parseJsonl(file);
    };

const getProjectEvents = queryEngine
  ? (p) => queryEngine.getProjectEvents(p)
  : function (projectName) {
      if (!projectName) return [];
      const files = getAllEventFiles();
      const results = [];
      for (const f of files) {
        for (const e of parseJsonl(f)) {
          if (typeof e.project === 'string' && e.project.includes(projectName)) {
            results.push(e);
          }
        }
      }
      return results;
    };

const getEventsByDate = queryEngine
  ? (d) => queryEngine.getEventsByDate(d)
  : function (date) {
      if (!date) return 'UNKNOWN';
      const filePath = getEventsFile(date);
      if (!fs.existsSync(filePath)) return 'UNKNOWN';
      return parseJsonl(filePath);
    };

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Write pipeline
  appendEvent,
  writeEvent,
  createTaskEvent,
  createValidationEvent,

  // Read pipeline
  getEventsByTaskId,
  getRecentEvents,
  getFailedEvents,
  getTodayEvents,
  getProjectEvents,
  getEventsByDate,

  // Utilities
  generateEventId,
  getEventsFile,
};
