/**
 * Audio Store — saves WhatsApp voice notes to MinIO and metadata to PostgreSQL.
 * Raw audio is stored as blobs. Transcript is stored as structured text.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pgQuery } from '../bigdata/db-client';
import { putObject, BUCKETS } from '../bigdata/minio-client';

const AUDIO_DIR = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'voice', 'audio'
);

export interface AudioRecord {
  audio_id: string;
  sender: string;
  chat_id: string;
  message_id: string;
  duration_seconds: number | null;
  file_path: string;
  minio_key: string | null;
  transcript: string | null;
  language: string | null;
  confidence: number | null;
  stored_at: string;
}

export function ensureAudioDir() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

export async function saveAudioFile(params: {
  buffer: Buffer;
  sender: string;
  chat_id: string;
  message_id: string;
  extension?: string;
}): Promise<AudioRecord> {
  ensureAudioDir();
  const { buffer, sender, chat_id, message_id, extension = 'ogg' } = params;
  const audio_id = crypto.randomUUID();
  const filename = `${audio_id}.${extension}`;
  const file_path = path.join(AUDIO_DIR, filename);

  fs.writeFileSync(file_path, buffer);

  // Upload to MinIO (best-effort)
  let minio_key: string | null = null;
  try {
    minio_key = `voice/audio/${filename}`;
    await putObject(BUCKETS.RAW, minio_key, buffer, `audio/${extension}`);
  } catch { minio_key = null; }

  const record: AudioRecord = {
    audio_id, sender, chat_id, message_id,
    duration_seconds: null,
    file_path,
    minio_key,
    transcript: null,
    language: null,
    confidence: null,
    stored_at: new Date().toISOString(),
  };

  // Persist to PG (best-effort)
  try {
    await pgQuery(`
      INSERT INTO voice_audio (audio_id, sender, chat_id, message_id, file_path, minio_key, stored_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (audio_id) DO NOTHING`,
      [audio_id, sender, chat_id, message_id, file_path, minio_key, record.stored_at]
    );
  } catch { /* PG optional */ }

  return record;
}

export async function saveTranscript(audio_id: string, transcript: string, language: string, confidence: number) {
  try {
    await pgQuery(`
      UPDATE voice_audio SET transcript=$1, language=$2, confidence=$3 WHERE audio_id=$4`,
      [transcript, language, confidence, audio_id]
    );
  } catch { /* optional */ }
}

export async function ensureVoiceSchema() {
  try {
    await pgQuery(`
      CREATE TABLE IF NOT EXISTS voice_audio (
        audio_id TEXT PRIMARY KEY,
        sender TEXT,
        chat_id TEXT,
        message_id TEXT,
        file_path TEXT,
        minio_key TEXT,
        transcript TEXT,
        language TEXT,
        confidence NUMERIC,
        stored_at TIMESTAMPTZ DEFAULT now()
      )`);
  } catch { /* PG optional */ }
}
