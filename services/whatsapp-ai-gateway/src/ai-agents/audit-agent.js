function findRecurringFailures(readings) {
  const counts = new Map();
  for (const reading of readings || []) {
    if (reading.status !== 'FAIL') continue;
    counts.set(reading.item, (counts.get(reading.item) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([item, count]) => ({ item, count }));
}

module.exports = { findRecurringFailures };
