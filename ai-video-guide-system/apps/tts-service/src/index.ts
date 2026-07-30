import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = parseInt(process.env.TTS_SERVICE_PORT ?? "3005", 10);
const STORAGE_BASE = process.env.STORAGE_BASE ?? path.resolve(__dirname, "../../storage");
const VOICE = process.env.EDGE_TTS_VOICE ?? "en-US-AriaNeural";
const RATE = process.env.EDGE_TTS_RATE ?? "+0%";
const PITCH = process.env.EDGE_TTS_PITCH ?? "+0Hz";

const app = express();
app.use(express.json());

function synthesizeEdgeTTS(text: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "--text", text,
      "--voice", VOICE,
      "--rate", RATE,
      "--pitch", PITCH,
      "--output", outputPath,
    ];
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

app.post("/synthesize", async (req, res) => {
  const { text, filename } = req.body as { text: string; filename?: string };

  if (!text) {
    return res.status(400).json({ error: "text required" });
  }

  const id = filename ?? `tts-${Date.now()}.mp3`;
  const audioDir = path.join(STORAGE_BASE, "audio");
  fs.mkdirSync(audioDir, { recursive: true });
  const outputPath = path.join(audioDir, id);

  console.log(`[tts] Synthesizing: "${text.substring(0, 60)}..." → ${outputPath}`);

  try {
    await synthesizeEdgeTTS(text, outputPath);
    res.json({ success: true, audioPath: outputPath, filename: id });
  } catch (err) {
    console.error("[tts] Synthesis failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.post("/synthesize-batch", async (req, res) => {
  const { texts, prefix } = req.body as { texts: string[]; prefix?: string };

  if (!texts || texts.length === 0) {
    return res.status(400).json({ error: "texts required" });
  }

  const audioDir = path.join(STORAGE_BASE, "audio");
  fs.mkdirSync(audioDir, { recursive: true });
  const results: Array<{ index: number; audioPath: string; filename: string }> = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < texts.length; i++) {
    const id = `${prefix ?? "batch"}-${String(i).padStart(3, "0")}.mp3`;
    const outputPath = path.join(audioDir, id);
    try {
      await synthesizeEdgeTTS(texts[i], outputPath);
      results.push({ index: i, audioPath: outputPath, filename: id });
    } catch (err) {
      errors.push({ index: i, error: String(err) });
    }
  }

  res.json({ results, errors });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", voice: VOICE, rate: RATE, pitch: PITCH, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[tts-service] listening on http://localhost:${PORT}`);
  console.log(`[tts-service] voice: ${VOICE}, rate: ${RATE}, pitch: ${PITCH}`);
});
