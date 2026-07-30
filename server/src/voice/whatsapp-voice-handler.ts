/**
 * WhatsApp Voice Handler — detects voice messages, downloads audio,
 * stores in MinIO, transcribes with faster-whisper, routes like a text command.
 *
 * Level 1: voice → transcript → text response  ✅
 * Level 2: voice → intent → execute → response  ✅
 * Level 3: voice → intent → execute → voice response  🔬 experimental
 */

import https from 'https';
import http from 'http';
import { saveAudioFile, saveTranscript, ensureVoiceSchema } from './audio-store';
import { transcribeAudio } from './transcription-service';
import { parseVietnameseIntent } from './vietnamese-intent-parser';
import { runPipeline } from '../pipeline/response-pipeline';

export interface VoiceMessagePayload {
  message_id: string;
  sender: string;
  chat_id: string;
  group_id?: string;
  audio_url?: string;
  voice_url?: string;
  audio_base64?: string;
  mime_type?: string;
}

export interface VoiceHandlerResult {
  ok: boolean;
  audio_id?: string;
  transcript?: string;
  language?: string;
  confidence?: number;
  intent?: string;
  reply?: string;
  error?: string;
}

async function downloadAudio(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function handleVoiceMessage(payload: VoiceMessagePayload): Promise<VoiceHandlerResult> {
  await ensureVoiceSchema();

  // 1. Get audio bytes
  let buffer: Buffer | null = null;
  let extension = 'ogg';

  if (payload.audio_base64) {
    buffer = Buffer.from(payload.audio_base64, 'base64');
  } else if (payload.audio_url || payload.voice_url) {
    const url = (payload.audio_url || payload.voice_url)!;
    try {
      buffer = await downloadAudio(url);
      extension = url.split('.').pop()?.split('?')[0] || 'ogg';
    } catch (err) {
      return { ok: false, error: `Audio download failed: ${err}` };
    }
  } else {
    return { ok: false, error: 'No audio source provided (audio_url, voice_url, or audio_base64 required)' };
  }

  // 2. Save to local + MinIO
  const record = await saveAudioFile({
    buffer,
    sender: payload.sender,
    chat_id: payload.chat_id,
    message_id: payload.message_id,
    extension,
  });

  // 3. Transcribe
  const tx = await transcribeAudio(record.file_path);

  if (tx.error && !tx.text) {
    return { ok: false, audio_id: record.audio_id, error: `Transcription failed: ${tx.error}` };
  }

  // 4. Save transcript
  await saveTranscript(record.audio_id, tx.text, tx.language, tx.confidence);

  // 5. Parse Vietnamese intent
  const voiceIntent = parseVietnameseIntent(tx.text);

  // 6. Route through pipeline like a text command
  let reply = `🎤 *Transcript:* "${tx.text}"\n\n`;
  try {
    const pipelineResult = await runPipeline({
      message: voiceIntent.normalized_command,
      mode: 'mi' as import('../services/mi-brain').MiMode,
      history: [],
      intent: voiceIntent.intent,
    });
    reply += pipelineResult.reply || '(no response)';
  } catch (err) {
    reply += `⚠️ Không thể xử lý lệnh: ${err}`;
  }

  return {
    ok: true,
    audio_id: record.audio_id,
    transcript: tx.text,
    language: tx.language,
    confidence: tx.confidence,
    intent: voiceIntent.intent,
    reply,
  };
}
