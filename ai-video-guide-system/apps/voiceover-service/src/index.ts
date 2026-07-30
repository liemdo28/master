// src/index.ts — voiceover-service Express API (port 3010)
// Section 19 — REST API for voiceover jobs, voices, pronunciations, QA.
import express from "express";
import { v4 as uuid } from "uuid";
import { VOICEOVER_PORT, VOICEOVER_STORAGE } from "./config.js";
import {
  createJob, getJob, listJobs, updateJob, upsertVoiceProfile,
  listVoiceProfiles, deleteVoiceProfile, upsertPronunciation,
  listPronunciations, deletePronunciation, getSegmentsByJob,
  listAuditByJob, jobOutputsDir, jobReportsDir, jobSegmentsDir,
  getVoiceProfile,
} from "./db.js";
import { runJob } from "./job-runner.js";
import { ttsRouter } from "./services/tts-router.js";
import { normalizeText } from "@ai-video-guide/voiceover-core";
import type { VoiceoverJob, VoiceProfile, Pronunciation, Language } from "@ai-video-guide/voiceover-core";
import { generateReport, miSummary } from "./services/reporter.js";
import { exportSubtitles } from "./services/subtitle-exporter.js";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "50mb" }));

// ── Helpers ──────────────────────────────────────────────────────────────────
function ok(res: express.Response, data: unknown) { res.json(data); }
function err(res: express.Response, code: number, msg: string) { res.status(code).json({ error: msg }); }

// ── Health / Readiness ───────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "voiceover-service" });
});

app.get("/ready", async (_req, res) => {
  const engines = await Promise.all(
    ttsRouter.listEngines().map(async (e) => ({ id: e.id, health: await e.health }))
  );
  res.json({ ready: true, engines });
});

app.get("/metrics", (_req, res) => {
  const jobs = listJobs(1000);
  const active = jobs.filter((j) => !["completed", "failed", "cancelled"].includes(j.state));
  res.json({ totalJobs: jobs.length, activeJobs: active.length, timestamp: new Date().toISOString() });
});

// ════════════════════════════════════════════════════════════════════════════════
// VOICEOVER JOBS
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/voiceover/jobs — Create a new voiceover job
app.post("/api/voiceover/jobs", (req, res) => {
  const b = req.body as Partial<VoiceoverJob>;
  if (!b.projectName) return err(res, 400, "projectName required");
  const job: VoiceoverJob = {
    id: uuid(),
    projectName: b.projectName,
    sourceLanguage: (b.sourceLanguage as Language) ?? "en",
    outputLanguages: b.outputLanguages ?? ["en"],
    originalScript: b.originalScript ?? "",
    enScript: b.enScript ?? null,
    viScript: b.viScript ?? null,
    voiceProfileId: b.voiceProfileId ?? null,
    speakingSpeed: b.speakingSpeed ?? 1.0,
    emotion: b.emotion ?? null,
    pronunciationSetId: b.pronunciationSetId ?? null,
    outputFormat: b.outputFormat ?? "both",
    subtitleToggle: b.subtitleToggle ?? true,
    sourceVideoPath: b.sourceVideoPath ?? null,
    backgroundVolume: b.backgroundVolume ?? 0.3,
    voiceVolume: b.voiceVolume ?? 1.0,
    enTranslation: { machine: null, edited: null, approved: null },
    viTranslation: { machine: null, edited: null, approved: null },
    state: "draft",
    progressPercent: 0,
    currentStage: null,
    activeEngine: null,
    currentSegmentId: null,
    etaSeconds: null,
    errorMessage: null,
    qaScore: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Create project dirs
  for (const sub of ["source", "scripts", "reference-voices", "segments/en", "segments/vi",
    "subtitles", "previews", "outputs", "reports"]) {
    fs.mkdirSync(path.join(VOICEOVER_STORAGE, "projects", job.id, sub), { recursive: true });
  }

  createJob(job);
  ok(res, job);
});

// GET /api/voiceover/jobs — List all jobs
app.get("/api/voiceover/jobs", (req, res) => {
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  ok(res, listJobs(limit));
});

// GET /api/voiceover/jobs/:id — Get job by ID
app.get("/api/voiceover/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  ok(res, job);
});

// PUT /api/voiceover/jobs/:id — Update job fields (scripts, settings, state)
app.put("/api/voiceover/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  const updates = req.body as Partial<VoiceoverJob>;
  updateJob(req.params.id, updates);
  ok(res, getJob(req.params.id));
});

// POST /api/voiceover/jobs/:id/generate — Start generating narration
app.post("/api/voiceover/jobs/:id/generate", async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  if (!["draft", "awaiting_script_approval"].includes(job.state)) {
    return err(res, 409, `Cannot generate from state: ${job.state}`);
  }

  // Kick off job asynchronously
  runJob({
    jobId: job.id,
    onStateChange: (state) => { updateJob(job.id, { state: state as VoiceoverJob["state"] }); },
    onProgress: (percent, stage, segId) => {
      updateJob(job.id, { progressPercent: percent, currentStage: stage, currentSegmentId: segId ?? null });
    },
    onError: (e) => {
      updateJob(job.id, { state: "failed", errorMessage: e });
    },
  }).catch((e) => console.error("[job] unhandled error:", e));

  ok(res, { message: "Job started", jobId: job.id });
});

// POST /api/voiceover/jobs/:id/translate — Translate script
app.post("/api/voiceover/jobs/:id/translate", async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  const { translateToEnglish, translateToVietnamese } = await import("./services/translation-service.js");

  try {
    if (job.sourceLanguage === "vi" && !job.enScript) {
      const en = await translateToEnglish(job.originalScript);
      updateJob(job.id, { enScript: en, enTranslation: { machine: en, edited: null, approved: null } });
    }
    if (job.outputLanguages.includes("vi") && !job.viScript) {
      const enText = job.enScript ?? job.originalScript;
      const vi = await translateToVietnamese(enText);
      updateJob(job.id, { viScript: vi, viTranslation: { machine: vi, edited: null, approved: null } });
    }
    ok(res, getJob(job.id));
  } catch (e) {
    err(res, 500, String(e));
  }
});

// POST /api/voiceover/jobs/:id/normalize — Normalize script text
app.post("/api/voiceover/jobs/:id/normalize", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  const b = req.body as { script?: string; language?: Language };
  const lang: Language = b.language ?? job.sourceLanguage;
  const script = b.script ?? job.originalScript;
  const result = normalizeText(script, lang);
  ok(res, { original: script, normalized: result.normalized, changes: result.changes });
});

// POST /api/voiceover/jobs/:id/preview — Generate a 10-second preview segment
app.post("/api/voiceover/jobs/:id/preview", async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  const b = req.body as { text?: string; language?: Language };
  const lang: Language = b.language ?? job.sourceLanguage;
  const script = b.text ?? job.originalScript;
  const shortText = script.slice(0, 300); // ~10s preview
  const { ttsRouter } = await import("./services/tts-router.js");
  const { jobPreviewsDir } = await import("./db.js");
  const previewDir = jobPreviewsDir(job.id);
  fs.mkdirSync(previewDir, { recursive: true });
  const outPath = path.join(previewDir, `${job.id}-${lang}-preview`);
  try {
    const result = await ttsRouter.synthesize({ text: shortText, language: lang, outputPath: outPath, format: "mp3", voiceId: "default" }, job.id);
    ok(res, { previewFile: result.outputFile, durationSec: result.durationSec, text: shortText, language: lang });
  } catch (e) { err(res, 500, String(e)); }
});

// POST /api/voiceover/jobs/:id/retry — Retry a specific failed segment
app.post("/api/voiceover/jobs/:id/retry", async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  const b = req.body as { segmentId?: string };
  if (!b.segmentId) return err(res, 400, "segmentId required");
  // Re-trigger generation for this job (full job runner handles segment-level retry)
  runJob({ jobId: job.id, onStateChange: (s) => updateJob(job.id, { state: s as VoiceoverJob["state"] }), onProgress: (p, st) => updateJob(job.id, { progressPercent: p, currentStage: st }), onError: (e) => updateJob(job.id, { errorMessage: e }) }).catch(console.error);
  ok(res, { message: "Retry started", jobId: job.id });
});

// GET /api/voiceover/jobs/:id/segments — List segments for a job
app.get("/api/voiceover/jobs/:id/segments", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  ok(res, getSegmentsByJob(job.id));
});

// GET /api/voiceover/jobs/:id/outputs — List output files
app.get("/api/voiceover/jobs/:id/outputs", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  const outDir = jobOutputsDir(job.id);
  const files = fs.existsSync(outDir) ? fs.readdirSync(outDir) : [];
  ok(res, { jobId: job.id, outputs: files.map((f) => path.join(outDir, f)) });
});

// POST /api/voiceover/jobs/:id/approve — Admin approves a job
app.post("/api/voiceover/jobs/:id/approve", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  updateJob(req.params.id, { state: "approved" });
  ok(res, getJob(req.params.id));
});

// POST /api/voiceover/jobs/:id/cancel — Cancel a job
app.post("/api/voiceover/jobs/:id/cancel", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return err(res, 404, "Job not found");
  updateJob(req.params.id, { state: "cancelled" });
  ok(res, { message: "Job cancelled" });
});

// GET /api/voiceover/jobs/:id/report — Get QA report
app.get("/api/voiceover/jobs/:id/report", (req, res) => {
  try { ok(res, generateReport(req.params.id)); } catch (e) { err(res, 500, String(e)); }
});

// GET /api/voiceover/jobs/:id/audit — Get audit trail
app.get("/api/voiceover/jobs/:id/audit", (req, res) => {
  ok(res, listAuditByJob(req.params.id));
});

// ════════════════════════════════════════════════════════════════════════════════
// VOICE LIBRARY
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/voiceover/voices — List voice profiles
app.get("/api/voiceover/voices", (_req, res) => ok(res, listVoiceProfiles()));

// POST /api/voiceover/voices — Create or update voice profile
app.post("/api/voiceover/voices", (req, res) => {
  const b = req.body as Partial<VoiceProfile>;
  const vp: VoiceProfile = {
    id: b.id ?? uuid(), name: b.name ?? "Unnamed Voice",
    languages: b.languages ?? ["en"], gender: b.gender ?? null, style: b.style ?? null,
    engine: b.engine ?? "edge-tts", referenceAudio: b.referenceAudio ?? null,
    cloneStatus: b.cloneStatus ?? "none", defaultSpeed: b.defaultSpeed ?? 1.0,
    defaultEmotion: b.defaultEmotion ?? null, defaultPitch: b.defaultPitch ?? 0,
    defaultPauseStyle: b.defaultPauseStyle ?? null, approvedUsage: b.approvedUsage ?? true,
    consent: b.consent ?? { owner: "", consentStatus: "none", consentDate: null, allowedProjects: [], allowedLanguages: [], expiration: null, referenceFile: null },
    createdBy: b.createdBy ?? "admin", updatedAt: new Date().toISOString(),
  };
  upsertVoiceProfile(vp);
  ok(res, vp);
});

// DELETE /api/voiceover/voices/:id
app.delete("/api/voiceover/voices/:id", (req, res) => { deleteVoiceProfile(req.params.id); ok(res, { deleted: true }); });

// ════════════════════════════════════════════════════════════════════════════════
// PRONUNCIATION DICTIONARY
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/voiceover/pronunciations
app.get("/api/voiceover/pronunciations", (_req, res) => ok(res, listPronunciations()));

// POST /api/voiceover/pronunciations — Add/edit pronunciation
app.post("/api/voiceover/pronunciations", (req, res) => {
  const b = req.body as Partial<Pronunciation>;
  const p: Pronunciation = {
    id: b.id ?? uuid(), term: b.term ?? "", en: b.en ?? null, vi: b.vi ?? null,
    language: b.language ?? "both", active: b.active ?? true,
    projectOverride: b.projectOverride ?? null, createdAt: b.createdAt ?? new Date().toISOString(),
  };
  upsertPronunciation(p);
  ok(res, p);
});

// DELETE /api/voiceover/pronunciations/:id
app.delete("/api/voiceover/pronunciations/:id", (req, res) => { deletePronunciation(req.params.id); ok(res, { deleted: true }); });

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(VOICEOVER_PORT, () => {
  console.log(`[voiceover-service] listening on http://localhost:${VOICEOVER_PORT}`);
  console.log(`[voiceover-service] endpoints: /api/voiceover/jobs, /api/voiceover/voices, /api/voiceover/pronunciations`);
  console.log(`[voiceover-service] health: /health, ready: /ready, metrics: /metrics`);
});

