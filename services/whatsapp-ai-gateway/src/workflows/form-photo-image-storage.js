/**
 * Form Photo Image Storage — saves form photos to structured directories
 * 
 * Saves to: data/uploads/form-photo/YYYY-MM-DD/
 * Preserves original image (never modifies/deletes).
 */

const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../logger');

const log = makeLogger('form-photo-image');

const BASE_DIR = path.resolve('./data/uploads/form-photo');

/**
 * Save a form photo image.
 * @param {Buffer|object} mediaData - whatsapp-web.js media object or raw Buffer
 * @param {object} metadata - { chatId, sender, senderName, timestamp, messageId }
 * @returns {string} savedPath - absolute path to saved image
 */
function saveFormPhotoImage(mediaData, metadata = {}) {
  const { timestamp } = metadata || {};
  const dateStr = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const dir = path.join(BASE_DIR, dateStr);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info('Created form photo directory', { dir });
  }

  const ext = getMediaExtension(mediaData) || '.jpg';
  const messageId = (metadata?.messageId || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `form-${Date.now()}-${messageId}${ext}`;
  const filePath = path.join(dir, filename);

  // mediaData may be a Buffer or have a data property
  const buffer = mediaData.data
    ? Buffer.from(mediaData.data, 'base64')
    : Buffer.isBuffer(mediaData)
      ? mediaData
      : null;

  if (!buffer) {
    throw new Error('No valid image data provided');
  }

  fs.writeFileSync(filePath, buffer);

  // Save metadata alongside
  const metaPath = filePath.replace(/\.[^.]+$/, '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ...metadata,
    savedAt: new Date().toISOString(),
    sizeBytes: buffer.length,
    filePath,
    type: 'form-photo',
  }, null, 2));

  log.info('Form photo saved', { filePath, size: buffer.length, chatId: metadata?.chatId });
  return filePath;
}

/**
 * Save an image from an existing file path.
 */
function copyFormPhotoToStorage(sourcePath, metadata = {}) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source image not found: ${sourcePath}`);
  }

  const buffer = fs.readFileSync(sourcePath);
  const dateStr = new Date().toISOString().slice(0, 10);
  const dir = path.join(BASE_DIR, dateStr);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ext = path.extname(sourcePath) || '.jpg';
  const filename = `form-${Date.now()}-${path.basename(sourcePath).replace(/[^a-zA-Z0-9]/g, '_')}`;
  const destPath = path.join(dir, filename);

  fs.writeFileSync(destPath, buffer);

  const metaPath = destPath.replace(/\.[^.]+$/, '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ...metadata,
    sourcePath,
    savedAt: new Date().toISOString(),
    sizeBytes: buffer.length,
    filePath: destPath,
  }, null, 2));

  log.info('Form photo copied to storage', { sourcePath, destPath });
  return destPath;
}

/**
 * Get list of saved form photos for a date.
 */
function getFormPhotosForDate(dateStr) {
  const dir = path.join(BASE_DIR, dateStr);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp'))
    .filter(f => !f.endsWith('.meta.json'))
    .map(f => path.join(dir, f))
    .map(f => ({
      path: f,
      filename: path.basename(f),
      sizeBytes: fs.statSync(f).size,
      savedAt: fs.statSync(f).mtime.toISOString(),
    }));
}

/**
 * Get form photo metadata.
 */
function getFormPhotoMetadata(imagePath) {
  const metaPath = imagePath.replace(/\.[^.]+$/, '.meta.json');
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (_) {
    return {};
  }
}

/**
 * Get total storage used by form photos.
 */
function getFormPhotoStorageStats() {
  let totalBytes = 0;
  let fileCount = 0;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(entry.name)) {
        totalBytes += fs.statSync(full).size;
        fileCount++;
      }
    }
  }

  walk(BASE_DIR);

  return {
    totalBytes,
    totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    fileCount,
  };
}

function getMediaExtension(mediaData) {
  const mime = mediaData?.mimetype || mediaData?.mimeType || '';
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mime.toLowerCase()] || '.jpg';
}

module.exports = {
  saveFormPhotoImage,
  copyFormPhotoToStorage,
  getFormPhotosForDate,
  getFormPhotoMetadata,
  getFormPhotoStorageStats,
  BASE_DIR,
};