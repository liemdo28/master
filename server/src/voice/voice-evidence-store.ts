/**
 * Voice Evidence Store — persists voice output records with workflow IDs.
 *
 * Evidence includes:
 *   - audio file path and metadata
 *   - text content that was synthesized
 *   - recipient and delivery status
 *   - approval gate status
 *   - workflow ID for traceability
 *
 * Storage: .local-agent-global/voice/evidence/{workflow_id}.json
 * Backup: PostgreSQL voice_evidence table (best-effort)
 */

import fs from 'fs';
import path from 'path';
import { pgQuery } from '../bigdata/db-client';

const EVIDENCE_DIR = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'voice', 'evidence'
);

function ensureDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export interface VoiceEvidence {
  workflow_id: string;
  audio_id: string;
  audio_path: string;
  text_content: string;
  text_report?: string;
  recipient: string;
  recipient_name?: string;
  is_ceo: boolean;
  approval_id?: string;
  approval_status: 'auto_approved' | 'pending_approval' | 'approved' | 'skipped_ceo';
  whatsapp_sent: boolean;
  voice: string;
  file_size_bytes: number;
  synthesis_ms: number;
  created_at: string;
}

/**
 * Save voice evidence record to disk and optionally to PostgreSQL.
 */
export async function saveVoiceEvidence(params: Omit<VoiceEvidence, 'created_at'>): Promise<VoiceEvidence> {
  ensureDir();

  const evidence: VoiceEvidence = {
    ...params,
    created_at: new Date().toISOString(),
  };

  // Write to disk
  const filePath = path.join(EVIDENCE_DIR, `${params.workflow_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(evidence, null, 2), 'utf-8');

  // Persist to PostgreSQL (best-effort)
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS voice_evidence (
        workflow_id     TEXT PRIMARY KEY,
        audio_id        TEXT,
        audio_path      TEXT,
        text_content    TEXT,
        text_report     TEXT,
        recipient       TEXT,
        recipient_name  TEXT,
        is_ceo          BOOLEAN DEFAULT false,
        approval_id     TEXT,
        approval_status TEXT,
        whatsapp_sent   BOOLEAN DEFAULT false,
        voice           TEXT,
        file_size_bytes INTEGER,
        synthesis_ms    INTEGER,
        created_at      TIMESTAMPTZ DEFAULT now()
      )
    `);

    await pgQuery(`
      INSERT INTO voice_evidence
        (workflow_id, audio_id, audio_path, text_content, text_report,
         recipient, recipient_name, is_ceo, approval_id, approval_status,
         whatsapp_sent, voice, file_size_bytes, synthesis_ms, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (workflow_id) DO UPDATE SET
        whatsapp_sent = EXCLUDED.whatsapp_sent,
        approval_status = EXCLUDED.approval_status
    `, [
      evidence.workflow_id, evidence.audio_id, evidence.audio_path,
      evidence.text_content, evidence.text_report || null,
      evidence.recipient, evidence.recipient_name || null,
      evidence.is_ceo, evidence.approval_id || null,
      evidence.approval_status, evidence.whatsapp_sent,
      evidence.voice, evidence.file_size_bytes, evidence.synthesis_ms,
      evidence.created_at,
    ]);
  } catch { /* PG optional */ }

  console.log(`[VoiceEvidence] Saved: ${filePath}`);
  return evidence;
}

/**
 * Get evidence by workflow ID.
 */
export function getVoiceEvidence(workflow_id: string): VoiceEvidence | null {
  const filePath = path.join(EVIDENCE_DIR, `${workflow_id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * List recent voice evidence records.
 */
export function listVoiceEvidence(limit = 20): VoiceEvidence[] {
  ensureDir();
  const files = fs.readdirSync(EVIDENCE_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, f), 'utf-8'));
    } catch {
      return null;
    }
  }).filter(Boolean) as VoiceEvidence[];
}
