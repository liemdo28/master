import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { renderVideo } from "./render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = parseInt(process.env.REMOTION_RENDERER_PORT ?? "3003", 10);
const STORAGE_BASE = process.env.STORAGE_BASE ?? path.resolve(__dirname, "../../storage");

const app = express();
app.use(express.json());

app.post("/render", async (req, res) => {
  const { renderJobId, projectId, steps, outputPath } = req.body;

  if (!renderJobId || !projectId || !steps || !outputPath) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  console.log(`[remotion] Starting render job ${renderJobId} for project ${projectId}`);

  try {
    const result = await renderVideo({
      renderJobId,
      projectId,
      steps,
      outputPath: path.join(STORAGE_BASE, outputPath),
    });

    res.json({ success: true, videoPath: result.videoPath });
  } catch (err) {
    console.error("[remotion] Render failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[remotion-renderer] listening on http://localhost:${PORT}`);
});
