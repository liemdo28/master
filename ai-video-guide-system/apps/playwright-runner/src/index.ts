import express from "express";
import { chromium, type Browser } from "playwright";
import { TimelineRecorder } from "@ai-video-guide/timeline-recorder";
import { applyPrivacyMask } from "@ai-video-guide/privacy-masker";
import { ActionType, type WorkflowDefinition } from "@ai-video-guide/shared-types";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { runWalkthrough, jobs, type WalkthroughRequest } from "./walkthrough.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = parseInt(process.env.PLAYWRIGHT_RUNNER_PORT ?? "3002", 10);
const API_URL = process.env.API_BASE_URL ?? "http://localhost:3001";
const STORAGE_BASE = process.env.STORAGE_BASE ?? path.resolve(__dirname, "../../storage");
const WORKERS = parseInt(process.env.PLAYWRIGHT_WORKERS ?? "1", 10);
const TIMEOUT = parseInt(process.env.PLAYWRIGHT_TIMEOUT ?? "120000", 10);

const app = express();
app.use(express.json());

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

// ── Workflow mode (existing project/step pipeline) ─────────────────────────

async function executeWorkflow(
  workflow: WorkflowDefinition,
  projectId: string
): Promise<{ success: boolean; screenshots: string[]; errors: string[] }> {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const recorder = new TimelineRecorder();
  const screenshots: string[] = [];
  const errors: string[] = [];
  recorder.start();
  const projectDir = path.join(STORAGE_BASE, "projects", projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  try {
    for (const step of workflow.steps) {
      recorder.beginSegment(step.orderIndex, step.description);
      recorder.record({ type: "action", stepIndex: step.orderIndex, description: step.description });
      try {
        await page.waitForLoadState("networkidle", { timeout: TIMEOUT });
        switch (step.actionType) {
          case ActionType.NAVIGATE:
            await page.goto(step.value ?? workflow.targetUrl, { timeout: TIMEOUT });
            break;
          case ActionType.CLICK:
            if (step.selector) await page.locator(step.selector).click({ timeout: 10000 });
            break;
          case ActionType.FILL:
            if (step.selector && step.value) await page.locator(step.selector).fill(step.value, { timeout: 10000 });
            break;
          case ActionType.HOVER:
            if (step.selector) await page.locator(step.selector).hover({ timeout: 10000 });
            break;
          case ActionType.SCROLL:
            await page.evaluate(() => window.scrollBy(0, 300));
            break;
          case ActionType.WAIT:
            await page.waitForTimeout(step.delayMs ?? 1000);
            break;
          case ActionType.SCREENSHOT:
            break;
        }
        if (step.actionType !== ActionType.NAVIGATE) await page.waitForLoadState("load");
        const shotPath = path.join(projectDir, `step-${step.orderIndex}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        if (process.env.ENABLE_PRIVACY_BLUR === "true") {
          const maskedPath = path.join(projectDir, `step-${step.orderIndex}-masked.png`);
          try { await applyPrivacyMask(shotPath, maskedPath, []); screenshots.push(maskedPath); }
          catch { screenshots.push(shotPath); }
        } else screenshots.push(shotPath);
        if (step.delayMs && step.delayMs > 0) await page.waitForTimeout(step.delayMs);
      } catch (err) {
        errors.push(`Step ${step.orderIndex} (${step.actionType}): ${String(err)}`);
      }
    }
    fs.writeFileSync(path.join(projectDir, "timeline.json"), JSON.stringify(recorder.finalize(), null, 2));
  } finally {
    await ctx.close();
  }
  return { success: errors.length === 0, screenshots, errors };
}

app.post("/run", async (req, res) => {
  const { projectId, workflow } = req.body as { projectId: string; workflow: WorkflowDefinition };
  if (!projectId || !workflow) return res.status(400).json({ error: "projectId and workflow required" });
  try {
    const result = await executeWorkflow(workflow, projectId);
    try {
      await axios.post(`${API_URL}/trpc/project.update?input=${encodeURIComponent(JSON.stringify({ id: projectId, status: "recording" }))}`);
    } catch { /* non-fatal */ }
    res.json({ success: result.success, screenshots: result.screenshots, errors: result.errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Live Walkthrough routes ─────────────────────────────────────────────────

app.post("/walkthrough", async (req, res) => {
  const body = req.body as WalkthroughRequest;
  if (!body.jobId || !body.targetUrl) {
    return res.status(400).json({ error: "jobId and targetUrl required" });
  }
  jobs.set(body.jobId, {
    id: body.jobId,
    status: "queued",
    progress: 0,
    message: "Queued",
    steps: [],
    startedAt: new Date().toISOString(),
  });

  // Respond immediately and run async
  res.json({ jobId: body.jobId, status: "queued" });

  try {
    const b = await getBrowser();
    await runWalkthrough(b, body);
  } catch (err) {
    console.error("[walkthrough] runner error:", err);
    const cur = jobs.get(body.jobId);
    if (cur) jobs.set(body.jobId, { ...cur, status: "failed", error: String(err) });
  }
});

app.get("/walkthrough/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "job not found" });
  res.json(job);
});

app.get("/walkthrough/file/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.videoPath) return res.status(404).json({ error: "video not ready" });
  res.sendFile(job.videoPath);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", workers: WORKERS, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[playwright-runner] listening on http://localhost:${PORT}`);
  console.log(`[playwright-runner] workers: ${WORKERS}, timeout: ${TIMEOUT}ms`);
});
