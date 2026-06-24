// Daily Pilot Report Generator — per-store metrics for CEO visibility.
//
// Metrics per store:
//   - submission count
//   - completion rate
//   - OCR accuracy
//   - sync success
//   - alerts count
//   - pending review count
//   - failed submissions

export class PilotReport {
  /**
   * @param {object} deps
   * @param {import('../db/RecordStore.js').RecordStore} deps.records
   * @param {import('./ManagerAlerts.js').ManagerAlerts} [deps.alerts]
   * @param {import('./ReviewQueue.js').ReviewQueue} [deps.queue]
   */
  constructor(deps = {}) {
    this._records = deps.records;
    this._alerts = deps.alerts || null;
    this._queue = deps.queue || null;
  }

  /**
   * Generate a daily pilot report for all stores.
   *
   * @param {string} [date] - filter by date (YYYY-MM-DD). Defaults to today.
   * @returns {{ date: string, stores: object, totals: object }}
   */
  generate(date = null) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const allRecords = this._records.list();
    const dayRecords = allRecords.filter((r) => r.date === targetDate);

    const storeNames = ['Rim', 'Stone Oak', 'Bandera'];
    const stores = {};

    for (const store of storeNames) {
      const storeRecords = dayRecords.filter((r) => r.store === store);
      stores[store] = this._storeMetrics(store, storeRecords);
    }

    const totals = this._totals(dayRecords);

    return {
      date: targetDate,
      generated_at: new Date().toISOString(),
      stores,
      totals,
    };
  }

  _storeMetrics(store, records) {
    const total = records.length;
    const completed = records.filter((r) => r.status === 'COMPLETED').length;
    const failed = records.filter((r) => r.status === 'FAILED').length;
    const synced = records.filter((r) => r.sync_status === 'SYNCED').length;
    const confidences = records.map((r) => r.ocr_confidence).filter((c) => typeof c === 'number');
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    const alerts = this._alerts
      ? this._alerts.list({ store }).length
      : 0;

    const pendingReview = this._queue
      ? this._queue.list().filter((q) => q.store === store && q.status !== 'COMPLETED').length
      : 0;

    return {
      submission_count: total,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      ocr_accuracy: Math.round(avgConfidence * 100),
      sync_success: total > 0 ? Math.round((synced / total) * 100) : 0,
      alerts,
      pending_review: pendingReview,
      failed_submissions: failed,
    };
  }

  _totals(records) {
    const total = records.length;
    const completed = records.filter((r) => r.status === 'COMPLETED').length;
    const failed = records.filter((r) => r.status === 'FAILED').length;
    const synced = records.filter((r) => r.sync_status === 'SYNCED').length;
    const confidences = records.map((r) => r.ocr_confidence).filter((c) => typeof c === 'number');
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    return {
      submission_count: total,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      ocr_accuracy: Math.round(avgConfidence * 100),
      sync_success: total > 0 ? Math.round((synced / total) * 100) : 0,
      alerts: this._alerts ? this._alerts.count() : 0,
      pending_review: this._queue ? this._queue.pendingCount() : 0,
      failed_submissions: failed,
    };
  }

  /**
   * Render the pilot report as a Markdown string.
   * @param {object} report - output of generate()
   */
  static renderMarkdown(report) {
    const lines = [
      `# Daily Pilot Report — ${report.date}`,
      '',
      `Generated: ${report.generated_at}`,
      '',
      '## Per-Store Metrics',
      '',
      '| Store | Submissions | Completion | OCR Accuracy | Sync | Alerts | Pending | Failed |',
      '|-------|-------------|-----------|--------------|------|--------|---------|--------|',
    ];

    for (const [store, m] of Object.entries(report.stores)) {
      lines.push(
        `| ${store} | ${m.submission_count} | ${m.completion_rate}% | ${m.ocr_accuracy}% | ${m.sync_success}% | ${m.alerts} | ${m.pending_review} | ${m.failed_submissions} |`,
      );
    }

    const t = report.totals;
    lines.push(
      `| **Total** | **${t.submission_count}** | **${t.completion_rate}%** | **${t.ocr_accuracy}%** | **${t.sync_success}%** | **${t.alerts}** | **${t.pending_review}** | **${t.failed_submissions}** |`,
    );

    lines.push('', '## Summary', '');
    if (t.submission_count === 0) {
      lines.push('No submissions recorded for this date.');
    } else {
      lines.push(`- ${t.submission_count} total submissions across all stores`);
      lines.push(`- ${t.completion_rate}% completion rate`);
      lines.push(`- ${t.ocr_accuracy}% average OCR accuracy`);
      if (t.alerts > 0) lines.push(`- ⚠️ ${t.alerts} unresolved alerts`);
      if (t.pending_review > 0) lines.push(`- 📋 ${t.pending_review} items pending review`);
      if (t.failed_submissions > 0) lines.push(`- ❌ ${t.failed_submissions} failed submissions`);
    }

    return lines.join('\n');
  }
}
