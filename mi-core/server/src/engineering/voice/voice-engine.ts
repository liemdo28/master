/**
 * Voice Engine — STT (Whisper) + TTS (ElevenLabs/OpenAI) + Voice Command Classifier
 */

import https from 'https';
import * as fs from 'fs';

// ── STT — Whisper via OpenAI ──────────────────────────────────────────────────

export async function transcribe(audioBuffer: Buffer, filename: string = 'audio.webm'): Promise<{
  text: string; language: string; duration_s: number; error?: string;
}> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { text: '', language: '', duration_s: 0, error: 'OPENAI_API_KEY not set' };

  const boundary = `----FormBoundary${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nvi\r\n`),
    Buffer.from(`--${boundary}--\r\n`),
  ]);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/audio/transcriptions', method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve({ text: j.text || '', language: j.language || 'vi', duration_s: j.duration || 0 });
        } catch {
          resolve({ text: '', language: '', duration_s: 0, error: d.slice(0, 200) });
        }
      });
    });
    req.on('error', e => resolve({ text: '', language: '', duration_s: 0, error: e.message }));
    req.write(body); req.end();
  });
}

// ── TTS — OpenAI TTS (primary) / ElevenLabs (premium) ───────────────────────

export async function synthesize(text: string, voice: 'alloy' | 'nova' | 'shimmer' = 'nova'): Promise<{
  audio_b64: string; format: string; error?: string;
}> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { audio_b64: '', format: '', error: 'OPENAI_API_KEY not set' };

  const body = JSON.stringify({ model: 'tts-1', input: text.slice(0, 4096), voice, response_format: 'mp3' });

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/audio/speech', method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({ audio_b64: '', format: '', error: `TTS HTTP ${res.statusCode}` });
        } else {
          resolve({ audio_b64: Buffer.concat(chunks).toString('base64'), format: 'mp3' });
        }
      });
    });
    req.on('error', e => resolve({ audio_b64: '', format: '', error: e.message }));
    req.write(body); req.end();
  });
}

// ── Voice Command Classifier ──────────────────────────────────────────────────

export interface VoiceCommand {
  intent:      string;
  confidence:  number;
  entities:    Record<string, string>;
  raw_text:    string;
}

const COMMAND_PATTERNS: { pattern: RegExp; intent: string }[] = [
  { pattern: /tạo task|create task|new task/i,     intent: 'create_task' },
  { pattern: /fix bug|sửa lỗi/i,                   intent: 'bugfix' },
  { pattern: /deploy|triển khai/i,                 intent: 'deploy' },
  { pattern: /status|trạng thái/i,                 intent: 'check_status' },
  { pattern: /review|kiểm tra code/i,              intent: 'code_review' },
  { pattern: /báo cáo|report/i,                    intent: 'report' },
  { pattern: /approve|duyệt/i,                     intent: 'approve' },
];

export function classifyVoiceCommand(text: string): VoiceCommand {
  for (const { pattern, intent } of COMMAND_PATTERNS) {
    if (pattern.test(text)) {
      return { intent, confidence: 85, entities: {}, raw_text: text };
    }
  }
  return { intent: 'unknown', confidence: 0, entities: {}, raw_text: text };
}
