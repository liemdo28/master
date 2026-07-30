function createHumanReview({ checkId, result, items, reason }) {
  return {
    workflow: 'human-review-workflow',
    checkId,
    result,
    status: 'OPEN',
    items: items || [],
    reason: reason || 'Manual confirmation required.',
    createdAt: new Date().toISOString(),
  };
}

module.exports = { createHumanReview };
