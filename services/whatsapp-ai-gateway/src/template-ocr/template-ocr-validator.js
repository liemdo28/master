function validateOcrResults(ocrResults, template, { lowConfidence = 0.75 } = {}) {
  const items = [];
  let failCount = 0;
  let unclearCount = 0;

  for (const field of template.fields || []) {
    const ocr = (ocrResults || []).find(r => r.item === field.item_name) || {};
    const value = ocr.value;
    const confidence = Number(ocr.confidence || 0);
    let status = 'PASS';
    let reason = '';

    if (value == null || Number.isNaN(Number(value))) {
      status = 'MISSING';
      reason = 'missing_value';
      unclearCount++;
    } else if (confidence < lowConfidence) {
      status = 'UNCLEAR';
      reason = 'low_confidence';
      unclearCount++;
    } else if (field.target_min != null && Number(value) < Number(field.target_min)) {
      status = 'FAIL_LOW';
      reason = 'below_min';
      failCount++;
    } else if (field.target_max != null && Number(value) > Number(field.target_max)) {
      status = 'FAIL_HIGH';
      reason = 'above_max';
      failCount++;
    }

    items.push({
      item: field.item_name,
      value,
      raw_text: ocr.raw_text || '',
      confidence,
      target_min: field.target_min ?? null,
      target_max: field.target_max ?? null,
      status,
      reason,
      crop_path: ocr.crop_path || '',
    });
  }

  const confidenceValues = items.map(i => i.confidence).filter(v => Number.isFinite(v));
  const confidenceAverage = confidenceValues.length
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0;

  return {
    status: unclearCount > 0 ? 'NEEDS_REVIEW' : (failCount > 0 ? 'FAIL' : 'PASS'),
    items,
    failCount,
    unclearCount,
    confidenceAverage,
    failures: items.filter(i => i.status === 'FAIL_HIGH' || i.status === 'FAIL_LOW').map(i => ({
      name: i.item,
      item: i.item,
      value: i.value,
      min: i.target_min,
      max: i.target_max,
      target: targetText(i),
      reason: i.status === 'FAIL_HIGH' ? 'above_max' : 'below_min',
    })),
    unclear: items.filter(i => ['MISSING', 'UNCLEAR'].includes(i.status)),
  };
}

function targetText(item) {
  if (item.target_min != null && item.target_max != null) return `${item.target_min}-${item.target_max}`;
  if (item.target_min != null) return `>= ${item.target_min}`;
  if (item.target_max != null) return `<= ${item.target_max}`;
  return '';
}

module.exports = { validateOcrResults, targetText };
