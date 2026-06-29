import { Router } from 'express';
import os from 'os';
import { parseRevenueCSV, saveRevenueData, getCachedRevenue, RevenueSource } from '../visibility/connectors/revenue-connector';

export const revenueRouter = Router();

// POST /api/revenue/intake
// Body: { source: 'toast'|'doordash', csv: '<csv text>' }
revenueRouter.post('/intake', (req, res) => {
  try {
    const { source, csv, json } = req.body || {};

    if (!source || !['toast', 'doordash', 'quickbooks'].includes(source)) {
      return res.status(400).json({ ok: false, error: 'source must be "toast", "doordash", or "quickbooks"' });
    }

    let parsed;
    if (csv) {
      parsed = parseRevenueCSV(source as RevenueSource, csv);
      if (!parsed) {
        return res.status(400).json({
          ok: false,
          error: 'Could not parse CSV — check column headers',
          hint: source === 'toast'
            ? 'Toast CSV needs columns: Date, Net Sales (or Gross Sales)'
            : 'DoorDash CSV needs columns: Subtotal (or Merchant Total) and/or Payout',
        });
      }
    } else if (json) {
      parsed = { source, imported_at: new Date().toISOString(), raw_rows: 1, ...json };
    } else {
      return res.status(400).json({ ok: false, error: 'Provide either csv or json in request body' });
    }

    const cache = saveRevenueData(source as RevenueSource, parsed as any);
    return res.json({
      ok: true,
      source,
      rows_imported: (parsed as any).raw_rows ?? 1,
      period: `${(parsed as any).period_start} to ${(parsed as any).period_end}`,
      summary: cache.summary_text,
      total_estimate: cache.total_revenue_estimate,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

// GET /api/revenue/summary
revenueRouter.get('/summary', (_req, res) => {
  const cached = getCachedRevenue();
  if (!cached) {
    return res.json({
      ok: true,
      status: 'no_data',
      how_to_import: {
        step1: 'On laptop1, open https://pos.toasttab.com → Reports → Export CSV (date range: last 7 or 30 days)',
        step2: 'On laptop1, open DoorDash Merchant Portal → Reports → Export CSV',
        step3: `On laptop1, run: MI_CORE_URL=http://${_getMiCoreIP()}:4001 node tools/upload-revenue.mjs toast toast-export.csv`,
        step4: `On laptop1, run: MI_CORE_URL=http://${_getMiCoreIP()}:4001 node tools/upload-revenue.mjs doordash doordash-export.csv`,
      },
    });
  }
  return res.json({ ok: true, status: 'ok', ...cached });
});

function _getMiCoreIP(): string {
  try {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const net of iface || []) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch { /* ignore */ }
  return 'YOUR_MI_CORE_IP';
}
