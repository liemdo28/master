/**
 * Phase 7F §15/§21 — TTS output. Synthesizes exactly the text handed to
 * it (already-redacted spoken text from voice-gateway.ts, never a
 * separate/riskier channel) and returns audio bytes directly rather than
 * a servable file path or URL — avoids retaining synthesized audio on
 * disk beyond the single request and avoids needing a second,
 * access-control-bearing GET route (§21 — minimal API surface).
 */
import fs from 'fs';
import { synthesizeSpeech, isTTSAvailable } from '../../voice/tts-service';

const MAX_SYNTHESIZE_TEXT_LENGTH = 2000;

export interface SynthesizeResult {
  available: boolean;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
}

export async function synthesizeVoiceOutput(text: string): Promise<SynthesizeResult> {
  if (!isTTSAvailable()) {
    return { available: false, error: 'Text-to-speech is currently unavailable.' };
  }
  if (!text || text.trim().length === 0) {
    return { available: false, error: 'No text to synthesize.' };
  }
  const trimmed = text.slice(0, MAX_SYNTHESIZE_TEXT_LENGTH);
  const result = await synthesizeSpeech(trimmed, 'vi');
  if (!result.available || !result.audio_path) {
    return { available: false, error: result.error ?? 'Synthesis failed.' };
  }
  try {
    const bytes = fs.readFileSync(result.audio_path);
    return { available: true, audioBase64: bytes.toString('base64'), mimeType: 'audio/mpeg' };
  } catch (err) {
    return { available: false, error: err instanceof Error ? err.message : 'Failed to read synthesized audio.' };
  } finally {
    try { fs.unlinkSync(result.audio_path); } catch { /* best effort — never retain synthesized audio on disk */ }
  }
}
