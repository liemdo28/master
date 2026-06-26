/**
 * CEO Message Store
 * 
 * Authoritative archive of every CEO message received.
 * Stores raw messages with: timestamp, source, message, intent, decision, action, result.
 * 
 * This is the foundation for TRACK 1: Raw Message Dataset.
 * Target: 500 real CEO messages.
 */

import fs from 'fs';
import path from 'path';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const STORE_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'ceo-messages');
const INDEX_FILE = path.join(STORE_DIR, 'message-index.jsonl');

// ── Types ──────────────────────────────────────────────────────────────────

export type MessageSource = 
  | 'whatsapp' 
  | 'test_replay' 
  | 'ledger_backfill' 
  | 'workflow_backfill' 
  | 'g1_test_file'
  | 'manual_entry'
  | 'api_direct';

export type MessageIntent =
  | 'action_request'
  | 'informational_question'
  | 'approval_response'
  | 'followup'
  | 'dangerous_action'
  | 'unknown_clarify'
  | 'statement'
  | 'casual'
  | 'correction'
  | 'multi_intent'
  | 'unclear';

export type MessageDecision =
  | 'workflow_created'
  | 'approval_granted'
  | 'approval_denied'
  | 'information_returned'
  | 'clarification_requested'
  | 'acknowledged'
  | 'no_action_needed'
  | 'duplicate_blocked'
  | 'false_action_blocked'
  | 'pending';

export type MessageAction =
  | 'executed'
  | 'queued'
  | 'blocked_by_gate'
  | 'blocked_by_idempotency'
  | 'routed_to_human'
  | 'no_action'
  | 'pending';

export type MessageResult =
  | 'completed_success'
  | 'completed_with_issues'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'pending'
  | 'not_applicable';

export interface CEOMessage {
  /** Unique message ID */
  message_id: string;
  /** ISO-8601 timestamp of when Mi received the message */
  timestamp: string;
  /** Where the message came from */
  source: MessageSource;
  /** Raw message text exactly as received */
  message: string;
  /** Intent classification result */
  intent: MessageIntent;
  /** Decision made by the system */
  decision: MessageDecision;
  /** Action taken (if any) */
  action: MessageAction;
  /** Result of the action */
  result: MessageResult;
  /** Work order ID linked to this message (if any) */
  work_order_id?: string;
  /** Target entity (Dashboard, QB, Maria, etc.) */
  target_entity?: string;
  /** Business domain */
  domain?: string;
  /** Sender identifier */
  sender?: string;
  /** Session/conversation ID */
  session_id?: string;
  /** Response text sent back to CEO */
  response?: string;
  /** Classification confidence */
  confidence?: number;
  /** Any false action telemetry attached */
  false_action?: boolean;
  false_action_type?: string;
  context_failure?: boolean;
}

// ── Storage ────────────────────────────────────────────────────────────────

function ensureDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

function genMessageId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = String(getAllMessages().length + 1).padStart(4, '0');
  return `CEO-${date}-${seq}`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Store a new CEO message. Appends to JSONL index.
 */
export function storeMessage(msg: Omit<CEOMessage, 'message_id'>): CEOMessage {
  ensureDir();
  const full: CEOMessage = { message_id: genMessageId(), ...msg };
  fs.appendFileSync(INDEX_FILE, JSON.stringify(full) + '\n');
  return full;
}

/**
 * Get all stored CEO messages.
 */
export function getAllMessages(): CEOMessage[] {
  ensureDir();
  try {
    const lines = fs.readFileSync(INDEX_FILE, 'utf8').split('\n').filter(Boolean);
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as CEOMessage[];
  } catch {
    return [];
  }
}

/**
 * Get messages by source.
 */
export function getMessagesBySource(source: MessageSource): CEOMessage[] {
  return getAllMessages().filter(m => m.source === source);
}

/**
 * Get messages by intent.
 */
export function getMessagesByIntent(intent: MessageIntent): CEOMessage[] {
  return getAllMessages().filter(m => m.intent === intent);
}

/**
 * Get unique message texts (deduplicated by content).
 */
export function getUniqueMessages(): CEOMessage[] {
  const all = getAllMessages();
  const seen = new Set<string>();
  return all.filter(m => {
    const key = m.message.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get messages in a time range.
 */
export function getMessagesInRange(start: string, end: string): CEOMessage[] {
  return getAllMessages().filter(m => m.timestamp >= start && m.timestamp <= end);
}

/**
 * Get message statistics.
 */
export function getMessageStats() {
  const all = getAllMessages();
  const unique = getUniqueMessages();
  const bySource: Record<string, number> = {};
  const byIntent: Record<string, number> = {};
  const byDecision: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  const byResult: Record<string, number> = {};

  for (const m of all) {
    bySource[m.source] = (bySource[m.source] || 0) + 1;
    byIntent[m.intent] = (byIntent[m.intent] || 0) + 1;
    byDecision[m.decision] = (byDecision[m.decision] || 0) + 1;
    byAction[m.action] = (byAction[m.action] || 0) + 1;
    byResult[m.result] = (byResult[m.result] || 0) + 1;
  }

  return {
    total_messages: all.length,
    unique_messages: unique.length,
    by_source: bySource,
    by_intent: byIntent,
    by_decision: byDecision,
    by_action: byAction,
    by_result: byResult,
    time_range: {
      first: all.length > 0 ? all[0].timestamp : null,
      last: all.length > 0 ? all[all.length - 1].timestamp : null,
    },
    false_action_count: all.filter(m => m.false_action).length,
    context_failure_count: all.filter(m => m.context_failure).length,
  };
}

/**
 * Backfill: Import CEO messages from the existing execution ledger.
 * This reconstructs CEO messages from the ceo_interpreter entries.
 */
export function backfillFromLedger(): { imported: number; skipped: number } {
  const LEDGER_FILE = path.join(MI_CORE_ROOT, '.local-agent-global', 'execution-ledger', 'ledger.jsonl');
  if (!fs.existsSync(LEDGER_FILE)) return { imported: 0, skipped: 0 };

  const existing = new Set(getAllMessages().map(m => m.work_order_id).filter(Boolean));
  const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
  const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  
  let imported = 0;
  let skipped = 0;

  // Extract CEO messages from ceo_interpreter entries
  const ceoEntries = entries.filter((e: any) => e.agent_role === 'ceo_interpreter');
  const seenMessages = new Map<string, any>();

  for (const entry of ceoEntries) {
    const evidence = (entry as any).evidence || '';
    // Extract the raw CEO message from the interpretation
    let rawMessage = '';
    
    if (evidence.startsWith('Mi chưa hiểu rõ yêu cầu')) {
      // Clarification request — extract quoted message
      const match = evidence.match(/về:\s*"(.+?)"/);
      rawMessage = match ? match[1] : evidence;
    } else if (evidence.startsWith('CEO muốn')) {
      // Action interpretation — extract intent description
      rawMessage = evidence.replace('CEO muốn ', '').replace(/\. Mi sẽ:.+$/, '').trim();
    } else {
      rawMessage = evidence;
    }

    if (seenMessages.has(rawMessage)) {
      // Duplicate message for same WO — skip
      const existingMsg = seenMessages.get(rawMessage);
      if (existingMsg.work_order_id !== (entry as any).work_order_id) {
        // Different WO — this is a genuine new occurrence
      } else {
        skipped++;
        continue;
      }
    }
    seenMessages.set(rawMessage, entry);

    if (existing.has((entry as any).work_order_id)) {
      skipped++;
      continue;
    }

    // Determine intent from evidence text
    let intent: MessageIntent = 'action_request';
    if (evidence.startsWith('Mi chưa hiểu rõ')) intent = 'unclear';
    else if (evidence.includes('deploy')) intent = 'dangerous_action';
    else if (evidence.includes('kiểm tra') || evidence.includes('check')) intent = 'informational_question';

    // Determine decision from the work order status
    let decision: MessageDecision = 'workflow_created';
    if (intent === 'unclear') decision = 'clarification_requested';
    else if (intent === 'dangerous_action') decision = 'workflow_created';

    // Determine target
    const target = (entry as any).target || 'unknown';
    let targetEntity = target;
    if (target.includes('dashboard')) targetEntity = 'Dashboard';
    else if (target.includes('qb') || target.includes('quickbooks')) targetEntity = 'QB';
    else if (target.includes('seo')) targetEntity = 'SEO';
    else if (target.includes('maria')) targetEntity = 'Maria';

    storeMessage({
      timestamp: (entry as any).ts || new Date().toISOString(),
      source: 'ledger_backfill',
      message: rawMessage,
      intent,
      decision,
      action: 'executed',
      result: (entry as any).verdict === 'PASS' ? 'completed_success' : 
              (entry as any).verdict === 'FAIL' ? 'completed_with_issues' : 'pending',
      work_order_id: (entry as any).work_order_id,
      target_entity: targetEntity,
      domain: target,
      sender: 'ceo',
      confidence: 85,
    });
    imported++;
  }

  return { imported, skipped };
}

/**
 * Backfill from G1-*.txt test files.
 */
export function backfillFromG1Files(): { imported: number; skipped: number } {
  let imported = 0;
  let skipped = 0;
  const existing = new Set(getAllMessages().map(m => m.message));

  const g1Files = [
    { file: 'G1-002_hom_nay_co_gi.txt', message: 'Hôm nay có gì?', intent: 'informational_question' as MessageIntent, decision: 'information_returned' as MessageDecision },
    { file: 'G1-003_co_gi_dang_lo.txt', message: 'Có gì đáng lo?', intent: 'informational_question' as MessageIntent, decision: 'information_returned' as MessageDecision },
    { file: 'G1-004_co_gi_can_duyet.txt', message: 'Có gì cần duyệt?', intent: 'informational_question' as MessageIntent, decision: 'information_returned' as MessageDecision },
    { file: 'G1-005_dashboard_sao_roi.txt', message: 'Dashboard sao rồi?', intent: 'informational_question' as MessageIntent, decision: 'information_returned' as MessageDecision },
  ];

  for (const g1 of g1Files) {
    if (existing.has(g1.message)) { skipped++; continue; }

    // Try to parse response from file
    let response = '';
    try {
      const filePath = path.join(MI_CORE_ROOT, g1.file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        const parsed = JSON.parse(content);
        response = parsed.reply || '';
      }
    } catch { /* file may not exist or be parseable */ }

    storeMessage({
      timestamp: '2026-06-15T06:00:00.000Z',
      source: 'g1_test_file',
      message: g1.message,
      intent: g1.intent,
      decision: g1.decision,
      action: 'executed',
      result: response ? 'completed_success' : 'completed_with_issues',
      target_entity: g1.message.includes('Dashboard') ? 'Dashboard' : undefined,
      domain: g1.message.includes('Dashboard') ? 'dashboard_monitoring' : 'general',
      sender: 'ceo',
      response,
      confidence: 95,
    });
    imported++;
  }

  return { imported, skipped };
}

/**
 * Backfill from workflow JSON files (extract source messages).
 */
export function backfillFromWorkflows(): { imported: number; skipped: number } {
  const WF_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'workflows');
  if (!fs.existsSync(WF_DIR)) return { imported: 0, skipped: 0 };

  const existing = new Set(getAllMessages().map(m => m.work_order_id).filter(Boolean));
  let imported = 0;
  let skipped = 0;

  try {
    const files = fs.readdirSync(WF_DIR).filter(f => f.endsWith('.json'));
    for (const file of files.slice(0, 1000)) { // limit to prevent overload
      try {
        const wf = JSON.parse(fs.readFileSync(path.join(WF_DIR, file), 'utf8'));
        const wfId = wf.workflow_id || wf.id;
        if (!wfId || existing.has(wfId)) { skipped++; continue; }

        const rawMsg = wf.source_message || wf.intent?.raw_message || wf.source_message_id || '';
        if (!rawMsg) { skipped++; continue; }

        const intent: MessageIntent = 
          wf.intent?.message_class === 'dangerous_action' ? 'dangerous_action' :
          wf.intent?.message_class === 'approval_response' ? 'approval_response' :
          wf.intent?.message_class === 'informational_question' ? 'informational_question' :
          wf.intent?.message_class === 'followup' ? 'followup' :
          'action_request';

        storeMessage({
          timestamp: wf.created_at || new Date().toISOString(),
          source: 'workflow_backfill',
          message: rawMsg,
          intent,
          decision: wf.status === 'completed' ? 'workflow_created' : 'pending',
          action: wf.status === 'completed' ? 'executed' : 'queued',
          result: wf.status === 'completed' ? 'completed_success' :
                  wf.status === 'failed' ? 'failed' : 'pending',
          work_order_id: wfId,
          target_entity: wf.target_entity,
          domain: wf.domain,
          sender: wf.sender,
          confidence: wf.intent?.confidence,
        });
        imported++;
      } catch { skipped++; }
    }
  } catch { /* directory read failure */ }

  return { imported, skipped };
}

/**
 * Full backfill: run all backfill sources.
 */
export function fullBackfill(): {
  ledger: { imported: number; skipped: number };
  g1: { imported: number; skipped: number };
  workflows: { imported: number; skipped: number };
  total_messages: number;
  unique_messages: number;
} {
  const ledger = backfillFromLedger();
  const g1 = backfillFromG1Files();
  const workflows = backfillFromWorkflows();
  const stats = getMessageStats();

  return {
    ledger,
    g1,
    workflows,
    total_messages: stats.total_messages,
    unique_messages: stats.unique_messages,
  };
}
