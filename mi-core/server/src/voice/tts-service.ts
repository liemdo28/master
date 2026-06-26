/**
 * VieNeu-TTS Service — Vietnamese text-to-speech for Mi-Core.
 * Engine: Microsoft Edge TTS (edge-tts Python package).
 * Voices: vi-VN-HoaiMyNeural (Female), vi-VN-NamMinhNeural (Male).
 *
 * Enable via VOICE_TTS_ENABLED=1 in .env.
 * Falls back gracefully when Python/edge-tts is unavailable.
 */

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TTS_ENABLED = process.env.VOICE_TTS_ENABLED === '1';
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';
const SYNTH_SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'vietts_synthesize.py');
const DEFAULT_VOICE = process.env.VIETTS_VOICE || 'vi-VN-HoaiMyNeural';
const DEFAULT_RATE = process.env.VIETTS_RATE || '+0%';

const TTS_OUTPUT_DIR = path.join(
  process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global',
  'voice', 'tts'
);

function ensureTtsDir() {
  if (!fs.existsSync(TTS_OUTPUT_DIR)) fs.mkdirSync(TTS_OUTPUT_DIR, { recursive: true });
}

export interface TTSResult {
  available: boolean;
  audio_path?: string;
  audio_id?: string;
  file_size_bytes?: number;
  synthesis_ms?: number;
  voice?: string;
  text_length?: number;
  error?: string;
}

/**
 * Synthesize Vietnamese text to MP3 audio via edge-tts.
 * @param text  Vietnamese text (supports code-switching with English)
 * @param lang  Language hint (default 'vi')
 * @param opts  Optional: voice, rate, workflow_id
 */
export async function synthesizeSpeech(
  text: string,
  lang = 'vi',
  opts?: { voice?: string; rate?: string; workflow_id?: string }
): Promise<TTSResult> {
  if (!TTS_ENABLED) {
    return { available: false, error: 'TTS disabled. Set VOICE_TTS_ENABLED=1 to enable.' };
  }

  if (!text || text.trim().length === 0) {
    return { available: false, error: 'Empty text — nothing to synthesize.' };
  }

  // Check if synthesis script exists
  if (!fs.existsSync(SYNTH_SCRIPT)) {
    return { available: false, error: `Synthesis script not found: ${SYNTH_SCRIPT}` };
  }

  ensureTtsDir();

  const audio_id = crypto.randomUUID();
  const output_file = opts?.workflow_id
    ? path.join(TTS_OUTPUT_DIR, `${opts.workflow_id}_${audio_id}.mp3`)
    : path.join(TTS_OUTPUT_DIR, `${audio_id}.mp3`);

  const voice = opts?.voice || DEFAULT_VOICE;
  const rate = opts?.rate || DEFAULT_RATE;

  // Clean text for speech — remove markdown formatting
  const cleanText = text
    .replace(/\*+/g, '')          // remove bold markers
    .replace(/_{2,}/g, '')        // remove underline markers
    .replace(/`[^`]+`/g, (m) => m.replace(/`/g, '')) // remove code backticks
    .replace(/#{1,6}\s/g, '')     // remove heading markers
    .replace(/[•●○■▪▸►]/g, '')   // remove bullet chars
    .replace(/\n{3,}/g, '\n\n')   // collapse triple+ newlines
    .trim();

  try {
    const t0 = Date.now();
    const { stdout, stderr } = await execFileAsync(PYTHON_BIN, [
      SYNTH_SCRIPT,
      '--text', cleanText,
      '--output', output_file,
      '--voice', voice,
      '--rate', rate,
    ], {
      timeout: 60_000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    });

    const synthesis_ms = Date.now() - t0;

    // Parse Python JSON output
    let result: Record<string, unknown> = {};
    try {
      // Find JSON in stdout (last line is typically the result)
      const lines = stdout.trim().split('\n');
      for (const line of lines.reverse()) {
        try {
          result = JSON.parse(line);
          break;
        } catch { /* try next line */ }
      }
    } catch { /* ignore parse errors */ }

    if (result.ok === false) {
      return { available: false, error: result.error as string || 'Synthesis failed' };
    }

    if (result.ok && fs.existsSync(output_file)) {
      const stats = fs.statSync(output_file);
      return {
        available: true,
        audio_path: output_file,
        audio_id,
        file_size_bytes: stats.size,
        synthesis_ms,
        voice,
        text_length: cleanText.length,
      };
    }

    return { available: false, error: `Output file not created. stderr: ${stderr}` };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[VieNeu-TTS] Synthesis error:', errMsg);
    return { available: false, error: errMsg };
  }
}

export function isTTSAvailable(): boolean {
  if (!TTS_ENABLED) return false;
  // Quick check: is Python and edge-tts available?
  try {
    return fs.existsSync(SYNTH_SCRIPT);
  } catch {
    return false;
  }
}

/**
 * List available Vietnamese voices.
 */
export async function listVietnameseVoices(): Promise<Array<{
  short_name: string;
  gender: string;
  locale: string;
  friendly_name: string;
}>> {
  try {
    const { stdout } = await execFileAsync(PYTHON_BIN, [
      SYNTH_SCRIPT, '--list-voices',
    ], { timeout: 15_000, encoding: 'utf-8' });
    return stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [
      { short_name: 'vi-VN-HoaiMyNeural', gender: 'Female', locale: 'vi-VN', friendly_name: 'Microsoft HoaiMy Online (Natural)' },
      { short_name: 'vi-VN-NamMinhNeural', gender: 'Male', locale: 'vi-VN', friendly_name: 'Microsoft NamMinh Online (Natural)' },
    ];
  }
}
