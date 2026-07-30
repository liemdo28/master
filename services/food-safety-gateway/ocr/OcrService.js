// OCR service for Food Safety form photos.
//
// This is intentionally pluggable: the real pilot can inject a provider that
// calls a cloud OCR API. The default provider is a deterministic stub so the
// core flow and tests run with zero external dependencies.

/**
 * @typedef {object} OcrItem
 * @property {string} label   - e.g. "Walk-In Cooler"
 * @property {number} value   - numeric reading
 * @property {string} unit    - e.g. "°F"
 */

/**
 * @typedef {object} OcrResult
 * @property {OcrItem[]} items
 * @property {number} confidence  - 0..1
 * @property {object} fields      - extracted header fields (employee_name, shift, manager, date)
 * @property {string} rawText
 */

/**
 * Default deterministic OCR provider.
 * Produces a stable, realistic result regardless of the input image so the
 * pipeline can be exercised end-to-end without a real OCR backend.
 *
 * @param {object} ctx
 * @returns {Promise<OcrResult>}
 */
async function defaultProvider(ctx = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    items: [
      { label: 'Walk-In Cooler', value: 38, unit: '°F' },
      { label: 'Reach-In Cooler', value: 39, unit: '°F' },
      { label: 'Freezer', value: -2, unit: '°F' },
    ],
    confidence: 0.92,
    fields: {
      employee_name: ctx.employeeName || 'Unknown',
      shift: 'AM',
      manager: 'On Duty',
      date: today,
    },
    rawText: 'Food Safety Daily Log\nWalk-In Cooler 38F\nReach-In Cooler 39F\nFreezer -2F',
  };
}

export class OcrService {
  /**
   * @param {object} [opts]
   * @param {(ctx: object) => Promise<OcrResult>} [opts.provider]
   */
  constructor(opts = {}) {
    this._provider = opts.provider || defaultProvider;
  }

  /**
   * Run OCR against a saved image path.
   * @param {string} imagePath
   * @param {object} [ctx] - extra context (employeeName, store, etc.)
   * @returns {Promise<OcrResult>}
   */
  async extract(imagePath, ctx = {}) {
    const result = await this._provider({ imagePath, ...ctx });
    if (!result || !Array.isArray(result.items)) {
      throw new Error('OCR provider returned an invalid result');
    }
    return result;
  }

  /**
   * Build a human-readable confirmation summary for WhatsApp.
   * @param {OcrResult} result
   */
  static summarize(result) {
    const lines = result.items.map((i) => `${i.label}: ${i.value}${i.unit}`);
    return [
      'I detected:',
      ...lines,
      '',
      'Reply:',
      '1 Confirm',
      '2 Retake Photo',
      '3 Cancel',
    ].join('\n');
  }
}
