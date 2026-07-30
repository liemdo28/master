/**
 * Image Preprocessor
 * 
 * Prepares images for vision analysis.
 * Validates, inspects, and formats image metadata for incident detection.
 */

const fs = require('fs');
const path = require('path');
const { inspectImage, validateImage } = require('./image-validator');
const { makeLogger } = require('../logger');

const log = makeLogger('vision');

// Maximum image size: 10MB
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Preprocess an image before vision analysis.
 * Returns validation result + preprocessed metadata.
 * 
 * @param {string} imagePath
 * @returns {{ ok: boolean, issues: string[], metadata: object }}
 */
function preprocess(imagePath) {
  const issues = [];
  
  // Check file exists
  if (!fs.existsSync(imagePath)) {
    return { ok: false, issues: ['File not found'], metadata: {} };
  }

  // Inspect image
  const inspection = inspectImage(imagePath);
  
  if (!inspection.ok) {
    issues.push(...inspection.issues);
  }

  // Check size
  if (inspection.sizeBytes > MAX_SIZE_BYTES) {
    issues.push('file_too_large');
  }

  // Check type
  if (!SUPPORTED_TYPES.has(inspection.mimeType)) {
    issues.push('unsupported_type');
  }

  const metadata = {
    originalPath: imagePath,
    mimeType: inspection.mimeType,
    sizeBytes: inspection.sizeBytes,
    sizeMB: (inspection.sizeBytes / (1024 * 1024)).toFixed(2),
    extension: path.extname(imagePath).toLowerCase(),
    isValid: issues.length === 0,
  };

  log.info('Image preprocessed', { path: imagePath, issues: issues.length, ...metadata });
  
  return {
    ok: issues.length === 0,
    issues,
    metadata,
    inspection,
  };
}

/**
 * Validate an image and throw if invalid.
 */
function validateForVision(imagePath) {
  const result = preprocess(imagePath);
  if (!result.ok) {
    const err = new Error(`Image validation failed: ${result.issues.join(', ')}`);
    err.validation = result;
    throw err;
  }
  return result;
}

/**
 * Check if image quality is sufficient for vision analysis.
 * 
 * @param {string} imagePath
 * @returns {{ sufficient: boolean, quality: string, sizeMB: number }}
 */
function checkQuality(imagePath) {
  const result = preprocess(imagePath);
  
  let quality = 'GOOD';
  
  if (result.issues.includes('file_too_large')) {
    quality = 'TOO_LARGE';
  } else if (result.issues.includes('empty_file')) {
    quality = 'EMPTY';
  } else if (!result.ok) {
    quality = 'INVALID';
  }
  
  // Heuristic: small files may be blurry thumbnails
  if (result.metadata.sizeBytes < 30 * 1024) { // < 30KB
    quality = 'SMALL_POSSIBLE_BLURRY';
  }

  return {
    sufficient: result.ok && quality === 'GOOD',
    quality,
    sizeMB: result.metadata.sizeMB,
    issues: result.issues,
  };
}

/**
 * Load image as base64 buffer for API calls.
 * 
 * @param {string} imagePath
 * @returns {{ buffer: Buffer, base64: string, mimeType: string }}
 */
function loadImage(imagePath) {
  validateForVision(imagePath);
  
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

  return { buffer, base64, mimeType };
}

module.exports = {
  preprocess,
  validateForVision,
  checkQuality,
  loadImage,
  MAX_SIZE_BYTES,
};