const foodSafetyPipeline = require('../food-safety/food-safety-pipeline');
const storage = require('../storage/food-safety-storage');

async function runFoodSafetyWorkflow(imagePath, metadata, mockAnalyzedResult = null) {
  const startedAt = new Date().toISOString();
  const output = await foodSafetyPipeline.runPipeline(imagePath, metadata, mockAnalyzedResult);
  await storage.saveWorkflowRun({
    workflowName: 'food-safety-workflow',
    status: output.result,
    inputJson: { imagePath, metadata },
    outputJson: output,
    startedAt,
    completedAt: new Date().toISOString(),
  });
  return output;
}

module.exports = { runFoodSafetyWorkflow };
