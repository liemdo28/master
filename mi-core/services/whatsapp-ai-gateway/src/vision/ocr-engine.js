const imageAnalyzer = require('../food-safety/image-analyzer');
const { normalizeImage } = require('./image-normalizer');

async function extractFoodSafetyReadings(imagePath) {
  const normalized = await normalizeImage(imagePath);
  const extracted = await imageAnalyzer.analyzeImage(normalized.normalizedPath);
  return {
    normalized,
    extracted,
  };
}

module.exports = { extractFoodSafetyReadings };
