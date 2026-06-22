const fs = require('fs');
const path = require('path');

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] || 'application/octet-stream';
}

function inspectImage(filePath) {
  const exists = fs.existsSync(filePath);
  const mimeType = getMimeType(filePath);
  const stat = exists ? fs.statSync(filePath) : null;
  const sizeBytes = stat?.size || 0;
  const issues = [];

  if (!exists) issues.push('missing_file');
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) issues.push('unsupported_type');
  if (exists && sizeBytes === 0) issues.push('empty_file');

  return {
    ok: issues.length === 0,
    filePath,
    mimeType,
    sizeBytes,
    issues,
  };
}

function validateImage(filePath) {
  const result = inspectImage(filePath);
  if (!result.ok) {
    const err = new Error(`Image validation failed: ${result.issues.join(', ')}`);
    err.validation = result;
    throw err;
  }
  return result;
}

module.exports = { inspectImage, validateImage, getMimeType, SUPPORTED_MIME_TYPES };
