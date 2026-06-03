'use strict';

/**
 * Artifact Engine - manages task execution artifacts, logs, and reports.
 * CommonJS, Node.js built-ins only.
 *
 * Manifest standard:
 * {
 *   "artifactId": "ART-YYYYMMDD-HHMMSS-XXX",
 *   "taskId": "TASK-...",
 *   "type": "log | report | screenshot | execution",
 *   "path": "...",
 *   "checksum": "sha256:...",
 *   "createdAt": "...",
 *   "source": "validation-engine",
 *   "exists": true
 * }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Paths ────────────────────────────────────────────────────────────────────

const ARTIFACTS_ROOT = path.join(__dirname, 'artifacts');
const EXECUTIONS_DIR = path.join(ARTIFACTS_ROOT, 'executions');
const LOGS_DIR = path.join(ARTIFACTS_ROOT, 'logs');
const REPORTS_DIR = path.join(ARTIFACTS_ROOT, 'reports');
const SCREENSHOTS_DIR = path.join(ARTIFACTS_ROOT, 'screenshots');
const MANIFESTS_DIR = path.join(ARTIFACTS_ROOT, 'manifests');

/** @type {Record<string, string>} type → directory */
const TYPE_DIR = {
  execution: EXECUTIONS_DIR,
  log: LOGS_DIR,
  report: REPORTS_DIR,
  screenshot: SCREENSHOTS_DIR,
};

const VALID_TYPES = Object.keys(TYPE_DIR);

// ── Init ─────────────────────────────────────────────────────────────────────

function ensureDirs() {
  for (const dir of [EXECUTIONS_DIR, LOGS_DIR, REPORTS_DIR, SCREENSHOTS_DIR, MANIFESTS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
ensureDirs();

// ── ID generation ─────────────────────────────────────────────────────────────

/**
 * Generate an artifact ID.
 * @returns {string}
 */
function generateArtifactId() {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ART-${ts}-${rand}`;
}

// ── Validation mapping ────────────────────────────────────────────────────────

/**
 * Derive validation status from exitCode.
 * @param {number|undefined} exitCode
 * @returns {"PASS"|"FAIL"|"UNKNOWN"}
 */
function deriveValidation(exitCode) {
  if (exitCode === undefined || exitCode === null) return 'UNKNOWN';
  return exitCode === 0 ? 'PASS' : 'FAIL';
}

// ── Manifest helpers ───────────────────────────────────────────────────────────

function getManifestPath(artifactId) {
  return path.join(MANIFESTS_DIR, `${artifactId}.json`);
}

/**
 * Resolve artifact file path for a taskId (legacy scan for executions).
 * @param {string} taskId
 * @returns {string}
 */
function resolveArtifactPath(taskId) {
  if (fs.existsSync(EXECUTIONS_DIR)) {
    const files = fs.readdirSync(EXECUTIONS_DIR);
    const match = files.find(f => f.includes(taskId) && f.endsWith('.json'));
    if (match) return path.join(EXECUTIONS_DIR, match);
  }
  const date = new Date().toISOString().slice(0, 10);
  return path.join(EXECUTIONS_DIR, `TASK-${date}-${taskId}.json`);
}

/**
 * Infer extension from type.
 */
function getExtension(type, filename) {
  if (filename && path.extname(filename)) return path.extname(filename);
  const map = { execution: '.json', log: '.log', report: '.json', screenshot: '.png' };
  return map[type] || '.bin';
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create or update an execution artifact for a task.
 * @param {string} taskId
 * @param {string} type - e.g. "script", "qa", "build"
 * @param {object} data - fields: startTime, endTime, exitCode, command, stdout, stderr, logs, report
 * @returns {object} the saved artifact
 */
function createArtifact(taskId, type, data) {
  if (!taskId) throw new Error('createArtifact: taskId is required');
  if (!type) throw new Error('createArtifact: type is required');

  const filePath = resolveArtifactPath(taskId);
  let existing = {};
  if (fs.existsSync(filePath)) {
    try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) {}
  }

  const exitCode = data.exitCode !== undefined ? data.exitCode : existing.exitCode;
  const artifact = {
    taskId,
    type,
    startTime: data.startTime || existing.startTime || new Date().toISOString(),
    endTime: data.endTime || existing.endTime || null,
    exitCode: exitCode !== undefined ? exitCode : undefined,
    command: data.command !== undefined ? data.command : (existing.command || null),
    stdout: data.stdout !== undefined ? data.stdout : (existing.stdout || ''),
    stderr: data.stderr !== undefined ? data.stderr : (existing.stderr || ''),
    logs: data.logs !== undefined ? data.logs : (existing.logs || []),
    report: data.report !== undefined ? data.report : (existing.report || ''),
    validation: deriveValidation(exitCode),
  };

  if (artifact.exitCode === undefined) delete artifact.exitCode;

  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), 'utf8');
  return artifact;
}

/**
 * Register a file as an artifact with full manifest + checksum.
 * Copies the file into the appropriate type directory and writes a manifest.
 *
 * @param {string} taskId
 * @param {string} filePath   — absolute path to source file
 * @param {string} type       — log | report | screenshot | execution
 * @param {object} [metadata] — optional extra fields
 * @returns {object} { artifactId, path, checksum }
 */
function registerArtifact(taskId, filePath, type, metadata = {}) {
  if (!taskId) throw new Error('registerArtifact: taskId is required');
  if (!filePath) throw new Error('registerArtifact: filePath is required');
  if (!type || !VALID_TYPES.includes(type)) {
    throw new Error(`registerArtifact: type must be one of [${VALID_TYPES.join(', ')}]`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`registerArtifact: source file not found: ${filePath}`);
  }

  const artifactId = generateArtifactId();
  const content = fs.readFileSync(filePath);
  const checksum = crypto.createHash('sha256').update(content).digest('hex');

  const ext = getExtension(type, path.extname(filePath) ? path.basename(filePath) : '');
  const destFilename = `${artifactId}${ext}`;
  const targetDir = TYPE_DIR[type];
  const destPath = path.join(targetDir, destFilename);

  fs.writeFileSync(destPath, content);

  const manifest = {
    artifactId,
    taskId,
    type,
    path: destPath,
    checksum,
    createdAt: new Date().toISOString(),
    source: metadata.source || 'agent-os',
    exists: true,
    ...metadata,
  };

  const manifestPath = getManifestPath(artifactId);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return { artifactId, path: destPath, checksum };
}

/**
 * Validate that an artifact manifest exists, file exists, and checksum matches.
 * @param {string} artifactId
 * @returns {boolean}
 */
function validateArtifactExists(artifactId) {
  if (!artifactId) return false;
  const manifestPath = getManifestPath(artifactId);
  if (!fs.existsSync(manifestPath)) return false;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').trim());
  } catch (_) {
    return false;
  }

  if (!fs.existsSync(manifest.path)) return false;

  const actual = crypto
    .createHash('sha256')
    .update(fs.readFileSync(manifest.path))
    .digest('hex');

  return actual === manifest.checksum;
}

/**
 * Append a log line to the task's log file.
 * @param {string} taskId
 * @param {string} level - e.g. "INFO", "WARN", "ERROR"
 * @param {string} message
 */
function saveLog(taskId, level, message) {
  if (!taskId) throw new Error('saveLog: taskId is required');
  const logPath = path.join(LOGS_DIR, `${taskId}.log`);
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  fs.appendFileSync(logPath, line, 'utf8');
}

/**
 * Read an artifact by taskId.
 * @param {string} taskId
 * @returns {object|null}
 */
function getArtifact(taskId) {
  if (!taskId) throw new Error('getArtifact: taskId is required');
  const filePath = resolveArtifactPath(taskId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Get artifact manifest by artifactId.
 * @param {string} artifactId
 * @returns {object|null}
 */
function getArtifactManifest(artifactId) {
  if (!artifactId) return null;
  const manifestPath = getManifestPath(artifactId);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8').trim());
  } catch (_) {
    return null;
  }
}

/**
 * List artifacts, optionally filtered.
 * @param {object} [filter]
 * @param {string} [filter.date]       - YYYY-MM-DD substring to match in filename
 * @param {string} [filter.type]       - match artifact.type
 * @param {string} [filter.validation] - "PASS"|"FAIL"|"UNKNOWN"
 * @returns {object[]}
 */
function listArtifacts(filter = {}) {
  if (!fs.existsSync(EXECUTIONS_DIR)) return [];
  const files = fs.readdirSync(EXECUTIONS_DIR).filter(f => f.endsWith('.json'));

  const artifacts = [];
  for (const file of files) {
    if (filter.date && !file.includes(filter.date)) continue;
    let artifact;
    try {
      artifact = JSON.parse(fs.readFileSync(path.join(EXECUTIONS_DIR, file), 'utf8'));
    } catch (_) {
      continue;
    }
    if (filter.type && artifact.type !== filter.type) continue;
    if (filter.validation && artifact.validation !== filter.validation) continue;
    artifacts.push(artifact);
  }
  return artifacts;
}

/**
 * List all manifests for a given taskId.
 * @param {string} taskId
 * @returns {object[]}
 */
function listArtifactsByTask(taskId) {
  if (!fs.existsSync(MANIFESTS_DIR)) return [];
  const files = fs.readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'));
  const results = [];
  for (const file of files) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8').trim()
      );
      if (manifest.taskId === taskId) {
        results.push(manifest);
      }
    } catch (_) {
      // skip
    }
  }
  return results;
}

/**
 * Return the N most recent manifest entries sorted by createdAt descending.
 * @param {number} [limit=20]
 * @returns {object[]}
 */
function listRecentArtifacts(limit = 20) {
  if (!fs.existsSync(MANIFESTS_DIR)) return [];
  const files = fs.readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'));
  const results = [];
  for (const file of files) {
    try {
      results.push(
        JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8').trim())
      );
    } catch (_) {
      // skip
    }
  }
  return results
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, limit);
}

/**
 * Generate a full artifact index: all manifests + all execution artifacts.
 * @returns {object}
 */
function generateArtifactIndex() {
  const manifestFiles = fs.existsSync(MANIFESTS_DIR)
    ? fs.readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'))
    : [];
  const executionFiles = fs.existsSync(EXECUTIONS_DIR)
    ? fs.readdirSync(EXECUTIONS_DIR).filter(f => f.endsWith('.json'))
    : [];

  const manifests = [];
  for (const file of manifestFiles) {
    try {
      manifests.push(
        JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8').trim())
      );
    } catch (_) { /* skip */ }
  }

  const executions = [];
  for (const file of executionFiles) {
    try {
      executions.push(
        JSON.parse(fs.readFileSync(path.join(EXECUTIONS_DIR, file), 'utf8'))
      );
    } catch (_) { /* skip */ }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalManifests: manifests.length,
    totalExecutions: executions.length,
    manifests,
    executions,
  };
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createArtifact,
  registerArtifact,
  validateArtifactExists,
  saveLog,
  getArtifact,
  getArtifactManifest,
  listArtifacts,
  listArtifactsByTask,
  listRecentArtifacts,
  generateArtifactIndex,
  deriveValidation,
  generateArtifactId,
  getManifestPath,
  ensureDirs,
};
