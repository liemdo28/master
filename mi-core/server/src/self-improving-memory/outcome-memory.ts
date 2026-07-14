/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';

export interface OutcomeRecord {
  taskId: string;
  result: string;
  roi: number;
  timestamp: string;
  agentId: string;
}

const EVIDENCE_DIR = path.resolve('d:/Project/Master/mi-core/evidence/self-improving-memory');
const STORE_FILE = path.join(EVIDENCE_DIR, 'outcomes.jsonl');

function ensureDir(): void {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, '');
  }
}

export function storeOutcome(outcome: { taskId: string; result: string; roi: number; timestamp: string; agentId: string }): OutcomeRecord {
  ensureDir();
  const record: OutcomeRecord = { ...outcome };
  fs.appendFileSync(STORE_FILE, JSON.stringify(record) + '\\n');
  fs.appendFileSync(path.join(EVIDENCE_DIR, 'outcome-log.txt'), '[' + record.timestamp + '] Outcome stored: taskId=' + record.taskId + ', roi=' + record.roi + ', agentId=' + record.agentId + '\\n');
  return record;
}

export function getOutcomes(limit?: number): OutcomeRecord[] {
  ensureDir();
  const raw = fs.readFileSync(STORE_FILE, 'utf-8').trim();
  if (!raw) return [];
  const records = raw.split('\\n').filter(Boolean).map(line => JSON.parse(line) as OutcomeRecord);
  return limit ? records.slice(-limit) : records;
}

export function getOutcomesByAgent(agentId: string): OutcomeRecord[] {
  return getOutcomes().filter(r => r.agentId === agentId);
}

export function getOutcomesByType(type: 'success' | 'failure' | 'partial'): OutcomeRecord[] {
  return getOutcomes().filter(r => r.result === type);
}
