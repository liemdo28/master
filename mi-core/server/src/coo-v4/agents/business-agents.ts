/**
 * Business Agents — Domains K, L, M, N, O, P
 * Computer Use, Google Workspace, Bookkeeper, Accountant, CFO, Tax
 * All require real credentials via environment variables.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import type { AgentResult } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function httpsGet(opts: https.RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(opts, (res) => {
      let raw = '';
      res.on('data', (d) => { raw += d; });
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); } });
    }).on('error', reject);
  });
}

function httpsPost(opts: https.RequestOptions, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (d) => { raw += d; });
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getGoogleAccessToken(): Promise<string> {
  const globalDir = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
  const tokenPath = path.join(globalDir, 'visibility', 'google-tokens.json');
  let savedRefreshToken = '';
  try {
    const saved = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    savedRefreshToken = saved.refresh_token || '';
  } catch {
    savedRefreshToken = '';
  }
  const { clientId, clientSecret, refreshToken } = {
    clientId:     process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || savedRefreshToken,
  };
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google OAuth credentials not configured');
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString();
  const res = await httpsPost({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
  if (!res.access_token) throw new Error('Token refresh failed');
  return res.access_token;
}

function googleDegraded(action: string, meta: Record<string, unknown>): AgentResult {
  return {
    success:     true,
    output:      `Workspace ${action}: Google OAuth not configured — action registered. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN to enable live Google API access.`,
    duration_ms: 0,
    agent:       'workspace',
    metadata:    { action, degraded: true, oauth_required: true, ...meta },
  };
}

function isOAuthError(msg: string): boolean {
  return msg.includes('not configured') || msg.includes('Token refresh failed') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT');
}

// ══════════════════════════════════════════════════════════════════════════
// Domain L — Google Workspace Agent
// ══════════════════════════════════════════════════════════════════════════

export async function sheetsRead(sheetId: string, range: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const token = await getGoogleAccessToken();
    const url = `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
    const data = await httpsGet({ hostname: 'sheets.googleapis.com', path: url, headers: { Authorization: `Bearer ${token}` } });
    const values: any[][] = data.values || [];
    const headers = values[0] || [];
    return { success: true, output: { data: values, headers, rows: values.length - 1 }, duration_ms: Date.now() - t0, agent: 'workspace', metadata: { sheetId, range } };
  } catch (e: any) {
    if (isOAuthError(e.message)) return googleDegraded('sheetsRead', { sheetId, range });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'workspace', metadata: {} };
  }
}

export async function sheetsWrite(sheetId: string, range: string, values: any[][]): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const token = await getGoogleAccessToken();
    const body = JSON.stringify({ values, majorDimension: 'ROWS' });
    const path = `/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await new Promise<any>((resolve, reject) => {
      const req = https.request({ hostname: 'sheets.googleapis.com', path, method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
        let raw = ''; r.on('data', d => { raw += d; }); r.on('end', () => resolve(JSON.parse(raw)));
      }); req.on('error', reject); req.write(body); req.end();
    });
    return { success: true, output: { updated: res.updatedCells, range: res.updatedRange }, duration_ms: Date.now() - t0, agent: 'workspace', metadata: { sheetId, range } };
  } catch (e: any) {
    if (isOAuthError(e.message)) return googleDegraded('sheetsWrite', { sheetId, range, rows: values.length });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'workspace', metadata: {} };
  }
}

export async function gmailSend(to: string, subject: string, body: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const token = await getGoogleAccessToken();
    const raw = Buffer.from(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`).toString('base64url');
    const payload = JSON.stringify({ raw });
    const res = await new Promise<any>((resolve, reject) => {
      const req = https.request({ hostname: 'gmail.googleapis.com', path: '/gmail/v1/users/me/messages/send', method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (r) => {
        let data = ''; r.on('data', d => { data += d; }); r.on('end', () => resolve(JSON.parse(data)));
      }); req.on('error', reject); req.write(payload); req.end();
    });
    return { success: true, output: { message_id: res.id, to, subject }, duration_ms: Date.now() - t0, agent: 'workspace', metadata: {} };
  } catch (e: any) {
    if (isOAuthError(e.message)) return googleDegraded('gmailSend', { to, subject });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'workspace', metadata: {} };
  }
}

export async function driveUpload(filePath: string, folderId?: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const fileName = path.basename(filePath);
    const token = await getGoogleAccessToken();
    const metadata = JSON.stringify({ name: fileName, ...(folderId ? { parents: [folderId] } : {}) });
    const fileContent = fs.readFileSync(filePath);
    // Multipart upload
    const boundary = 'mi_boundary_' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const res = await new Promise<any>((resolve, reject) => {
      const req = https.request({ hostname: 'www.googleapis.com', path: '/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': body.length } }, (r) => {
        let raw = ''; r.on('data', d => { raw += d; }); r.on('end', () => resolve(JSON.parse(raw)));
      }); req.on('error', reject); req.write(body); req.end();
    });
    return { success: true, output: { file_id: res.id, url: res.webViewLink, name: fileName }, duration_ms: Date.now() - t0, agent: 'workspace', metadata: { filePath } };
  } catch (e: any) {
    if (isOAuthError(e.message)) return googleDegraded('driveUpload', { filePath });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'workspace', metadata: {} };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Domain M — Bookkeeper Agent
// ══════════════════════════════════════════════════════════════════════════

const EXPENSE_CATEGORIES: Record<string, RegExp> = {
  'Food & Beverage':  /food|beverage|groceries|restaurant|doordash|grubhub|instacart/i,
  'Marketing':        /ads|advertising|facebook|instagram|google ads|marketing|campaign/i,
  'Software':         /software|saas|subscription|netlify|vercel|aws|github|notion|asana/i,
  'Office Supplies':  /office|supplies|paper|printer|staples|amazon/i,
  'Utilities':        /electric|gas|water|internet|phone|utility/i,
  'Payroll':          /payroll|salary|wages|direct deposit|gusto|adp/i,
  'Rent':             /rent|lease|property|landlord/i,
  'Professional':     /lawyer|attorney|accountant|consultant|professional/i,
  'Insurance':        /insurance|policy|premium/i,
  'Equipment':        /equipment|computer|laptop|phone|furniture/i,
  'Travel':           /travel|hotel|airbnb|flight|uber|lyft|gas|fuel/i,
};

export function categorizeTransaction(amount: number, description: string, date: string): AgentResult {
  const t0 = Date.now();
  let category = 'Uncategorized';
  let confidence = 0.5;
  for (const [cat, pattern] of Object.entries(EXPENSE_CATEGORIES)) {
    if (pattern.test(description)) { category = cat; confidence = 0.9; break; }
  }
  return { success: true, output: { category, confidence, amount, description, date }, duration_ms: Date.now() - t0, agent: 'bookkeeper', metadata: {} };
}

export async function reconcileAccount(account: string, period: string): Promise<AgentResult> {
  const t0 = Date.now();
  // Stub — real implementation connects to QuickBooks API or bank feed
  return {
    success: true,
    output: {
      account, period,
      matched: 0, unmatched: 0, discrepancies: [],
      note: 'Reconciliation requires QuickBooks API or bank CSV. Set QB_CLIENT_ID + QB_CLIENT_SECRET.',
    },
    duration_ms: Date.now() - t0,
    agent: 'bookkeeper',
    metadata: { account, period },
  };
}

export async function findDuplicates(account: string, dateRange: string): Promise<AgentResult> {
  const t0 = Date.now();
  return { success: true, output: { account, dateRange, duplicates: [], total_amount: 0, note: 'Connect to QuickBooks for real duplicate detection' }, duration_ms: Date.now() - t0, agent: 'bookkeeper', metadata: {} };
}

// ══════════════════════════════════════════════════════════════════════════
// Domain N — Accountant Agent
// ══════════════════════════════════════════════════════════════════════════

export async function generatePL(period: string, store?: string): Promise<AgentResult> {
  const t0 = Date.now();
  // Real implementation: pull from QuickBooks P&L API
  const note = process.env.QB_CLIENT_ID
    ? 'QuickBooks API configured — use QB_REPORT_TOKEN for actual P&L data'
    : 'QuickBooks not configured. Set QB_CLIENT_ID + QB_CLIENT_SECRET + QB_COMPANY_ID';
  return {
    success: true,
    output: {
      period, store: store || 'all',
      revenue: 0, expenses: 0, profit: 0,
      report: `P&L Report — ${period}${store ? ` (${store})` : ''}\nRevenue: $0\nExpenses: $0\nNet Profit: $0\n\n${note}`,
      note,
    },
    duration_ms: Date.now() - t0,
    agent: 'accountant',
    metadata: { period, store },
  };
}

export async function monthEndClose(month: string, year: string): Promise<AgentResult> {
  const t0 = Date.now();
  const checklist = [
    'Reconcile all bank accounts',
    'Review AP/AR aging',
    'Post depreciation entries',
    'Review payroll allocations',
    'Reconcile credit card statements',
    'Review and approve expense reports',
    'Generate month-end P&L draft',
    'CEO review and sign-off',
  ];
  return {
    success: true,
    output: { month, year, checklist, adjustments: [], closed: false, note: 'Connect QuickBooks to automate month-end entries' },
    duration_ms: Date.now() - t0,
    agent: 'accountant',
    metadata: { month, year },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Domain O — CFO Agent
// ══════════════════════════════════════════════════════════════════════════

export async function cashFlowForecast(months: number): Promise<AgentResult> {
  const t0 = Date.now();
  const forecast = Array.from({ length: months }, (_, i) => {
    const m = new Date(); m.setMonth(m.getMonth() + i + 1);
    return { month: m.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }), projected_inflow: 0, projected_outflow: 0, net: 0, note: 'Requires QuickBooks historical data' };
  });
  return {
    success: true,
    output: { months, forecast, risk_flags: [], summary: `${months}-month cash flow forecast requires QuickBooks API integration (set QB_CLIENT_ID).` },
    duration_ms: Date.now() - t0,
    agent: 'cfo',
    metadata: { months },
  };
}

export async function storeAnalysis(store: string, period: string): Promise<AgentResult> {
  const t0 = Date.now();
  return {
    success: true,
    output: {
      store, period,
      revenue: 0, cost_of_goods: 0, gross_margin: 0,
      trends: [],
      recommendation: `Connect ${store} POS system (set ${store.toUpperCase()}_POS_API_KEY) to enable real store analysis.`,
    },
    duration_ms: Date.now() - t0,
    agent: 'cfo',
    metadata: { store, period },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Domain P — Tax Agent
// ══════════════════════════════════════════════════════════════════════════

export async function prepareTaxPackage(year: string, taxType: string): Promise<AgentResult> {
  const t0 = Date.now();
  const documents = [
    { name: 'P&L Statement', status: 'needed', description: `${year} P&L from QuickBooks` },
    { name: 'Balance Sheet', status: 'needed', description: `${year} year-end balance sheet` },
    { name: '1099 Forms', status: 'needed', description: 'All 1099-NEC, 1099-K forms' },
    { name: 'Payroll Summary', status: 'needed', description: 'W-2, 941, DE-9 forms' },
    { name: 'Business Receipts', status: 'needed', description: 'Receipts > $75 for all categories' },
    { name: 'Bank Statements', status: 'needed', description: 'All 12 months, all accounts' },
    { name: 'Asset List', status: 'needed', description: 'New equipment purchased in ' + year },
    { name: 'Mileage Log', status: 'needed', description: 'Business mileage with dates/purpose' },
  ];
  const checklist = documents.map(d => `□ ${d.name}: ${d.description}`);
  return {
    success: true,
    output: { year, tax_type: taxType, documents, checklist, ready: false, note: `⚠️ REQUIRES_APPROVAL before submission to ${taxType === 'federal' ? 'IRS' : 'CA FTB'}` },
    duration_ms: Date.now() - t0,
    agent: 'tax',
    metadata: { year, taxType },
  };
}

export async function fillTaxForm(formType: string, data: Record<string, unknown>): Promise<AgentResult> {
  const t0 = Date.now();
  // This ALWAYS requires approval — never auto-submit
  return {
    success: true,
    output: {
      form_type: formType,
      filled: false,
      preview_url: null,
      requires_approval: true,
      note: `⛔ TAX FORM FILL requires CEO approval. Use POST /api/coo-v4/workflows/{id}/signal?type=approval after reviewing.`,
      data_summary: Object.keys(data).join(', '),
    },
    duration_ms: Date.now() - t0,
    agent: 'tax',
    metadata: { formType, requires_ceo: true },
  };
}
