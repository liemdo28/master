// src/services/tts-router.ts
// Routes synthesis requests to the best available engine per language.
// Section 5 — primary/fallback routing based on benchmark results.
import type { TTSEngine, SynthesisRequest, SynthesisResult, EngineHealth } from "@ai-video-guide/voiceover-core";
import type { EngineId, Language } from "@ai-video-guide/voiceover-core";
import { EdgeTTSEngine } from "../engines/edge-tts-engine.js";
import { ROUTING_CONFIG } from "../config.js";
import { insertAudit } from "../db.js";
import { v4 as uuid } from "uuid";

type EngineRegistry = Map<EngineId, TTSEngine>;

export class TTSRouter {
  private engines: EngineRegistry = new Map();
  private primaryLoadOrder: EngineId[] = [];

  constructor() {
    // Always register Edge TTS (baseline, always available)
    this.registerEngine(new EdgeTTSEngine());
    // Fish Speech and OpenVoice are registered when available (lazy / GPU)
  }

  registerEngine(engine: TTSEngine): void {
    this.engines.set(engine.id, engine);
    // Load lightweight engines eagerly, heavy ones lazily
    if (engine.id === "edge-tts") {
      engine.load().catch(console.error);
    }
  }

  isRegistered(id: EngineId): boolean {
    return this.engines.has(id);
  }

  async synthesize(
    req: SynthesisRequest,
    jobId: string
  ): Promise<SynthesisResult> {
    const langKey = req.language === "vi" ? "vietnamese" : "english";
    const cfg = ROUTING_CONFIG[langKey];

    const attemptOrder: EngineId[] = [cfg.primary, cfg.fallback].filter(
      (id, i, arr) => arr.indexOf(id) === i && this.engines.has(id)
    );

    if (attemptOrder.length === 0) {
      throw new Error(`No TTS engine available for ${req.language}. Install edge-tts: pip install edge-tts`);
    }

    let lastError: unknown;
    for (const engineId of attemptOrder) {
      const engine = this.engines.get(engineId)!;
      const health = await engine.health();
      if (!health.available) {
        console.warn(`[router] Engine ${engineId} unavailable: ${health.reason}`);
        continue;
      }

      if (!engine.isLoaded()) {
        try {
          await engine.load();
        } catch (e) {
          console.warn(`[router] Failed to load ${engineId}: ${e}`);
          continue;
        }
      }

      try {
        insertAudit({
          id: uuid(), jobId, segmentId: null,
          event: "engine_attempt",
          detail: `${engineId} for ${req.language}`,
          engine: engineId, timestamp: new Date().toISOString(),
        });
        return await engine.synthesize(req);
      } catch (e) {
        console.warn(`[router] Engine ${engineId} failed: ${e}`);
        lastError = e;
      }
    }

    throw lastError ?? new Error(`All engines failed for ${req.language}`);
  }

  getEngine(id: EngineId): TTSEngine | undefined {
    return this.engines.get(id);
  }

  listEngines(): Array<{ id: EngineId; health: Promise<EngineHealth> }> {
    return [...this.engines.entries()].map(([id, eng]) => ({
      id,
      health: eng.health(),
    }));
  }

  async unloadAll(): Promise<void> {
    for (const eng of this.engines.values()) {
      try { await eng.unload(); } catch { /* best effort */ }
    }
  }
}

// Singleton router — shared across all request handlers
export const ttsRouter = new TTSRouter();
