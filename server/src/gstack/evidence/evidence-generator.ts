/**
 * Evidence Generator — captures proof of execution for the Reality Gate.
 *
 * After a Raw Website publish, stores a JSON evidence file at:
 *   .local-agent-global/evidence/<workflow_id>-<slug>.json
 *
 * The Reality Gate checks this file before allowing Mi to claim "published".
 */

import * as fs from 'fs';
import * as path from 'path';
import { verifyUrl } from '../connectors/raw-website-connector';

const EVIDENCE_DIR = path.join(
  __dirname, '../../../../..', '.local-agent-global', 'evidence'
);

export interface EvidenceRecord {
  workflow_id: string;
  slug: string;
  url: string;
  git_commit?: string;
  post_id?: string;
  http_status: string;
  timestamp: string;
  verified: boolean;
  steps: string[];
}

function ensureDir(): void {
  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export async function captureEvidence(opts: {
  workflow_id: string;
  slug: string;
  url: string;
  git_commit?: string;
  post_id?: string;
  steps?: string[];
}): Promise<EvidenceRecord> {
  ensureDir();

  const http_status = await verifyUrl(opts.url);
  const verified = http_status.startsWith('HTTP 2') || http_status.startsWith('HTTP 3');

  const record: EvidenceRecord = {
    workflow_id: opts.workflow_id,
    slug: opts.slug,
    url: opts.url,
    git_commit: opts.git_commit,
    post_id: opts.post_id,
    http_status,
    timestamp: new Date().toISOString(),
    verified,
    steps: opts.steps || [],
  };

  const filename = `${opts.workflow_id}-${opts.slug}.json`.replace(/[^a-zA-Z0-9._-]/g, '_');
  fs.writeFileSync(path.join(EVIDENCE_DIR, filename), JSON.stringify(record, null, 2));

  return record;
}

/**
 * Reality Gate: verify evidence exists for a given workflow + slug.
 * Returns null if no evidence found.
 */
export function checkEvidence(workflow_id: string, slug: string): EvidenceRecord | null {
  try {
    ensureDir();
    const filename = `${workflow_id}-${slug}.json`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fp = path.join(EVIDENCE_DIR, filename);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, 'utf8')) as EvidenceRecord;
  } catch {
    return null;
  }
}

/**
 * List all evidence records (for dashboard/audit).
 */
export function listEvidence(): EvidenceRecord[] {
  try {
    ensureDir();
    return fs.readdirSync(EVIDENCE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean) as EvidenceRecord[];
  } catch {
    return [];
  }
}
