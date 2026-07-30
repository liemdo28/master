/**
 * Mi Company OS — Accounting Department (Finance)
 * Handles: P&L checks, cash flow, expense reports, budget tracking.
 *
 * Data sources:
 *   - /api/visibility/dashboard (connector status + metrics)
 *   - strategic-memory trends
 *   - QuickBooks runtime (if configured)
 *
 * Approval required: YES — no financial output without CEO approval gate.
 */

import { runDepartment, type RuntimeOutput } from './department-runtime';
import { recordStep, completeStep } from './evidence-store';
import type { DeptReport } from './report-center';

const DEPT_ID = 'finance';
const QB_URL = process.env.QUICKBOOKS_RUNTIME_URL || 'http://localhost:3210';
const MI_PORT = process.env.MI_PORT || '4001';
const API_KEY = process.env.MI_CORE_API_KEY || '';

export interface AccountingRequest {
  pipeline_id: string;
  intent: string;
  command: string;
  date_range?: { from: string; to: string };
}

export interface AccountingReport extends DeptReport {
  data_sources: string[];
  period?: string;
  requires_approval: true;
}

// ── Live data fetch ────────────────────────────────────────────────────────────

async function fetchQbSummary(): Promise<unknown> {
  try {
    const res = await fetch(`${QB_URL}/api/summary`, {
      headers: { 'x-api-key': API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`QB ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

async function fetchVisibilityFinance(): Promise<unknown> {
  try {
    const res = await fetch(`http://localhost:${MI_PORT}/api/visibility/dashboard`, {
      headers: { 'x-api-key': API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: unknown };
    return data?.data || data;
  } catch {
    return null;
  }
}

// ── Main executor ─────────────────────────────────────────────────────────────

export async function executeAccountingRequest(req: AccountingRequest): Promise<AccountingReport> {
  const { pipeline_id, intent, command } = req;

  // Gather live financial data
  const dataStep = recordStep(pipeline_id, DEPT_ID, 'financial_data_fetch', { intent });
  const [qbData, visData] = await Promise.all([fetchQbSummary(), fetchVisibilityFinance()]);

  const dataSources: string[] = [];
  const contextParts: string[] = [];

  if (qbData) {
    dataSources.push('QuickBooks Runtime');
    contextParts.push(`QuickBooks Data:\n${JSON.stringify(qbData, null, 2).substring(0, 1500)}`);
  } else {
    contextParts.push('QuickBooks: unavailable (check QB runtime service)');
  }

  if (visData) {
    dataSources.push('Visibility Dashboard');
    contextParts.push(`Business Metrics:\n${JSON.stringify(visData, null, 2).substring(0, 1500)}`);
  }

  completeStep(dataStep.id, { sources: dataSources, qb_available: !!qbData }, dataSources.length > 0 ? 0.85 : 0.40);

  // Run brain with financial context
  const runtimeResult: RuntimeOutput = await runDepartment({
    pipeline_id,
    dept_id: DEPT_ID,
    intent,
    command,
    extra_context: contextParts.join('\n\n') || 'No live financial data available — state this clearly.',
  });

  // Approval gate record
  const approvalStep = recordStep(pipeline_id, DEPT_ID, 'approval_gate_check', { requires_approval: true });
  completeStep(approvalStep.id, {
    policy: 'REQUIRES_APPROVAL',
    message: 'Finance output requires CEO approval before any action is taken',
  }, 1.0);

  return {
    ...runtimeResult,
    dept_id: DEPT_ID,
    dept_name: 'Finance & Accounting',
    data_sources: dataSources,
    requires_approval: true,
    summary: dataSources.length > 0
      ? `Finance analysis complete. Sources: ${dataSources.join(', ')}. CEO approval required before action.`
      : 'Finance analysis complete. QuickBooks unavailable — data may be incomplete. CEO approval required.',
  };
}
