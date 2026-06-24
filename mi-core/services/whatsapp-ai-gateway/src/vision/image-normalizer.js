const { inspectImage } = require('./image-validator');

async function normalizeImage(filePath) {
  const metadata = inspectImage(filePath);
  return {
    originalPath: filePath,
    normalizedPath: filePath,
    changed: false,
    metadata,
    operations: [],
  };
}

module.exports = { normalizeImage };
