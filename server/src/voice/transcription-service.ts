/**
 * Transcription Service — local Vietnamese speech-to-text via faster-whisper.
 * Runs as a Python subprocess. Primary: local. Fallback: none (or cloud if CEO config allows).
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'medium';  // tiny/base/small/medium/large-v3
const WHISPER_LANG = process.env.WHISPER_LANG || 'vi';        // Vietnamese default

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;       // 0–1 estimated
  duration_seconds: number;
  model: string;
  segments: Array<{ start: number; end: number; text: string }>;
  error?: string;
}

// Inline Python script so no separate file needed
function buildWhisperScript(audioPath: string): string {
  return `
import sys, json, time
try:
    from faster_whisper import WhisperModel
    model = WhisperModel("${WHISPER_MODEL}", device="cpu", compute_type="int8")
    segs, info = model.transcribe("${audioPath.replace(/\\/g, '/')}", language="${WHISPER_LANG}", beam_size=5)
    segments = [{"start": round(s.start,2), "end": round(s.end,2), "text": s.text.strip()} for s in segs]
    text = " ".join(s["text"] for s in segments).strip()
    avg_prob = info.language_probability if hasattr(info,"language_probability") else 0.9
    print(json.dumps({
        "text": text,
        "language": info.language,
        "confidence": round(avg_prob, 3),
        "duration_seconds": round(info.duration if hasattr(info,"duration") else 0, 2),
        "model": "${WHISPER_MODEL}",
        "segments": segments
    }))
except Exception as e:
    print(json.dumps({"error": str(e), "text": "", "language": "vi", "confidence": 0, "duration_seconds": 0, "model": "${WHISPER_MODEL}", "segments": []}))
`.trim();
}

export async function transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
  return new Promise((resolve) => {
    if (!fs.existsSync(audioPath)) {
      resolve({ text: '', language: 'vi', confidence: 0, duration_seconds: 0, model: WHISPER_MODEL, segments: [], error: 'File not found' });
      return;
    }

    const script = buildWhisperScript(audioPath);
    const proc = spawn(PYTHON_BIN, ['-c', script], { timeout: 120_000 });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', () => {
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result as TranscriptionResult);
      } catch {
        resolve({
          text: '', language: 'vi', confidence: 0, duration_seconds: 0,
          model: WHISPER_MODEL, segments: [],
          error: `Parse failed. stderr: ${stderr.slice(0, 300)}`,
        });
      }
    });

    proc.on('error', err => {
      resolve({ text: '', language: 'vi', confidence: 0, duration_seconds: 0, model: WHISPER_MODEL, segments: [], error: err.message });
    });
  });
}

export async function isTranscriptionAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn(PYTHON_BIN, ['-c', 'from faster_whisper import WhisperModel; print("ok")'], { timeout: 10_000 });
    let ok = false;
    proc.stdout.on('data', d => { if (d.toString().includes('ok')) ok = true; });
    proc.on('close', () => resolve(ok));
    proc.on('error', () => resolve(false));
  });
}
