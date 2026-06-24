/**
 * Mi Company OS — Money Operations (Phase 7)
 * 6 financial workflows triggered via WhatsApp or API.
 * All workflows: evidence required, no fabrication, CEO approval for execution.
 */

const MI_PORT = process.env.MI_PORT || '4001';
const ACCOUNTING_PORT = process.env.ACCOUNTING_PORT || '8844';

export type MoneyWorkflowId =
  | 'raw_sales_receipt_check'
  | 'toast_monthly_report_email'
  | 'tax_payment_evidence_pull'
  | 'quickbooks_sync_status'
  | 'payroll_status_check'
  | 'doordash_campaign_monthly';

export interface MoneyWorkflowResult {
  workflow_id: MoneyWorkflowId;
  status: 'PASS' | 'FAIL' | 'PENDING_APPROVAL' | 'DATA_MISSING';
  summary: string;
  evidence: Record<string, unknown>;
  requires_ceo_action?: string;
  data_source: string;
}

// ── Workflow implementations ──────────────────────────────────────────────────

async function fetchLocal(endpoint: string, port = MI_PORT): Promise<unknown> {
  const apiKey = process.env.MI_CORE_API_KEY || '';
  const res = await fetch(`http://localhost:${port}${endpoint}`, {
    headers: { 'x-api-key': apiKey, 'x-mi-auth': apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${endpoint} → HTTP ${res.status}`);
  return res.json();
}

/**
 * W1: Raw Sales Receipt Check
 * Pull last 30 days Toast POS sales + compare to QuickBooks revenue.
 */
export async function rawSalesReceiptCheck(): Promise<MoneyWorkflowResult> {
  try {
    const [toast, qb] = await Promise.allSettled([
      fetchLocal('/api/toast/summary'),
      fetchLocal('/api/quickbooks/summary'),
    ]);

    const toastData = toast.status === 'fulfilled' ? toast.value as Record<string, unknown> : null;
    const qbData   = qb.status   === 'fulfilled' ? qb.value   as Record<string, unknown> : null;

    const toastRevenue = (toastData?.total_revenue as number) ?? null;
    const qbRevenue    = (qbData?.total_revenue    as number) ?? null;

    const discrepancy = (toastRevenue !== null && qbRevenue !== null)
      ? Math.abs(toastRevenue - qbRevenue)
      : null;

    const hasDiscrepancy = discrepancy !== null && discrepancy > 100;

    return {
      workflow_id: 'raw_sales_receipt_check',
      status: hasDiscrepancy ? 'PENDING_APPROVAL' : (toastData ? 'PASS' : 'DATA_MISSING'),
      summary: toastData
        ? `Toast: $${toastRevenue ?? '?'} | QuickBooks: $${qbRevenue ?? '?'}${discrepancy !== null ? ` | Discrepancy: $${discrepancy.toFixed(2)}` : ''}`
        : 'Toast POS data unavailable — check connectivity',
      evidence: { toast: toastData, quickbooks: qbData, discrepancy_usd: discrepancy },
      requires_ceo_action: hasDiscrepancy ? `Revenue discrepancy of $${discrepancy?.toFixed(2)} — investigate before closing books` : undefined,
      data_source: [toast.status === 'fulfilled' ? 'toast-pos' : null, qb.status === 'fulfilled' ? 'quickbooks' : null].filter(Boolean).join(', ') || 'none',
    };
  } catch (err) {
    return {
      workflow_id: 'raw_sales_receipt_check',
      status: 'FAIL',
      summary: `Sales receipt check failed: ${err instanceof Error ? err.message : String(err)}`,
      evidence: {},
      data_source: 'error',
    };
  }
}

/**
 * W2: Toast Monthly Report Email
 * Pull monthly Toast POS report and prepare email to CEO.
 */
export async function toastMonthlyReportEmail(): Promise<MoneyWorkflowResult> {
  try {
    const data = await fetchLocal('/api/toast/monthly') as Record<string, unknown>;
    const month = (data?.month as string) ?? new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return {
      workflow_id: 'toast_monthly_report_email',
      status: 'PENDING_APPROVAL',
      summary: `Monthly Toast report for ${month} ready. Total: $${(data?.total_revenue as number)?.toFixed(2) ?? '?'}. Approve to email to CEO.`,
      evidence: { month, report: data },
      requires_ceo_action: 'Approve to send monthly Toast report email',
      data_source: 'toast-pos',
    };
  } catch {
    return {
      workflow_id: 'toast_monthly_report_email',
      status: 'DATA_MISSING',
      summary: 'Toast monthly endpoint not available. Phase 7 — requires Toast API credentials.',
      evidence: {},
      data_source: 'toast-pos',
    };
  }
}

/**
 * W3: Tax Payment Evidence Pull
 * Pull tax payment records from QuickBooks.
 */
export async function taxPaymentEvidencePull(): Promise<MoneyWorkflowResult> {
  try {
    const data = await fetchLocal('/api/quickbooks/tax-payments') as Record<string, unknown>;
    const payments = (data?.payments as unknown[]) ?? [];
    return {
      workflow_id: 'tax_payment_evidence_pull',
      status: payments.length > 0 ? 'PASS' : 'DATA_MISSING',
      summary: payments.length > 0
        ? `${payments.length} tax payment(s) on record in QuickBooks`
        : 'No tax payment records found in QuickBooks',
      evidence: { payments: payments.slice(0, 10), total: payments.length },
      data_source: 'quickbooks',
    };
  } catch {
    return {
      workflow_id: 'tax_payment_evidence_pull',
      status: 'DATA_MISSING',
      summary: 'QuickBooks tax endpoint unavailable. Verify QuickBooks API credentials.',
      evidence: {},
      data_source: 'quickbooks',
    };
  }
}

/**
 * W4: QuickBooks Sync Status
 * Check when QuickBooks last synced and if any errors.
 */
export async function quickbooksSyncStatus(): Promise<MoneyWorkflowResult> {
  try {
    const data = await fetchLocal('/api/quickbooks/sync-status') as Record<string, unknown>;
    const lastSync   = (data?.last_sync   as string) ?? 'unknown';
    const syncErrors = (data?.errors      as unknown[]) ?? [];
    const isHealthy  = syncErrors.length === 0;
    return {
      workflow_id: 'quickbooks_sync_status',
      status: isHealthy ? 'PASS' : 'FAIL',
      summary: `QuickBooks last sync: ${lastSync}. ${isHealthy ? 'No errors.' : `${syncErrors.length} error(s) detected.`}`,
      evidence: { last_sync: lastSync, errors: syncErrors, raw: data },
      requires_ceo_action: isHealthy ? undefined : 'QuickBooks sync errors require review',
      data_source: 'quickbooks',
    };
  } catch {
    return {
      workflow_id: 'quickbooks_sync_status',
      status: 'DATA_MISSING',
      summary: 'QuickBooks sync endpoint unavailable.',
      evidence: {},
      data_source: 'quickbooks',
    };
  }
}

/**
 * W5: Payroll Status Check
 * Check payroll status from accounting engine.
 */
export async function payrollStatusCheck(): Promise<MoneyWorkflowResult> {
  try {
    const data = await fetchLocal('/api/payroll/status', ACCOUNTING_PORT) as Record<string, unknown>;
    const isPending = (data?.status as string) === 'pending';
    return {
      workflow_id: 'payroll_status_check',
      status: isPending ? 'PENDING_APPROVAL' : 'PASS',
      summary: isPending
        ? `Payroll pending — ${(data?.employee_count as number) ?? '?'} employees, total $${(data?.total_amount as number)?.toFixed(2) ?? '?'}`
        : `Payroll ${(data?.status as string) ?? 'unknown'} — last run: ${(data?.last_run as string) ?? 'unknown'}`,
      evidence: { payroll: data },
      requires_ceo_action: isPending ? 'Approve payroll run' : undefined,
      data_source: 'accounting-engine',
    };
  } catch {
    return {
      workflow_id: 'payroll_status_check',
      status: 'DATA_MISSING',
      summary: 'Payroll endpoint unavailable from accounting engine.',
      evidence: {},
      data_source: 'accounting-engine',
    };
  }
}

/**
 * W6: DoorDash Campaign Monthly Analysis
 * Pull DoorDash ad campaign performance for the month.
 */
export async function doordashCampaignMonthly(): Promise<MoneyWorkflowResult> {
  try {
    const data = await fetchLocal('/api/doordash/campaigns/monthly') as Record<string, unknown>;
    const spend  = (data?.total_spend  as number) ?? null;
    const orders = (data?.total_orders as number) ?? null;
    const roas   = (data?.roas         as number) ?? null;
    return {
      workflow_id: 'doordash_campaign_monthly',
      status: spend !== null ? 'PASS' : 'DATA_MISSING',
      summary: spend !== null
        ? `DoorDash campaigns: Spend $${spend.toFixed(2)}, Orders ${orders}, ROAS ${roas?.toFixed(2) ?? '?'}x`
        : 'DoorDash campaign data unavailable',
      evidence: { spend, orders, roas, raw: data },
      requires_ceo_action: roas !== null && roas < 2 ? 'DoorDash ROAS below 2x — review campaign strategy' : undefined,
      data_source: 'doordash',
    };
  } catch {
    return {
      workflow_id: 'doordash_campaign_monthly',
      status: 'DATA_MISSING',
      summary: 'DoorDash campaign endpoint unavailable. Requires DoorDash API integration.',
      evidence: {},
      data_source: 'doordash',
    };
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function runMoneyWorkflow(workflowId: MoneyWorkflowId): Promise<MoneyWorkflowResult> {
  switch (workflowId) {
    case 'raw_sales_receipt_check':   return rawSalesReceiptCheck();
    case 'toast_monthly_report_email': return toastMonthlyReportEmail();
    case 'tax_payment_evidence_pull':  return taxPaymentEvidencePull();
    case 'quickbooks_sync_status':    return quickbooksSyncStatus();
    case 'payroll_status_check':      return payrollStatusCheck();
    case 'doordash_campaign_monthly': return doordashCampaignMonthly();
    default: return {
      workflow_id: workflowId,
      status: 'FAIL',
      summary: `Unknown workflow: ${workflowId}`,
      evidence: {},
      data_source: 'none',
    };
  }
}

export async function runAllMoneyWorkflows(): Promise<MoneyWorkflowResult[]> {
  const workflows: MoneyWorkflowId[] = [
    'raw_sales_receipt_check',
    'toast_monthly_report_email',
    'tax_payment_evidence_pull',
    'quickbooks_sync_status',
    'payroll_status_check',
    'doordash_campaign_monthly',
  ];
  return Promise.all(workflows.map(runMoneyWorkflow));
}

export function formatMoneyResultForCeo(r: MoneyWorkflowResult): string {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'PENDING_APPROVAL' ? '⏳' : '❓';
  const lines = [`${icon} *${r.workflow_id.replace(/_/g, ' ').toUpperCase()}*`, r.summary];
  if (r.requires_ceo_action) lines.push(`👤 Action: ${r.requires_ceo_action}`);
  return lines.join('\n');
}
