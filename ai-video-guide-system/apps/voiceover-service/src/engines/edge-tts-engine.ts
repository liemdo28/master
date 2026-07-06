// src/engines/edge-tts-engine.ts
// Edge TTS — always available, baseline engine for both EN and VI.
// Note: edge-tts v6 uses --write-media (not --output).
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { TTSEngine, SynthesisRequest, SynthesisResult, EngineHealth } from "@ai-video-guide/voiceover-core";
import type { EngineId, Language } from "@ai-video-guide/voiceover-core";

const EDGE_VOICES: Record<Language, { male: string; female: string }> = {
  en: { male: "en-US-GuyNeural", female: "en-US-AriaNeural" },
  vi: { male: "vi-VN-NamMinhNeural", female: "vi-VN-HoaiMyNeural" },
};

export class EdgeTTSEngine implements TTSEngine {
  readonly id: EngineId = "edge-tts";
  readonly displayName = "Edge TTS (Microsoft)";
  readonly supportsCloning = false;
  readonly supportedLanguages: Language[] = ["en", "vi"];

  private _loaded = false;

  async load(): Promise<void> {
    this._loaded = true;
  }

  async unload(): Promise<void> {
    this._loaded = false;
  }

  isLoaded(): boolean {
    return this._loaded;
  }

  async health(): Promise<EngineHealth> {
    try {
      const { execSync } = await import("child_process");
      execSync("edge-tts --version", { stdio: "pipe" });
      return { available: true, gpuUsed: false };
    } catch {
      return { available: false, reason: "edge-tts not installed", gpuUsed: false };
    }
  }

  async synthesize(req: SynthesisRequest): Promise<SynthesisResult> {
    const voice = EDGE_VOICES[req.language]?.female ?? EDGE_VOICES.en.female;
    const rate = `+${String(Math.round((req.speed ?? 1) * 100 - 100))}%`;
    const ext = req.format === "wav" ? "wav" : "mp3";
    let outFile = req.outputPath.endsWith(`.${ext}`) ? req.outputPath : `${req.outputPath}.${ext}`;

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    if (!fs.existsSync(outFile)) fs.writeFileSync(outFile, "");

    const start = Date.now();
    await this._runEdgeTTS(req.text, voice, rate, outFile);
    const durationSec = await this._probeDuration(outFile);

    return {
      outputFile: outFile,
      durationSec,
      engine: this.id,
      generationMs: Date.now() - start,
    };
  }

  private _runEdgeTTS(text: string, voice: string, rate: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // edge-tts v6.x: positional TEXT, then optional flags; output via --write-media <FILE>
      const args = ["--text", text, "--voice", voice, "--rate", rate, "--write-media", output];

      const proc = spawn("edge-tts", args, { stdio: "pipe" });
      let stderr = "";
      proc.stderr?.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`edge-tts exited ${code}: ${stderr}`));
      });
      proc.on("error", reject);
    });
  }

  private async _probeDuration(file: string): Promise<number> {
    try {
      const { execSync } = await import("child_process");
      const out = execSync(`ffprobe -v quiet -print_format json -show_format "${file}"`, { encoding: "utf-8" });
      const data = JSON.parse(out);
      return parseFloat(data.format?.duration ?? "0") || 0;
    } catch {
      return 0;
    }
  }
}
