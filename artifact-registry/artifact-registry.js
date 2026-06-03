'use strict';

/**
 * Artifact Registry — Agent OS
 * CommonJS, Node.js built-ins only.
 *
 * Artifact manifest standard:
 * {
 *   "artifactId": "ART-...",
 *   "taskId": "TASK-...",
 *   "type": "log | report | screenshot | execution",
 *   "path": "...",
 *   "createdAt": "...",
 *   "checksum": "...",
 *   "source": "validation-engine"
 * }
 *
 * Storage layout:
 * artifact-registry/
 * ├── screenshots/   ← type "screenshot"
 * ├── logs/          ← type "log"
 * ├── reports/       ← type "report"
 * ├── executions/    ← type "execution"
 * ├── manifests/     ← manifest JSON files (ART-*.json)
 * └── artifact-registry.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Paths ────────────────────────────────────────────────────────────────────

const REGISTRY_DIR = __dirname;
const MANIFESTS_DIR = path.join(REGISTRY_DIR, 'manifests');
const SCREENSHOTS_DIR = path.join(REGISTRY_DIR, 'screenshots');
const LOGS_DIR = path.join(REGISTRY_DIR, 'logs');
const REPORTS_DIR = path.join(REGISTRY_DIR, 'reports');
const EXECUTIONS_DIR = path.join(REGISTRY_DIR, 'executions');

/** @type {Record<string, string>} type → directory */
const TYPE_DIR = {
  screenshot: SCREENSHOTS_DIR,
  log: LOGS_DIR,
  report: REPORTS_DIR,
  execution: EXECUTIONS_DIR,
};

const VALID_TYPES = Object.keys(TYPE_DIR);
const METADATA_FILE = 'metadata.jsonl'; // single-line per artifact

// ── Init ─────────────────────────────────────────────────────────────────────

function ensureDirectories() {
  for (const dir of [MANIFESTS_DIR, SCREENSHOTS_DIR, LOGS_DIR, REPORTS_DIR, EXECUTIONS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function getManifestPath(artifactId) {
  return path.join(MANIFESTS_DIR, `${artifactId}.json`);
}

// ── ID generation ─────────────────────────────────────────────────────────────

function generateId(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${date}-${random}`;
}

// ── Core artifact functions ───────────────────────────────────────────────────

/**
 * Register a new artifact and persist its content + manifest.
 *
 * @param {object} params
 * @param {string} params.taskId        — TASK-... ID
 * @param {string} params.type          — log | report | screenshot | execution
 * @param {Buffer|string} params.content — raw file content
 * @param {string} [params.filename]    — optional filename (auto-generated if omitted)
 * @param {string} [params.source]      — source system, default "agent-os"
 * @returns {object}  { artifactId, path, checksum }
 */
function createArtifact({ taskId, type, content, filename, source = 'agent-os' }) {
  ensureDirectories();

  if (!taskId) throw new Error('createArtifact: taskId is required');
  if (!type || !VALID_TYPES.includes(type)) {
    throw new Error(`createArtifact: type must be one of [${VALID_TYPES.join(', ')}]`);
  }

  const artifactId = generateId('ART');
  const checksum = crypto
    .createHash('sha256')
    .update(typeof content === 'string' ? content : content)
    .digest('hex');

  const ext = getExtension(type, filename);
  const safeFilename = filename
    ? filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    : `${artifactId}${ext}`;
  const targetDir = TYPE_DIR[type];
  const artifactPath = path.join(targetDir, safeFilename);

  // Write content
  fs.writeFileSync(artifactPath, content);

  // Build manifest
  const manifest = {
    artifactId,
    taskId,
    type,
    path: artifactPath,
    createdAt: new Date().toISOString(),
    checksum,
    source,
    filename: safeFilename,
  };

  // Write manifest
  const manifestPath = getManifestPath(artifactId);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return { artifactId, path: artifactPath, checksum };
}

/**
 * Register an existing file as an artifact (copies it into the registry).
 *
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.type
 * @param {string} params.sourceFile   — absolute path to the source file
 * @param {string} [params.filename]  — optional destination filename
 * @param {string} [params.source]     — source system, default "agent-os"
 * @returns {object}  { artifactId, path, checksum }
 */
function registerArtifact({ taskId, type, sourceFile, filename, source = 'agent-os' }) {
  ensureDirectories();

  if (!taskId) throw new Error('registerArtifact: taskId is required');
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`registerArtifact: source file not found: ${sourceFile}`);
  }

  const rawContent = fs.readFileSync(sourceFile);
  const ext = path.extname(sourceFile);
  const resolvedFilename = filename || path.basename(sourceFile);
  return createArtifact({
    taskId,
    type,
    content: rawContent,
    filename: resolvedFilename,
    source,
  });
}

/**
 * Return all artifacts for a given taskId.
 *
 * @param {string} taskId
 * @returns {object[]}
 */
function listArtifactsByTask(taskId) {
  ensureDirectories();
  if (!fs.existsSync(MANIFESTS_DIR)) return [];

  const files = fs.readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'));
  const results = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8');
      const manifest = JSON.parse(content.trim());
      if (manifest.taskId === taskId) {
        results.push(manifest);
      }
    } catch (_) {
      // skip malformed manifests
    }
  }

  return results;
}

/**
 * Return the manifest for a specific artifactId.
 *
 * @param {string} artifactId
 * @returns {object|null}
 */
function getArtifact(artifactId) {
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
 * Return true if the artifact's file exists on disk and checksum matches.
 *
 * @param {string} artifactId
 * @returns {boolean}
 */
function validateArtifactExists(artifactId) {
  const manifest = getArtifact(artifactId);
  if (!manifest) return false;

  const { path: artifactPath, checksum } = manifest;
  if (!fs.existsSync(artifactPath)) return false;

  const actualChecksum = crypto
    .createHash('sha256')
    .update(fs.readFileSync(artifactPath))
    .digest('hex');

  return actualChecksum === checksum;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Infer file extension from type and optional filename.
 */
function getExtension(type, filename) {
  if (filename && path.extname(filename)) return path.extname(filename);
  const map = {
    screenshot: '.png',
    log: '.log',
    report: '.json',
    execution: '.json',
  };
  return map[type] || '.bin';
}

/**
 * Return all artifact manifests (optionally filtered by type).
 *
 * @param {object} [opts]
 * @param {string} [opts.type]
 * @returns {object[]}
 */
function listArtifacts(opts) {
  ensureDirectories();
  if (!fs.existsSync(MANIFESTS_DIR)) return [];

  const files = fs.readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json'));
  const results = [];

  for (const file of files) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8').trim()
      );
      if (!opts || !opts.type || manifest.type === opts.type) {
        results.push(manifest);
      }
    } catch (_) {
      // skip
    }
  }

  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createArtifact,
  registerArtifact,
  listArtifactsByTask,
  listArtifacts,
  getArtifact,
  validateArtifactExists,
};
