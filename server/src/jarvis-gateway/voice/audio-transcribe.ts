/**
 * Phase 7F §21 — the one audio-accepting endpoint. Deliberately narrow:
 * accepts an uploaded file only (never a URL — no SSRF surface), strict
 * size/type limits, and its ONLY output is a transcript string. It never
 * calls handleGatewayRequest() or handleVoiceRequest() itself — the
 * caller (Command Center) must show the transcript to the user and
 * explicitly submit it via POST /jarvis/voice/transcript as a separate,
 * visible step (§22/§23 — no hidden auto-submit). This route exists only
 * for browsers without a usable Web Speech API; the primary, zero-upload
 * path is client-side transcription.
 */
import fs from 'fs';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { transcribeAudio, isTranscriptionAvailable } from '../../voice/transcription-service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB — a few minutes of compressed speech, generous but bounded
const ALLOWED_MIME_TYPES = new Set(['audio/webm', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/mpeg', 'audio/ogg']);

const uploadDir = path.join(os.tmpdir(), 'mi-voice-uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export const audioUpload = multer({
  dest: uploadDir,
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

export interface AudioTranscribeResult {
  transcript: string;
  confidence: number;
  language: string;
  available: boolean;
  error?: string;
}

export async function transcribeUploadedAudio(filePath: string): Promise<AudioTranscribeResult> {
  const available = await isTranscriptionAvailable();
  if (!available) {
    return { transcript: '', confidence: 0, language: 'unknown', available: false, error: 'Speech-to-text is currently unavailable.' };
  }
  const result = await transcribeAudio(filePath);
  if (result.error) {
    return { transcript: '', confidence: 0, language: result.language, available: true, error: result.error };
  }
  return { transcript: result.text, confidence: result.confidence, language: result.language, available: true };
}

/** Always removes the uploaded temp file — audio is never retained beyond
 *  the single transcription call (§20/§36 — no raw audio fixtures/retention). */
export function cleanupUploadedAudio(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* best effort */ }
}
