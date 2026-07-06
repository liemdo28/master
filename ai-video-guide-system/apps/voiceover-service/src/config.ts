// src/config.ts
import path from "path";
import { fileURLToPath } from "url";
import { RoutingConfigSchema } from "@ai-video-guide/voiceover-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root
const root = path.resolve(__dirname, "../../..");
try {
  const { config: dotenvConfig } = await import("dotenv");
  dotenvConfig({ path: path.join(root, ".env") });
} catch { /* no dotenv, continue */ }

export const VOICEOVER_PORT = parseInt(process.env.VOICEOVER_PORT ?? "3010", 10);
export const STORAGE_BASE = process.env.STORAGE_BASE ?? path.join(root, "storage");
export const VOICEOVER_STORAGE = path.join(STORAGE_BASE, "voiceover");
export const DB_PATH = process.env.VOICEOVER_DB ?? path.join(root, "data", "voiceover.db");

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
export const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o";

export const NARRATION_SERVICE_URL =
  process.env.NARRATION_SERVICE_URL ?? "http://localhost:3004";
export const REMOTION_RENDERER_URL =
  process.env.REMOTION_RENDERER_URL ?? "http://localhost:3003";

export const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "ffmpeg";
export const FFPROBE_PATH = process.env.FFPROBE_PATH ?? "ffprobe";

export const MAX_RETRIES = parseInt(process.env.VOICEOVER_MAX_RETRIES ?? "3", 10);
export const QA_THRESHOLD = parseFloat(process.env.VOICEOVER_Q ?? "95");

// TTS routing config — benchmark results determine which engines are primary/fallback.
// Default (no GPU): edge-tts handles both EN and VI.
const rawRouting = {
  english: {
    primary: (process.env.TTS_EN_PRIMARY as "edge-tts" | "fish-speech" | "openvoice") ?? "edge-tts",
    fallback: (process.env.TTS_EN_FALLBACK as "edge-tts" | "fish-speech" | "openvoice") ?? "edge-tts",
  },
  vietnamese: {
    primary: (process.env.TTS_VI_PRIMARY as "edge-tts" | "fish-speech" | "openvoice") ?? "edge-tts",
    fallback: (process.env.TTS_VI_FALLBACK as "edge-tts" | "fish-speech" | "openvoice") ?? "edge-tts",
  },
};
export const ROUTING_CONFIG = RoutingConfigSchema.parse(rawRouting);

// Ensure storage dirs exist
import fs from "fs";
const dirs = [
  VOICEOVER_STORAGE,
  path.join(VOICEOVER_STORAGE, "projects"),
  path.join(VOICEOVER_STORAGE, "voices"),
  path.join(VOICEOVER_STORAGE, "pronunciation"),
  path.join(VOICEOVER_STORAGE, "cache"),
  path.join(VOICEOVER_STORAGE, "logs"),
  path.join(VOICEOVER_STORAGE, "temp"),
  path.join(root, "data"),
];
for (const d of dirs) fs.mkdirSync(d, { recursive: true });
