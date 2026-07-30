// =============================================================================
// TTS ENGINE CONTRACT (Sections 5, 6, 21)
// Every engine (edge-tts, fish-speech, openvoice) implements this interface.
// =============================================================================
import type { EngineId, Language } from "./types.js";

export interface SynthesisRequest {
  /** already normalized + pronunciation-applied text */
  text: string;
  language: Language;
  /** absolute output path; extension chosen from format */
  outputPath: string;
  format: "wav" | "mp3";
  /** resolved voice-profile id or built-in voice name */
  voiceId: string;
  /** speaking speed multiplier (1.0 = normal) */
  speed?: number;
  /** pitch shift in Hz (0 = default) */
  pitch?: number;
  /** optional reference audio for voice cloning */
  referenceAudioPath?: string;
}

export interface SynthesisResult {
  outputFile: string;
  durationSec: number;
  engine: EngineId;
  /** wall-clock ms for generation */
  generationMs: number;
}

export interface EngineHealth {
  available: boolean;
  reason?: string;
  gpuUsed: boolean;
  vramMb?: number;
}

export interface TTSEngine {
  readonly id: EngineId;
  readonly displayName: string;
  readonly supportsCloning: boolean;
  readonly supportedLanguages: Language[];

  /** lazily load model (no-op for lightweight engines) */
  load(): Promise<void>;
  /** unload model to free VRAM/RAM */
  unload(): Promise<void>;
  /** whether the engine is loaded & ready */
  isLoaded(): boolean;
  health(): Promise<EngineHealth>;

  /** synthesize one segment */
  synthesize(req: SynthesisRequest): Promise<SynthesisResult>;
}
