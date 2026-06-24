const thresholdEngine = require('../food-safety/threshold-engine');
const warningGenerator = require('../food-safety/warning-generator');
const { extractFoodSafetyReadings } = require('../vision/ocr-engine');

async function analyzeImage(imagePath) {
  const { normalized, extracted } = await extractFoodSafetyReadings(imagePath);
  const check = thresholdEngine.checkAll(extracted.readings || []);
  const result = warningGenerator.generateResult(check, extracted);
  return {
    agent: 'food-safety-agent',
    normalized,
    extracted,
    check,
    result,
  };
}

function evaluateExtracted(extracted) {
  const check = thresholdEngine.checkAll(extracted.readings || []);
  const result = warningGenerator.generateResult(check, extracted);
  return {
    agent: 'food-safety-agent',
    extracted,
    check,
    result,
  };
}

module.exports = { analyzeImage, evaluateExtracted };
