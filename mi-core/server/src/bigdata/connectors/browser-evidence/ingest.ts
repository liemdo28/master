/**
 * Browser Evidence Connector — stores screenshots and browser action outputs.
 * Called after browser automation sessions to archive evidence.
 */

import { ingestJson, ingestFile } from '../../ingestion-service';
import fs from 'fs';
import path from 'path';

const EVIDENCE_DIR = process.env.BROWSER_EVIDENCE_DIR || 'D:/Project/Master/mi-core/.local-agent-global/browser-evidence';
const SOURCE_NAME  = 'browser-evidence';

export async function ingestBrowserSession(sessionDir: string): Promise<void> {
  if (!fs.existsSync(sessionDir)) throw new Error(`Evidence dir not found: ${sessionDir}`);

  const files = fs.readdirSync(sessionDir);

  for (const file of files) {
    const fullPath = path.join(sessionDir, file);
    const ext = path.extname(file).toLowerCase();
    const buffer = fs.readFileSync(fullPath);

    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      await ingestFile({
        source_name: SOURCE_NAME,
        filename: file,
        buffer,
        content_type: `image/${ext.slice(1)}`,
        index_memory: false,
        actor: 'browser-connector',
      });
    } else if (ext === '.json') {
      let payload: Record<string, unknown>;
      try { payload = JSON.parse(buffer.toString('utf-8')); }
      catch { continue; }
      await ingestJson({ source_name: SOURCE_NAME, payload, filename: file, actor: 'browser-connector' });
    }
  }
  console.log(`[Browser Evidence] Ingested session from: ${sessionDir}`);
}

export async function ingestAllPendingEvidence(): Promise<void> {
  if (!fs.existsSync(EVIDENCE_DIR)) return;
  const sessions = fs.readdirSync(EVIDENCE_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => path.join(EVIDENCE_DIR, e.name));

  for (const sessionDir of sessions) {
    await ingestBrowserSession(sessionDir);
  }
}

if (require.main === module) {
  ingestAllPendingEvidence().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
