/**
 * False Action Telemetry — Runtime Wiring
 * 
 * Wire false_action, false_approval, false_finance, context_failure, image_failure
 * into the execution ledger.
 * 
 * This is the foundation for TRACK 2: False Action Runtime Report.
 */

import fs from 'fs';
import path from 'path';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const LEDGER_FILE = path.join(MI_CORE_ROOT, '.local-agent-global', 'execution-ledger', 'ledger.jsonl');
const TELEMETRY_FILE = path.join(MI_CORE_ROOT, '.local-agent-global', 'execution-ledger', 'telemetry.jsonl');

// ── Types ──────────────────────────────────────────────────────────────────

export type FalseActionType =
  | 'FA-001' // Statement → Workflow
  | 'FA-002' // Test → Production WO
  | 'FA-003' // Dangerous action reached pipeline
  | 'FA-004' // Duplicate WOs (no idempotency)
  | 'FA-005' // Approval count mismatch
  | 'FA-006' // QB dual connector
  | 'FA-007' // Hardcoded secrets / finance fabrication
  | 'FA-008' // Approval gate post-LLM
  | 'FA-009' // Image failure (screenshot/render)
  | 'FA-010'; // Context loss / conversation reset

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TelemetryEntry {
  entry_id: string;
  timestamp: string;
  work_order_id: string;
  
  // False action telemetry
  false_action: boolean;
  false_action_type: FalseActionType | null;
  false_action_severity: Severity | null;
  false_action_evidence: string | null;
  
  // False approval
  false_approval: boolean;
  
  // False finance
  false_finance: boolean;
  
  // Context failure
  context_failure: boolean;
  
  // Image failure
  image_failure: boolean;
  
  // Metadata
  agent_role: string;
  action_type: string;
  target: string;
  verdict: string;
}

export interface TelemetryMetrics {
  total_entries: number;
  false_action_count: number;
  false_action_rate: number;
  false_approval_count: number;
  false_approval_rate: number;
  false_finance_count: number;
  false_finance_rate: number;
  context_failure_count: number;
  context_failure_rate: number;
  image_failure_count: number;
  image_failure_rate: number;
  by_type: Record<string, number>;
  by_severity: Record<Severity, number>;
}

// ── Storage ────────────────────────────────────────────────────────────────

function ensureDir() {
  const dir = path.dirname(TELEMETRY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Classification Rules ──────────────────────────────────────────────────

/**
 * Determine if a ledger entry is a false action based on its content.
 */
function classifyFalseAction(entry: any): {
  false_action: boolean;
  false_action_type: FalseActionType | null;
  false_action_severity: Severity | null;
  false_action_evidence: string | null;
} {
  const evidence = entry.evidence || '';
  const detail = entry.detail || '';
  const target = entry.target || '';
  const woId = entry.work_order_id || '';
  
  // FA-004: Duplicate WOs — same message creating multiple WOs
  if (woId) {
    // Check if same day has sequential WOs with identical target
    const woMatch = woId.match(/WO-(\d{8})-(\d+)/);
    if (woMatch) {
      const seq = parseInt(woMatch[2]);
      if (seq > 10) {
        // High sequence number suggests duplicates
        // Only flag if evidence is identical to first WO
        return {
          false_action: false, // needs cross-reference
          false_action_type: null,
          false_action_severity: null,
          false_action_evidence: null,
        };
      }
    }
  }

  // FA-002: Test sender → production WO
  if (woId.includes('TEST') || woId.includes('test')) {
    return {
      false_action: true,
      false_action_type: 'FA-002',
      false_action_severity: 'HIGH',
      false_action_evidence: `Test WO ${woId} reached production ledger`,
    };
  }

  // FA-003: Dangerous action reached pipeline
  if (entry.agent_role === 'ceo_interpreter' && evidence.includes('deploy') && evidence.includes('production')) {
    // Check if it was properly blocked
    const relatedEntries = getEntriesForWO(woId);
    const hasApproval = relatedEntries.some(e => e.agent_role === 'system' && e.evidence?.includes('APPROVAL_REQUIRED'));
    if (!hasApproval) {
      return {
        false_action: true,
        false_action_type: 'FA-003',
        false_action_severity: 'CRITICAL',
        false_action_evidence: `Dangerous action "${evidence.substring(0, 80)}" reached pipeline without approval gate`,
      };
    }
  }

  // FA-001: Statement treated as workflow
  if (entry.agent_role === 'ceo_interpreter' && evidence.startsWith('Mi chưa hiểu rõ yêu cầu')) {
    // Unclear request still created a WO
    return {
      false_action: true,
      false_action_type: 'FA-001',
      false_action_severity: 'MEDIUM',
      false_action_evidence: `Unclear request created WO: "${evidence.substring(0, 80)}"`,
    };
  }

  return {
    false_action: false,
    false_action_type: null,
    false_action_severity: null,
    false_action_evidence: null,
  };
}

/**
 * Determine if a false approval was triggered.
 */
function classifyFalseApproval(entry: any, falseAction: boolean): boolean {
  // An approval is false if it was triggered on a non-actionable message
  if (entry.verdict === 'APPROVAL_REQUIRED' && falseAction) return true;
  return false;
}

/**
 * Determine if false finance data was involved.
 */
function classifyFalseFinance(entry: any): boolean {
  const evidence = (entry.evidence || '').toLowerCase();
  const target = (entry.target || '').toLowerCase();
  
  // Finance-related but targeting wrong domain
  if ((evidence.includes('doanh thu') || evidence.includes('revenue') || evidence.includes('expense') || evidence.includes('chi phí')) 
      && target !== 'finance_qb' && target !== 'qb') {
    return true;
  }
  return false;
}

/**
 * Determine if context resolution failed.
 */
function classifyContextFailure(entry: any): boolean {
  const evidence = entry.evidence || '';
  
  // Clarification requests indicate context failure
  if (evidence.startsWith('Mi chưa hiểu rõ yêu cầu')) return true;
  
  // Agent couldn't resolve intent
  if (entry.agent_role === 'ceo_interpreter' && entry.verdict === 'FAIL') return true;
  
  return false;
}

/**
 * Determine if image rendering/processing failed.
 */
function classifyImageFailure(entry: any): boolean {
  const evidence = (entry.evidence || '').toLowerCase();
  return evidence.includes('image') && evidence.includes('fail') ||
         evidence.includes('screenshot') && evidence.includes('fail') ||
         evidence.includes('render') && evidence.includes('fail');
}

// ── Helper ─────────────────────────────────────────────────────────────────

function getEntriesForWO(workOrderId: string): any[] {
  try {
    const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
    return lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .filter((e: any) => e.work_order_id === workOrderId);
  } catch {
    return [];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Classify all ledger entries and produce telemetry.
 */
export function classifyAllEntries(): TelemetryEntry[] {
  ensureDir();
  try {
    const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    
    const telemetry: TelemetryEntry[] = entries.map((entry: any) => {
      const fa = classifyFalseAction(entry);
      return {
        entry_id: entry.entry_id,
        timestamp: entry.ts,
        work_order_id: entry.work_order_id || '',
        false_action: fa.false_action,
        false_action_type: fa.false_action_type,
        false_action_severity: fa.false_action_severity,
        false_action_evidence: fa.false_action_evidence,
        false_approval: classifyFalseApproval(entry, fa.false_action),
        false_finance: classifyFalseFinance(entry),
        context_failure: classifyContextFailure(entry),
        image_failure: classifyImageFailure(entry),
        agent_role: entry.agent_role || '',
        action_type: entry.action_type || '',
        target: entry.target || '',
        verdict: entry.verdict || '',
      };
    });

    // Write telemetry file
    fs.writeFileSync(TELEMETRY_FILE, telemetry.map(t => JSON.stringify(t)).join('\n'));
    
    return telemetry;
  } catch {
    return [];
  }
}

/**
 * Compute telemetry metrics from classified entries.
 */
export function computeMetrics(telemetry?: TelemetryEntry[]): TelemetryMetrics {
  if (!telemetry) telemetry = classifyAllEntries();
  
  const total = telemetry.length;
  const falseAction = telemetry.filter(t => t.false_action);
  const falseApproval = telemetry.filter(t => t.false_approval);
  const falseFinance = telemetry.filter(t => t.false_finance);
  const contextFailure = telemetry.filter(t => t.context_failure);
  const imageFailure = telemetry.filter(t => t.image_failure);

  const byType: Record<string, number> = {};
  const bySeverity: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const t of falseAction) {
    if (t.false_action_type) byType[t.false_action_type] = (byType[t.false_action_type] || 0) + 1;
    if (t.false_action_severity) bySeverity[t.false_action_severity]++;
  }

  return {
    total_entries: total,
    false_action_count: falseAction.length,
    false_action_rate: total > 0 ? falseAction.length / total : 0,
    false_approval_count: falseApproval.length,
    false_approval_rate: total > 0 ? falseApproval.length / total : 0,
    false_finance_count: falseFinance.length,
    false_finance_rate: total > 0 ? falseFinance.length / total : 0,
    context_failure_count: contextFailure.length,
    context_failure_rate: total > 0 ? contextFailure.length / total : 0,
    image_failure_count: imageFailure.length,
    image_failure_rate: total > 0 ? imageFailure.length / total : 0,
    by_type: byType,
    by_severity: bySeverity,
  };
}

/**
 * Get per-WO false action breakdown.
 */
export function getPerWOFalseActions(): Record<string, { 
  false_action: number; false_approval: number; false_finance: number; 
  context_failure: number; image_failure: number 
}> {
  const telemetry = classifyAllEntries();
  const byWO: Record<string, any> = {};
  
  for (const t of telemetry) {
    if (!t.work_order_id) continue;
    if (!byWO[t.work_order_id]) {
      byWO[t.work_order_id] = { false_action: 0, false_approval: 0, false_finance: 0, context_failure: 0, image_failure: 0 };
    }
    if (t.false_action) byWO[t.work_order_id].false_action++;
    if (t.false_approval) byWO[t.work_order_id].false_approval++;
    if (t.false_finance) byWO[t.work_order_id].false_finance++;
    if (t.context_failure) byWO[t.work_order_id].context_failure++;
    if (t.image_failure) byWO[t.work_order_id].image_failure++;
  }
  
  return byWO;
}
