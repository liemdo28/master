/**
 * Shared report writer. Saves JSON reports under shared/reports/<agent>/
 * and registers metadata in the shared database `reports` table.
 */
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = __dirname;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveReport({ agentId, type, payload, db }) {
  const agentDir = path.join(REPORTS_DIR, agentId);
  ensureDir(agentDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${type}-${ts}.json`;
  const filepath = path.join(agentDir, filename);
  const report = {
    agent: agentId,
    type,
    generated_at: new Date().toISOString(),
    payload,
  };
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  if (db) {
    db.insert('reports', {
      agent: agentId,
      type,
      path: filepath,
      summary: payload && payload.summary ? payload.summary : null,
    });
  }
  return { filepath, report };
}

function listReports(agentId) {
  const agentDir = path.join(REPORTS_DIR, agentId);
  if (!fs.existsSync(agentDir)) return [];
  return fs
    .readdirSync(agentDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(agentDir, f));
}

function latestReport(agentId, type) {
  const files = listReports(agentId);
  const filtered = type ? files.filter((f) => path.basename(f).startsWith(type + '-')) : files;
  if (!filtered.length) return null;
  filtered.sort();
  const file = filtered[filtered.length - 1];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { saveReport, listReports, latestReport, REPORTS_DIR };
