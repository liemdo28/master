import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = parseInt(process.env.NARRATION_SERVICE_PORT ?? "3004", 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: OPENAI_BASE_URL,
});

/**
 * Generate a narration script from a list of step descriptions.
 */
async function generateNarration(steps: Array<{ orderIndex: number; description: string }>): Promise<string> {
  const stepsText = steps
    .map((s) => `Step ${s.orderIndex + 1}: ${s.description}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a professional video narrator for software tutorials. " +
          "Write a clear, concise, engaging narration script for the given steps. " +
          "Keep it conversational and beginner-friendly. " +
          "Return only the narration text, no numbering or bullet points.",
      },
      {
        role: "user",
        content: `Generate narration for these steps:\n${stepsText}`,
      },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? "";
}

/**
 * Segment narration into per-step scripts.
 */
async function segmentNarration(
  fullNarration: string,
  steps: Array<{ orderIndex: number; description: string }>
): Promise<Record<number, string>> {
  // Simple split by sentences — for production, use more sophisticated chunking
  const sentences = fullNarration.split(/(?<=[.!?])\s+/).filter(Boolean);
  const perStep: Record<number, string> = {};

  if (sentences.length <= steps.length) {
    steps.forEach((s, i) => {
      perStep[s.orderIndex] = sentences[i] ?? s.description;
    });
  } else {
    const chunkSize = Math.ceil(sentences.length / steps.length);
    steps.forEach((s, i) => {
      const chunk = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
      perStep[s.orderIndex] = chunk.join(" ") || s.description;
    });
  }

  return perStep;
}

app.post("/generate", async (req, res) => {
  const { steps } = req.body as {
    steps: Array<{ orderIndex: number; description: string }>;
  };

  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "steps required" });
  }

  console.log(`[narration] Generating narration for ${steps.length} steps`);

  try {
    const fullNarration = await generateNarration(steps);
    const perStep = await segmentNarration(fullNarration, steps);

    res.json({ fullNarration, perStep });
  } catch (err) {
    console.error("[narration] Generation failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", model: AI_MODEL, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[narration-service] listening on http://localhost:${PORT}`);
  console.log(`[narration-service] model: ${AI_MODEL}`);
});
