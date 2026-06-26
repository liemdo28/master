/** Phase 0 â€” Evidence Registry
 * 
 * Central registry of evidence linked to tasks.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import type { EvidenceRef } from './types';

const DATA_DIR = join(process.cwd(), '.mi-harness', 'coordination');
const EVIDENCE_DIR = join(DATA_DIR, 'evidence');

function ensureDirs() { mkdirSync(EVIDENCE_DIR, { recursive: true }); }

export function addEvidenceRecord(taskId: string, evidence: EvidenceRef): EvidenceRef {
  ensureDirs();
  const fp = join(EVIDENCE_DIR, `${taskId}.json`);
  const current = existsSync(fp)
    ? (() => { try { return JSON.parse(readFileSync(fp, 'utf-8')); } catch { return []; } })()
    : [];
  const enriched = { ...evidence, capturedAt: evidence.capturedAt || new Date().toISOString() };
  current.push(enriched);
  writeFileSync(fp, JSON.stringify(current, null, 2));
  return enriched;
}

export function getEvidenceRecords(taskId: string): EvidenceRef[] {
  const fp = join(EVIDENCE_DIR, `${taskId}.json`);
  if (!existsSync(fp)) return [];
  try { return JSON.parse(readFileSync(fp, 'utf-8')); } catch { return []; }
}

export function getAllEvidenceRecords(): Array<{ taskId: string; evidence: EvidenceRef[] }> {
  ensureDirs();
  try {
    return readdirSync(EVIDENCE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ taskId: f.replace(/\.json$/, ''), evidence: getEvidenceRecords(f.replace(/\.json$/, '')) }));
  } catch { return []; }
}
