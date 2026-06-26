import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { WorkflowDedupResult, WorkflowFingerprintInput } from './types';

interface StoredFingerprint {
  fingerprint: string;
  fingerprint_key: string;
  first_seen_at: string;
  last_seen_at: string;
  hits: number;
}

export interface WorkflowDedupOptions {
  storeDir?: string;
  now?: Date;
}

function normalizePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export function buildWorkflowFingerprintKey(input: WorkflowFingerprintInput): string {
  return [
    normalizePart(input.project),
    normalizePart(input.entity),
    normalizePart(input.action),
    normalizePart(input.time_window),
  ].join('|');
}

export function buildWorkflowFingerprint(input: WorkflowFingerprintInput): string {
  return createHash('sha256').update(buildWorkflowFingerprintKey(input)).digest('hex');
}

function defaultStoreDir(): string {
  return join(process.cwd(), '.mi-harness', 'workflow-fabric', 'fingerprints');
}

function fingerprintPath(storeDir: string, fingerprint: string): string {
  return join(storeDir, `${fingerprint}.json`);
}

export function checkAndRegisterWorkflowRun(input: WorkflowFingerprintInput, options: WorkflowDedupOptions = {}): WorkflowDedupResult {
  const now = (options.now ?? new Date()).toISOString();
  const storeDir = options.storeDir ?? defaultStoreDir();
  mkdirSync(storeDir, { recursive: true });

  const fingerprint_key = buildWorkflowFingerprintKey(input);
  const fingerprint = buildWorkflowFingerprint(input);
  const fp = fingerprintPath(storeDir, fingerprint);

  if (existsSync(fp)) {
    const stored = JSON.parse(readFileSync(fp, 'utf-8')) as StoredFingerprint;
    stored.last_seen_at = now;
    stored.hits += 1;
    writeFileSync(fp, JSON.stringify(stored, null, 2));
    return {
      status: 'SKIP_DUPLICATE',
      fingerprint,
      fingerprint_key,
      reason: 'Duplicate workflow run matched project + entity + action + time_window.',
      first_seen_at: stored.first_seen_at,
      last_seen_at: stored.last_seen_at,
    };
  }

  const stored: StoredFingerprint = {
    fingerprint,
    fingerprint_key,
    first_seen_at: now,
    last_seen_at: now,
    hits: 1,
  };
  writeFileSync(fp, JSON.stringify(stored, null, 2));
  return {
    status: 'REGISTERED',
    fingerprint,
    fingerprint_key,
    reason: 'New workflow fingerprint registered.',
    first_seen_at: now,
    last_seen_at: now,
  };
}
