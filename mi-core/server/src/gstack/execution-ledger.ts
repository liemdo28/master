/**
 * GStack Execution Ledger
 * Immutable append-only log of every action taken by any agent.
 * Source of truth for auditing and certification.
 */

import fs from 'fs';
import path from 'path';



const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const LEDGER_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/execution-ledger');
const LEDGER_FILE = path.join(LEDGER_DIR, 'ledger.jsonl');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB rotate

export interface LedgerEntry {
  entry_id: string;
  ts: string;
  work_order_id?: string;
  requested_by: string;
  agent_role: string;
  action_type: string;
  target: string;
  command_run?: string;
  files_changed?: string[];
  test_result?: string;
  evidence?: string;
  verdict: 'PASS' | 'FAIL' | 'SKIP' | 'PENDING' | 'APPROVAL_REQUIRED';
  detail?: string;
}

let _counter = 0;
function entryId(): string {
  return `LE-${Date.now()}-${String(++_counter).padStart(4, '0')}`;
}

function ensureDir() {
  fs.mkdirSync(LEDGER_DIR, { recursive: true });
}

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(LEDGER_FILE);
    if (stat.size > MAX_SIZE) {
      fs.renameSync(LEDGER_FILE, LEDGER_FILE + `.${Date.now()}.bak`);
    }
  } catch {}
}

export function logAction(entry: Omit<LedgerEntry, 'entry_id' | 'ts'>): LedgerEntry {
  ensureDir();
  rotateIfNeeded();

  const full: LedgerEntry = { entry_id: entryId(), ts: new Date().toISOString(), ...entry };
  fs.appendFileSync(LEDGER_FILE, JSON.stringify(full) + '\n');
  return full;
}

export function getEntries(limit = 100, work_order_id?: string): LedgerEntry[] {
  ensureDir();
  try {
    const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
    const all = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const filtered = work_order_id ? all.filter((e: LedgerEntry) => e.work_order_id === work_order_id) : all;
    return filtered.slice(-limit).reverse();
  } catch {
    return [];
  }
}

export function getStats() {
  ensureDir();
  try {
    const lines = fs.readFileSync(LEDGER_FILE, 'utf8').split('\n').filter(Boolean);
    const all: LedgerEntry[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return {
      total_entries: all.length,
      pass: all.filter(e => e.verdict === 'PASS').length,
      fail: all.filter(e => e.verdict === 'FAIL').length,
      approval_required: all.filter(e => e.verdict === 'APPROVAL_REQUIRED').length,
      by_role: Object.fromEntries(
        [...new Set(all.map(e => e.agent_role))].map(r => [r, all.filter(e => e.agent_role === r).length])
      ),
    };
  } catch {
    return { total_entries: 0, pass: 0, fail: 0, approval_required: 0, by_role: {} };
  }
}
