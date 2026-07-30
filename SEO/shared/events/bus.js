/**
 * File-based event bus. Each event is appended as JSONL to shared/events/bus.log.
 * Consumers can poll or read the trailing N events. Events also persist to db.
 */
const fs = require('fs');
const path = require('path');

const BUS_FILE = path.join(__dirname, 'bus.log');

function publish({ from, to, type, payload, db }) {
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    from,
    to: to || '*',
    type,
    payload: payload || {},
  };
  fs.appendFileSync(BUS_FILE, JSON.stringify(event) + '\n');
  if (db) db.insert('agent_tasks', { kind: 'event', ...event });
  return event;
}

function tail(n = 50) {
  if (!fs.existsSync(BUS_FILE)) return [];
  const lines = fs.readFileSync(BUS_FILE, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-n).map((l) => JSON.parse(l));
}

function consume(filter = () => true) {
  return tail(1000).filter(filter);
}

module.exports = { publish, tail, consume, BUS_FILE };
