function recommendNextAction(summary) {
  const failCount = Number(summary?.fail_count || 0);
  const reviewCount = Number(summary?.needs_review_count || 0);
  if (failCount > 0) return 'Review failed food safety checks and confirm corrective actions.';
  if (reviewCount > 0) return 'Review unclear image submissions and request clearer photos.';
  return 'No immediate food safety action required.';
}

module.exports = { recommendNextAction };
