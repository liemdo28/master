import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';

const MI_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const DD_DB_PATH = process.env.QB_DB_PATH || path.join(MI_ROOT, 'data', 'qb-agent.db');
const AGENT_DB_PATH = process.env.MI_DATA_DIR
  ? path.join(process.env.MI_DATA_DIR, 'qb-agent.db')
  : path.join(MI_ROOT, 'data', 'qb-agent.db');
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'quickbooks');
const LOCAL_CACHE_DIR = path.join(MI_ROOT, '.local-agent-global', 'visibility', 'quickbooks');
const DEV1_RUNTIME_EVIDENCE_FILES = [
  path.join(CACHE_DIR, 'dev1-runtime-evidence.json'),
  path.join(LOCAL_CACHE_DIR, 'dev1-runtime-evidence.json'),
];
const COMPANY_REGISTRY_FILES = [
  path.join(CACHE_DIR, 'company-registry.json'),
  path.join(LOCAL_CACHE_DIR, 'company-registry.json'),
];

export interface QuickBooksRuntimeSnapshot {
  generated_at: string;
  status: 'healthy' | 'degraded' | 'failed' | 'needs_dev1_action' | 'not_configured';
  dashboard_status: 'healthy' | 'degraded' | 'failed' | 'needs_dev1_action';
  certified: boolean;
  db_paths: { checksum_db: string; agent_db: string };
  company_detected: boolean;
  quickbooks_desktop_open: boolean;
  last_successful_sync: string | null;
  last_sync_timestamp: string | null;
  last_sync_status: string | null;
  checksum: {
    mismatch: boolean;
    expected: string | null;
    got: string | null;
  };
  company_identity: {
    detected_machine_id: string | null;
    detected_company_name: string | null;
    detected_company_file: string | null;
    detected_company_id: string | null;
    expected_company_id: string | null;
    expected_company_name: string | null;
    identity_matched: boolean;
    machine_allowed: boolean;
    allowed_machine_ids: string[];
    path_accepted: boolean;
    path_match_required: boolean;
    approved_paths: string[];
    mismatch_reason: string | null;
  };
  activity: {
    today_transactions: number;
    today_amount: number;
    latest_activity_at: string | null;
    latest_business_date: string | null;
  };
  duplicates: {
    duplicate_bills: unknown[];
    duplicate_payments: unknown[];
  };
  machines: unknown[];
  errors: unknown[];
  gaps: string[];
  action_required: boolean;
  required_dev1_action: string | null;
  handoff_package_path: string | null;
  daily_report_path: string;
}

export interface Dev1QuickBooksHandoffPackage {
  generated_at: string;
  failure_type: string;
  expected_checksum: string | null;
  actual_checksum: string | null;
  last_successful_sync: string | null;
  company_detected: boolean;
  qb_open: boolean;
  required_dev1_action: string;
  screenshots_or_log_paths: string[];
  dashboard_status: 'needs_dev1_action';
  gaps: string[];
  errors: unknown[];
}

interface Dev1RuntimeEvidence {
  result?: 'STABLE' | 'NOT_STABLE' | 'BLOCKED';
  failure_type?: string;
  expected_checksum?: string | null;
  actual_checksum?: string | null;
  last_successful_sync?: string | null;
  company_detected?: boolean;
  qb_open?: boolean;
  configured_file?: string | null;
  detected_company_file?: string | null;
  detected_company_id?: string | null;
  detected_company_name?: string | null;
  expected_company_id?: string | null;
  expected_company_name?: string | null;
  mi_core_reporting?: string | null;
  outbox_pending?: number | null;
  transaction_count_verified?: boolean;
  duplicate_bills_verified?: boolean;
  duplicate_payments_verified?: boolean;
  screenshot_valid?: boolean;
  required_dev1_action?: string;
  evidence_files?: string[];
  gaps?: string[];
  errors?: unknown[];
  observed_at?: string;
}

interface CompanyRegistryEntry {
  company_id: string;
  company_name: string;
  aliases?: string[];
  approved_paths?: string[];
  allowed_machine_ids?: string[];
  path_match_required?: boolean;
  production?: boolean;
}

function tableExists(db: Database.Database, table: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
}

function safeAll(db: Database.Database, sql: string, params: unknown[] = []): unknown[] {
  try { return db.prepare(sql).all(...params); } catch { return []; }
}

function safeGet<T = any>(db: Database.Database, sql: string, params: unknown[] = []): T | null {
  try { return db.prepare(sql).get(...params) as T || null; } catch { return null; }
}

function parseChecksum(error?: string | null): { expected: string | null; got: string | null; mismatch: boolean } {
  const text = error || '';
  const match = text.match(/expected\s+([a-f0-9]{64})\s+got\s+([a-f0-9]{64})/i);
  return { expected: match?.[1] || null, got: match?.[2] || null, mismatch: /checksum mismatch/i.test(text) };
}

function ageMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 60_000));
}

function isRecentRecord(row: any, maxAgeMinutes: number): boolean {
  const iso = row?.received_at || row?.timestamp || row?.created_at || row?.occurred_at || null;
  const age = ageMinutes(typeof iso === 'string' ? iso : null);
  return age !== null && age <= maxAgeMinutes;
}

function isEvidenceStale(evidence: Dev1RuntimeEvidence | null, latestHeartbeat: any): boolean {
  if (!evidence?.observed_at || !latestHeartbeat?.received_at) return false;
  const evidenceTs = Date.parse(evidence.observed_at);
  const heartbeatTs = Date.parse(latestHeartbeat.received_at);
  if (Number.isNaN(evidenceTs) || Number.isNaN(heartbeatTs)) return false;
  return evidenceTs < heartbeatTs;
}

function parseHeartbeatMeta(heartbeat: any): Record<string, unknown> {
  if (!heartbeat?.meta_json) return {};
  try {
    const parsed = JSON.parse(String(heartbeat.meta_json));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function isInformativeQbHeartbeat(heartbeat: any): boolean {
  if (!heartbeat) return false;
  const status = String(heartbeat.status || '');
  const appVersion = String(heartbeat.app_version || '');
  const meta = parseHeartbeatMeta(heartbeat);
  return status.startsWith('QB_')
    || appVersion === 'heartbeat-bridge'
    || Boolean(heartbeat.qb_company)
    || Boolean(meta.company_id || meta.company_file || meta.source === 'MiCore-QB-Heartbeat-Bridge');
}

function selectQbRuntimeHeartbeat(heartbeats: any[]): any {
  return heartbeats.find(isInformativeQbHeartbeat) || heartbeats[0] || {};
}

function hasRows(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function readChecksumDb() {
  if (!fs.existsSync(DD_DB_PATH)) return { state: null, syncs: [] as unknown[] };
  const db = new Database(DD_DB_PATH, { readonly: true });
  const state = tableExists(db, 'dd_machine_state')
    ? safeGet(db, 'SELECT * FROM dd_machine_state ORDER BY updated_at DESC LIMIT 1')
    : null;
  const syncs = tableExists(db, 'dd_machine_syncs')
    ? safeAll(db, 'SELECT * FROM dd_machine_syncs ORDER BY rowid DESC LIMIT 50')
    : [];
  db.close();
  return { state, syncs };
}

function readAgentDb() {
  if (!fs.existsSync(AGENT_DB_PATH)) {
    return { machines: [], heartbeats: [], activity: [], syncResults: [], errors: [], qbFiles: [], commands: [] };
  }
  const db = new Database(AGENT_DB_PATH, { readonly: true });
  const machines = tableExists(db, 'machines') ? safeAll(db, 'SELECT * FROM machines ORDER BY last_seen_at DESC LIMIT 20') : [];
  const heartbeats = tableExists(db, 'heartbeats') ? safeAll(db, 'SELECT * FROM heartbeats ORDER BY received_at DESC LIMIT 20') : [];
  const activity = tableExists(db, 'activity_log_results') ? safeAll(db, 'SELECT * FROM activity_log_results ORDER BY received_at DESC LIMIT 20') : [];
  const syncResults = tableExists(db, 'sync_results') ? safeAll(db, 'SELECT * FROM sync_results ORDER BY received_at DESC LIMIT 20') : [];
  const errors = tableExists(db, 'error_reports') ? safeAll(db, 'SELECT * FROM error_reports ORDER BY received_at DESC LIMIT 20') : [];
  const qbFiles = tableExists(db, 'qb_files') ? safeAll(db, 'SELECT * FROM qb_files ORDER BY updated_at DESC LIMIT 20') : [];
  const commands = tableExists(db, 'commands') ? safeAll(db, 'SELECT * FROM commands ORDER BY created_at DESC LIMIT 20') : [];
  db.close();
  return { machines, heartbeats, activity, syncResults, errors, qbFiles, commands };
}

function recentSuccessfulSync(syncs: any[], syncResults: any[]): string | null {
  const applied = syncs.find(s => ['SYNC_APPLIED', 'SYNC_UP_TO_DATE'].includes(String(s.event_type || '')));
  const completed = syncResults.find(s => /completed|success|ok/i.test(String(s.status || '')));
  return applied?.timestamp || completed?.received_at || null;
}

function computeTodayActivity(activity: any[]) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = activity.filter(r => String(r.business_date || r.received_at || '').startsWith(today));
  return {
    today_transactions: rows.reduce((s, r) => s + Number(r.total_transactions || 0), 0),
    today_amount: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
    latest_activity_at: activity[0]?.received_at || null,
    latest_business_date: activity[0]?.business_date || null,
  };
}

function findDuplicates(activity: any[]) {
  const billKeys = new Map<string, any[]>();
  const paymentKeys = new Map<string, any[]>();
  for (const row of activity) {
    const metrics = parseJson(row.metrics_json, {});
    const key = `${row.store_code || ''}|${row.business_date || ''}|${row.total_amount || 0}|${row.latest_sales_receipt_ref || ''}`;
    if (row.latest_sales_receipt_ref || row.total_amount) {
      const arr = paymentKeys.get(key) || [];
      arr.push(row);
      paymentKeys.set(key, arr);
    }
    const billRef = metrics.bill_ref || metrics.invoice_ref;
    if (billRef) {
      const billKey = `${row.store_code || ''}|${billRef}|${row.total_amount || 0}`;
      const arr = billKeys.get(billKey) || [];
      arr.push(row);
      billKeys.set(billKey, arr);
    }
  }
  return {
    duplicate_bills: [...billKeys.values()].filter(v => v.length > 1),
    duplicate_payments: [...paymentKeys.values()].filter(v => v.length > 1),
  };
}

function parseJson(text: string, fallback: any) {
  try { return JSON.parse(text || ''); } catch { return fallback; }
}

function readDev1RuntimeEvidence(): Dev1RuntimeEvidence | null {
  for (const file of DEV1_RUNTIME_EVIDENCE_FILES) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')) as Dev1RuntimeEvidence;
    } catch {
      // Ignore malformed handoff evidence and keep DB-derived status authoritative.
    }
  }
  return null;
}

function readCompanyRegistry(): CompanyRegistryEntry[] {
  for (const file of COMPANY_REGISTRY_FILES) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return Array.isArray(data?.companies) ? data.companies : [];
      }
    } catch {
      // Ignore malformed registry files and fall back to no registry.
    }
  }
  return [];
}

function normalizeText(value?: string | null): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizePath(value?: string | null): string {
  return String(value || '').replace(/\//g, '\\').toLowerCase();
}

function fileName(value?: string | null): string | null {
  const text = String(value || '').replace(/\//g, '\\');
  return text ? text.split('\\').filter(Boolean).pop() || null : null;
}

function candidateCompanyNames(evidence: Dev1RuntimeEvidence | null, latestHeartbeat: any, qbFiles: any[]): string[] {
  return [
    evidence?.detected_company_name,
    latestHeartbeat.qb_company,
    ...qbFiles.map(f => f.expected_company_name),
  ].filter(Boolean).map(String);
}

function candidateCompanyPaths(evidence: Dev1RuntimeEvidence | null, qbFiles: any[]): string[] {
  return [
    evidence?.detected_company_file,
    ...qbFiles.map(f => f.company_file_path),
  ].filter(Boolean).map(String);
}

function resolveCompanyIdentity(evidence: Dev1RuntimeEvidence | null, latestHeartbeat: any, qbFiles: any[]) {
  const registry = readCompanyRegistry();
  const names = candidateCompanyNames(evidence, latestHeartbeat, qbFiles);
  const paths = candidateCompanyPaths(evidence, qbFiles);
  const detectedMachineId = latestHeartbeat.machine_id || null;
  const detectedCompanyName = names[0] || null;
  const detectedCompanyFile = paths[0] || null;
  const detectedCompanyId = evidence?.detected_company_id || null;
  const expectedCompanyId = evidence?.expected_company_id || null;
  const expectedCompanyName = evidence?.expected_company_name || null;
  const detectedFileName = fileName(detectedCompanyFile);

  const entry = registry.find(company => {
    if (detectedCompanyId && normalizeText(company.company_id) === normalizeText(detectedCompanyId)) return true;
    if (expectedCompanyId && normalizeText(company.company_id) === normalizeText(expectedCompanyId)) return true;
    const allowedNames = [company.company_name, ...(company.aliases || [])].map(normalizeText);
    if (names.some(name => allowedNames.includes(normalizeText(name)))) return true;
    return (company.approved_paths || []).some(p => normalizePath(p) === normalizePath(detectedCompanyFile));
  }) || null;

  const approvedPaths = entry?.approved_paths || [];
  const pathAccepted = !detectedCompanyFile
    ? false
    : approvedPaths.some(p => normalizePath(p) === normalizePath(detectedCompanyFile))
      || approvedPaths.some(p => normalizeText(fileName(p)) === normalizeText(detectedFileName));
  const allowedNames = entry ? [entry.company_name, ...(entry.aliases || [])].map(normalizeText) : [];
  const nameMatched = entry ? names.some(name => allowedNames.includes(normalizeText(name))) : false;
  const idMatched = !!entry && !!(detectedCompanyId || expectedCompanyId) && [detectedCompanyId, expectedCompanyId].some(id => normalizeText(id) === normalizeText(entry.company_id));
  const identityMatched = !!entry && (idMatched || nameMatched || pathAccepted);
  const allowedMachineIds = entry?.allowed_machine_ids || [];
  const machineAllowed = !allowedMachineIds.length
    || !detectedMachineId
    || allowedMachineIds.map(normalizeText).includes(normalizeText(detectedMachineId));
  const pathMatchRequired = entry?.path_match_required === true;
  const mismatchReason = identityMatched && machineAllowed
    ? null
    : identityMatched && !machineAllowed
      ? `Detected company is not assigned to machine ${detectedMachineId}`
    : detectedCompanyName || detectedCompanyFile
      ? 'Detected QB company is not in the approved production company registry'
      : 'No QB company identity metadata was detected';

  return {
    detected_machine_id: detectedMachineId,
    detected_company_name: detectedCompanyName,
    detected_company_file: detectedCompanyFile,
    detected_company_id: detectedCompanyId,
    expected_company_id: entry?.company_id || expectedCompanyId,
    expected_company_name: entry?.company_name || expectedCompanyName,
    identity_matched: identityMatched,
    machine_allowed: machineAllowed,
    allowed_machine_ids: allowedMachineIds,
    path_accepted: pathAccepted || (!pathMatchRequired && identityMatched),
    path_match_required: pathMatchRequired,
    approved_paths: approvedPaths,
    mismatch_reason: mismatchReason,
  };
}

function isPathOnlyGap(gap: string, identity: ReturnType<typeof resolveCompanyIdentity>): boolean {
  if (!identity.identity_matched || !identity.path_accepted) return false;
  return /configured qb file sync target is missing|config targets|detected active company/i.test(gap);
}

function collectEvidencePaths(agentDb: ReturnType<typeof readAgentDb>): string[] {
  const paths = new Set<string>();
  for (const row of agentDb.activity as any[]) {
    if (row.local_json_path) paths.add(String(row.local_json_path));
    if (row.local_markdown_path) paths.add(String(row.local_markdown_path));
  }
  for (const row of agentDb.errors as any[]) {
    const context = parseJson(row.context_json, {});
    for (const key of ['screenshot_path', 'screenshot', 'log_path', 'local_log_path', 'error_log_path']) {
      if (context?.[key]) paths.add(String(context[key]));
    }
  }
  return [...paths];
}

function requiredDev1Action(snapshot: Pick<QuickBooksRuntimeSnapshot, 'checksum' | 'company_detected' | 'quickbooks_desktop_open' | 'last_successful_sync' | 'gaps'>, evidence?: Dev1RuntimeEvidence | null): string {
  if (evidence?.required_dev1_action) return evidence.required_dev1_action;
  if (snapshot.checksum.mismatch) {
    return 'On Laptop1, open the correct QuickBooks Desktop company file, stop the QB connector, reset the checksum baseline to the current observed company-file hash, restart the connector, then run a force sync.';
  }
  if (!snapshot.quickbooks_desktop_open) {
    return 'On Laptop1, open QuickBooks Desktop and keep the company file open, then restart or force-sync the QB connector.';
  }
  if (!snapshot.company_detected) {
    return 'On Laptop1, select the expected QuickBooks company file and confirm the QB agent heartbeat reports qb_company.';
  }
  if (!snapshot.last_successful_sync) {
    return 'On Laptop1, trigger a full QB connector sync and send the resulting sync-result payload back to Mi-Core.';
  }
  return `On Laptop1, review QB connector runtime and clear these gaps: ${snapshot.gaps.join('; ')}`;
}

function failureType(snapshot: Pick<QuickBooksRuntimeSnapshot, 'checksum' | 'company_detected' | 'quickbooks_desktop_open' | 'last_successful_sync' | 'gaps' | 'duplicates'>, evidence?: Dev1RuntimeEvidence | null): string {
  if (evidence?.failure_type) return evidence.failure_type;
  if (snapshot.checksum.mismatch) return 'checksum_mismatch';
  if (!snapshot.quickbooks_desktop_open) return 'qb_not_open';
  if (!snapshot.company_detected) return 'company_not_detected';
  if (!snapshot.last_successful_sync) return 'no_successful_sync';
  if (hasRows(snapshot.duplicates.duplicate_bills)) return 'duplicate_bills_detected';
  if (hasRows(snapshot.duplicates.duplicate_payments)) return 'duplicate_payments_detected';
  return snapshot.gaps.length ? 'sync_gap' : 'unknown_runtime_failure';
}

function formatJsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildDailyRuntimeReport(snapshot: QuickBooksRuntimeSnapshot): string {
  const duplicateBills = snapshot.duplicates.duplicate_bills.length;
  const duplicatePayments = snapshot.duplicates.duplicate_payments.length;
  return [
    '# QB Daily Runtime Report',
    '',
    `Generated: ${snapshot.generated_at}`,
    `Status: ${snapshot.dashboard_status}`,
    `Certified: ${snapshot.certified ? 'yes' : 'no'}`,
    '',
    '## Runtime Signal',
    '',
    `- qb_open: ${snapshot.quickbooks_desktop_open}`,
    `- company_detected: ${snapshot.company_detected}`,
    `- last_successful_sync: ${snapshot.last_successful_sync || 'none'}`,
    `- transaction_count_today: ${snapshot.activity.today_transactions}`,
    `- checksum_expected: ${snapshot.checksum.expected || 'none'}`,
    `- checksum_actual: ${snapshot.checksum.got || 'none'}`,
    `- checksum_mismatch: ${snapshot.checksum.mismatch}`,
    `- detected_machine_id: ${snapshot.company_identity.detected_machine_id || 'none'}`,
    `- company_identity_matched: ${snapshot.company_identity.identity_matched}`,
    `- company_machine_allowed: ${snapshot.company_identity.machine_allowed}`,
    `- company_id: ${snapshot.company_identity.expected_company_id || snapshot.company_identity.detected_company_id || 'none'}`,
    `- company_name: ${snapshot.company_identity.expected_company_name || snapshot.company_identity.detected_company_name || 'none'}`,
    `- company_file: ${snapshot.company_identity.detected_company_file || 'none'}`,
    `- allowed_machine_ids: ${snapshot.company_identity.allowed_machine_ids.join(', ') || 'none'}`,
    `- company_path_accepted: ${snapshot.company_identity.path_accepted}`,
    `- path_match_required: ${snapshot.company_identity.path_match_required}`,
    '',
    '## Errors',
    '',
    snapshot.errors.length ? '```json\n' + formatJsonBlock(snapshot.errors.slice(0, 10)) + '\n```' : '- none',
    '',
    '## Duplicates',
    '',
    `- duplicate_bills: ${duplicateBills}`,
    `- duplicate_payments: ${duplicatePayments}`,
    '',
    '## Sync Gaps',
    '',
    snapshot.gaps.length ? snapshot.gaps.map(g => `- ${g}`).join('\n') : '- none',
    '',
    '## Dev1 Action',
    '',
    snapshot.action_required ? `Required: ${snapshot.required_dev1_action}` : 'Required: no',
    snapshot.handoff_package_path ? `Handoff package: ${snapshot.handoff_package_path}` : '',
    '',
    snapshot.dashboard_status === 'healthy'
      ? 'Verdict: QB_RUNTIME_HEALTHY'
      : 'Verdict: QB_RUNTIME_NEEDS_DEV1_ACTION',
    '',
  ].filter(line => line !== '').join('\n');
}

function writeDailyRuntimeReport(snapshot: QuickBooksRuntimeSnapshot): string {
  const reportPath = path.join(MI_ROOT, 'QB_DAILY_RUNTIME_REPORT.md');
  fs.writeFileSync(reportPath, buildDailyRuntimeReport(snapshot), 'utf-8');
  return reportPath;
}

function writeDev1HandoffPackage(snapshot: QuickBooksRuntimeSnapshot, evidencePaths: string[]): string {
  const evidence = readDev1RuntimeEvidence();
  const requiredAction = snapshot.required_dev1_action || requiredDev1Action(snapshot, evidence);
  const pkg: Dev1QuickBooksHandoffPackage = {
    generated_at: snapshot.generated_at,
    failure_type: failureType(snapshot, evidence),
    expected_checksum: evidence?.expected_checksum ?? snapshot.checksum.expected,
    actual_checksum: evidence?.actual_checksum ?? snapshot.checksum.got,
    last_successful_sync: evidence?.last_successful_sync ?? snapshot.last_successful_sync,
    company_detected: evidence?.company_detected ?? snapshot.company_detected,
    qb_open: evidence?.qb_open ?? snapshot.quickbooks_desktop_open,
    required_dev1_action: requiredAction,
    screenshots_or_log_paths: [...new Set([...(evidence?.evidence_files || []), ...evidencePaths])],
    dashboard_status: 'needs_dev1_action',
    gaps: snapshot.gaps,
    errors: snapshot.errors,
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const jsonPath = path.join(CACHE_DIR, 'dev1-handoff-package.json');
  fs.writeFileSync(jsonPath, JSON.stringify(pkg, null, 2), 'utf-8');
  fs.writeFileSync(path.join(CACHE_DIR, 'dev1-handoff-package.md'), [
    '# Dev1 QuickBooks Handoff Package',
    '',
    `Generated: ${pkg.generated_at}`,
    `Failure type: ${pkg.failure_type}`,
    `Expected checksum: ${pkg.expected_checksum || 'none'}`,
    `Actual checksum: ${pkg.actual_checksum || 'none'}`,
    `Last successful sync: ${pkg.last_successful_sync || 'none'}`,
    `Company detected: ${pkg.company_detected}`,
    `QB open: ${pkg.qb_open}`,
    '',
    '## Required Dev1 Action',
    '',
    pkg.required_dev1_action,
    '',
    '## Screenshots / Logs',
    '',
    pkg.screenshots_or_log_paths.length ? pkg.screenshots_or_log_paths.map(p => `- ${p}`).join('\n') : '- none available',
    '',
    '## Gaps',
    '',
    pkg.gaps.length ? pkg.gaps.map(g => `- ${g}`).join('\n') : '- none',
    '',
  ].join('\n'), 'utf-8');
  return jsonPath;
}

export function getQuickBooksRuntimeSnapshot(): QuickBooksRuntimeSnapshot {
  const checksumDb = readChecksumDb();
  const agentDb = readAgentDb();
  const state: any = checksumDb.state || {};
  const latestHeartbeat: any = selectQbRuntimeHeartbeat(agentDb.heartbeats as any[]);
  const checksum = parseChecksum(state.last_error);
  const successfulSync = recentSuccessfulSync(checksumDb.syncs as any[], agentDb.syncResults as any[]);
  const latestSyncResult: any = (agentDb.syncResults as any[])[0] || {};
  const activity = computeTodayActivity(agentDb.activity as any[]);
  const duplicates = findDuplicates(agentDb.activity as any[]);
  const dev1Evidence = readDev1RuntimeEvidence();
  const companyIdentity = resolveCompanyIdentity(dev1Evidence, latestHeartbeat, agentDb.qbFiles as any[]);
  const companyDetected = companyIdentity.identity_matched || Boolean(latestHeartbeat.qb_company || (agentDb.qbFiles as any[]).some(f => f.company_file_path || f.expected_company_name));
  const evidenceStale = isEvidenceStale(dev1Evidence, latestHeartbeat);
  const effectiveDev1Evidence = evidenceStale ? null : dev1Evidence;
  const qbOpen = Boolean(Number(latestHeartbeat.qb_open || 0)) || effectiveDev1Evidence?.qb_open === true;
  const heartbeatAge = ageMinutes(latestHeartbeat.received_at || null);
  const syncAge = ageMinutes(successfulSync);
  const gaps: string[] = [];

  if (checksum.mismatch) gaps.push('Checksum mismatch still present in package sync state');
  if (!companyDetected) gaps.push('QB company file is not detected by latest agent heartbeat');
  if (!qbOpen) gaps.push('QuickBooks Desktop is not reported open by latest heartbeat');
  if (!successfulSync) gaps.push('No successful QB sync result found');
  if (heartbeatAge === null) gaps.push('No QB heartbeat has been received');
  else if (heartbeatAge > 15) gaps.push(`Latest QB heartbeat is stale (${heartbeatAge} minutes old)`);
  if (syncAge !== null && syncAge > 1440) gaps.push(`Last successful QB sync is stale (${syncAge} minutes old)`);
  if (!activity.latest_activity_at) gaps.push('No real QB activity log rows found');
  if (hasRows(duplicates.duplicate_bills)) gaps.push(`${duplicates.duplicate_bills.length} duplicate bill groups detected`);
  if (hasRows(duplicates.duplicate_payments)) gaps.push(`${duplicates.duplicate_payments.length} duplicate payment groups detected`);
  if (effectiveDev1Evidence?.result && effectiveDev1Evidence.result !== 'STABLE') {
    gaps.push(`Dev1 Laptop1 runtime result is ${effectiveDev1Evidence.result}`);
  }
  for (const gap of effectiveDev1Evidence?.gaps || []) {
    if (isPathOnlyGap(gap, companyIdentity)) continue;
    if (!gaps.includes(gap)) gaps.push(gap);
  }
  if (!companyIdentity.identity_matched) gaps.push(companyIdentity.mismatch_reason || 'QB company identity is not certified');
  if (companyIdentity.identity_matched && !companyIdentity.machine_allowed) gaps.push(companyIdentity.mismatch_reason || 'QB company is not assigned to this machine');
  if (companyIdentity.path_match_required && !companyIdentity.path_accepted) gaps.push('QB company path is not in the approved production path registry');

  const evidenceBlocksCertification = !!effectiveDev1Evidence?.result && effectiveDev1Evidence.result !== 'STABLE'
    && gaps.some(g => !isPathOnlyGap(g, companyIdentity));
  const healthy = !evidenceBlocksCertification && !checksum.mismatch && companyDetected && companyIdentity.identity_matched && companyIdentity.machine_allowed && companyIdentity.path_accepted && qbOpen && !!successfulSync && gaps.length === 0;
  const currentErrors = [
    ...(effectiveDev1Evidence?.errors || []),
    ...(agentDb.errors as any[]).filter(e => isRecentRecord(e, 1440)),
    ...(checksumDb.syncs as any[]).filter(s => String(s.event_type) === 'SYNC_FAILED' && isRecentRecord(s, 1440)).slice(0, 5),
  ];
  const hasAgentData = (agentDb.machines as unknown[]).length > 0 || (agentDb.heartbeats as unknown[]).length > 0 || (agentDb.syncResults as unknown[]).length > 0;
  const actionRequired = !healthy;
  const status: QuickBooksRuntimeSnapshot['status'] = healthy
    ? 'healthy'
    : evidenceBlocksCertification || checksum.mismatch || !qbOpen || !companyDetected || !successfulSync || currentErrors.length > 0
      ? 'needs_dev1_action'
      : hasAgentData
        ? 'degraded'
        : 'not_configured';
  const dashboardStatus: QuickBooksRuntimeSnapshot['dashboard_status'] =
    status === 'healthy' ? 'healthy' : status === 'degraded' ? 'degraded' : status === 'not_configured' ? 'failed' : 'needs_dev1_action';

  const snapshot: QuickBooksRuntimeSnapshot = {
    generated_at: new Date().toISOString(),
    status,
    dashboard_status: dashboardStatus,
    certified: healthy,
    db_paths: { checksum_db: DD_DB_PATH, agent_db: AGENT_DB_PATH },
    company_detected: companyDetected,
    quickbooks_desktop_open: qbOpen,
    last_successful_sync: successfulSync,
    last_sync_timestamp: state.last_sync_at || latestSyncResult.received_at || null,
    last_sync_status: state.last_sync_status || latestSyncResult.status || null,
    checksum,
    company_identity: companyIdentity,
    activity,
    duplicates,
    machines: agentDb.machines,
    errors: healthy ? [] : currentErrors,
    gaps,
    action_required: actionRequired,
    required_dev1_action: actionRequired ? requiredDev1Action({ checksum, company_detected: companyDetected, quickbooks_desktop_open: qbOpen, last_successful_sync: successfulSync, gaps }, effectiveDev1Evidence) : null,
    handoff_package_path: null,
    daily_report_path: path.join(MI_ROOT, 'QB_DAILY_RUNTIME_REPORT.md'),
  };
  const evidencePaths = collectEvidencePaths(agentDb);
  if (actionRequired) snapshot.handoff_package_path = writeDev1HandoffPackage(snapshot, evidencePaths);
  snapshot.daily_report_path = writeDailyRuntimeReport(snapshot);
  return snapshot;
}

export function recoverQuickBooksChecksumBaseline(): { ok: boolean; backup_path?: string; before?: unknown; after?: unknown; command_id?: string; snapshot: QuickBooksRuntimeSnapshot; note: string } {
  if (!fs.existsSync(DD_DB_PATH)) {
    return { ok: false, snapshot: getQuickBooksRuntimeSnapshot(), note: `QB checksum DB missing: ${DD_DB_PATH}` };
  }
  fs.mkdirSync(path.dirname(DD_DB_PATH), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${DD_DB_PATH}.backup-before-qb-recovery-${stamp}`;
  fs.copyFileSync(DD_DB_PATH, backup);

  const db = new Database(DD_DB_PATH);
  const before: any = safeGet(db, 'SELECT * FROM dd_machine_state ORDER BY updated_at DESC LIMIT 1');
  const checksum = parseChecksum(before?.last_error);
  if (!before || !checksum.mismatch || !checksum.got) {
    db.close();
    return { ok: false, backup_path: backup, before, snapshot: getQuickBooksRuntimeSnapshot(), note: 'No checksum mismatch baseline to reset' };
  }

  db.prepare(`
    UPDATE dd_machine_state
    SET current_version = ?,
        last_sync_status = 'pending',
        last_error = '',
        last_sync_at = '',
        updated_at = datetime('now')
    WHERE machine_id = ?
  `).run(checksum.got, before.machine_id);
  const after = safeGet(db, 'SELECT * FROM dd_machine_state ORDER BY updated_at DESC LIMIT 1');
  db.close();

  const commandId = enqueueForceSyncCommand();
  const snapshot = getQuickBooksRuntimeSnapshot();
  writeQuickBooksCache(snapshot);
  return {
    ok: true,
    backup_path: backup,
    before,
    after,
    command_id: commandId,
    snapshot,
    note: 'Checksum baseline reset to current observed hash. QuickBooks Desktop/company file still must be open and the QB agent must complete a real sync before certification.',
  };
}

function enqueueForceSyncCommand(): string | undefined {
  if (!fs.existsSync(AGENT_DB_PATH)) return undefined;
  const agent = readAgentDb();
  const machine = (agent.machines as any[])[0];
  if (!machine?.machine_id) return undefined;
  const db = new Database(AGENT_DB_PATH);
  if (!tableExists(db, 'commands')) {
    db.close();
    return undefined;
  }
  const commandId = crypto.randomUUID();
  db.prepare(`INSERT INTO commands (command_id, machine_id, command_type, payload_json, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)`)
    .run(commandId, machine.machine_id, 'force_sync', JSON.stringify({ reason: 'QB checksum recovery', requested_by: 'Dev2' }), new Date().toISOString());
  db.close();
  return commandId;
}

export function writeQuickBooksCache(snapshot = getQuickBooksRuntimeSnapshot()) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
    dashboard_status: snapshot.dashboard_status,
    status: snapshot.status,
    certified: snapshot.certified,
    qb_open: snapshot.quickbooks_desktop_open,
    company_detected: snapshot.company_detected,
    last_successful_sync: snapshot.last_successful_sync,
    transaction_count_today: snapshot.activity.today_transactions,
    checksum_mismatch: snapshot.checksum.mismatch,
    company_identity: snapshot.company_identity,
    duplicate_bills: snapshot.duplicates.duplicate_bills.length,
    duplicate_payments: snapshot.duplicates.duplicate_payments.length,
    action_required: snapshot.action_required,
  }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify(snapshot.certified ? [] : snapshot.gaps.map(gap => ({
    connector_id: 'quickbooks-runtime',
    status: snapshot.dashboard_status,
    gap,
    generated_at: snapshot.generated_at,
    handoff_package_path: snapshot.handoff_package_path,
  })), null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({
    synced_at: snapshot.generated_at,
    status: snapshot.status,
    dashboard_status: snapshot.dashboard_status,
  }, null, 2));
  return snapshot;
}

export function answerQuickBooksQuestion(question: string) {
  const snapshot = writeQuickBooksCache();
  const q = question.toLowerCase();
  const insufficient = 'Em chưa có đủ dữ liệu thật để kết luận.';
  let answer = '';

  if (/hoạt động|hoat dong|runtime|sync|đồng bộ|dong bo|lỗi|loi/.test(q)) {
    answer = snapshot.certified
      ? `QB đang hoạt động. Last successful sync: ${snapshot.last_successful_sync}.`
      : `${insufficient} QB chưa healthy: ${snapshot.status}. ${snapshot.gaps.join(' | ') || 'Cần chờ sync thật từ QB agent.'}`;
  } else if (/hôm nay|hom nay|giao dịch|giao dich|transaction/.test(q)) {
    answer = snapshot.activity.today_transactions > 0
      ? `Hôm nay có ${snapshot.activity.today_transactions} giao dịch QB, tổng ${snapshot.activity.today_amount}.`
      : `${insufficient} Chưa có giao dịch QB thật cho hôm nay trong cache. Latest activity: ${snapshot.activity.latest_business_date || 'none'} at ${snapshot.activity.latest_activity_at || 'none'}.`;
  } else if (/trùng|trung|duplicate|bill|payment|thanh toán|thanh toan/.test(q)) {
    const freshness = snapshot.certified
      ? 'dữ liệu QB runtime đã certified'
      : 'dữ liệu hiện tại chưa certified vì QB company/runtime chưa healthy';
    answer = `Duplicate check từ QB activity hiện có: ${snapshot.duplicates.duplicate_bills.length} bill trùng, ${snapshot.duplicates.duplicate_payments.length} payment trùng; ${freshness}.`;
  } else {
    answer = snapshot.certified
      ? 'QB runtime healthy, no active sync error.'
      : `${insufficient} Có lỗi đồng bộ hoặc thiếu điều kiện sync: ${snapshot.gaps.join(' | ')}`;
  }

  return {
    question,
    answer,
    status: snapshot.certified ? 'QB_RUNTIME_HEALTHY' : 'QB_RUNTIME_NOT_CERTIFIED',
    pass: snapshot.certified,
    source_layers: ['QuickBooks Runtime', 'QB Agent SQLite', 'Enterprise Brain'],
    evidence: [snapshot],
    gaps: snapshot.gaps,
    no_mock_data: true,
  };
}
