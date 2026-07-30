// src/job-runner.ts
// Core sequential job runner. Processes voiceover jobs through the state machine.
// Section 12, 13, 14 — segment generation, QA loop, fallback, Mi integration.
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";
import { normalizeText } from "@ai-video-guide/voiceover-core";
import type { Language, Segment } from "@ai-video-guide/voiceover-core";
import { segmentScript } from "@ai-video-guide/voiceover-core";
import {
  getJob, updateJob, getSegmentsByJob, upsertSegment, updateSegment,
  insertAudit, jobSegmentsDir, jobOutputsDir, jobPreviewsDir,
} from "./db.js";
import { ttsRouter } from "./services/tts-router.js";
import { applyPronunciations } from "./services/pronunciation-service.js";
import { runSegmentQA } from "./services/audio-qa-service.js";
import { concatAudio, convertAudio } from "./services/video-mixer.js";
import { exportSubtitles, embedSubtitles } from "./services/subtitle-exporter.js";
import { generateReport, miSummary } from "./services/reporter.js";
import { translateToEnglish, translateToVietnamese } from "./services/translation-service.js";
import { MAX_RETRIES, QA_THRESHOLD, STORAGE_BASE } from "./config.js";

export interface JobContext {
  jobId: string;
  onStateChange: (state: string) => void;
  onProgress: (percent: number, stage: string, segmentId?: string) => void;
  onError: (err: string) => void;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Main entry point: run a voiceover job to completion (or human review). */
export async function runJob(ctx: JobContext): Promise<void> {
  const { jobId, onStateChange, onProgress, onError } = ctx;
  const job = getJob(jobId);
  if (!job) { onError("Job not found"); return; }

  const langs: Language[] = job.outputLanguages.includes("vi") ? ["en", "vi"] : ["en"];

  try {
    // ── Phase 1: Script processing ──────────────────────────────────────────
    setState(jobId, "script_processing");
    onStateChange("script_processing");
    onProgress(5, "Processing scripts...");

    let enScript = job.enScript ?? job.originalScript;
    let viScript = job.viScript ?? "";

    // If source is VI AND EN is in output set → translate to EN
    if (job.sourceLanguage === "vi" && job.outputLanguages.includes("en")) {
   
      onProgress(10, "Translating to English...");
      enScript = await translateToEnglish(job.originalScript);
      insertAudit({ id: uuid(), jobId, segmentId: null, event: "translate", detail: "VI→EN", engine: null, timestamp: new Date().toISOString() });
      updateJob(jobId, { enScript, enTranslation: { machine: enScript, edited: null, approved: null } });
    }

    // If VI is requested, source is EN, and no VI script yet → translate EN → VI
    if (job.outputLanguages.includes("vi") && job.sourceLanguage === "en" && !viScript) {
      onProgress(15, "Translating to Vietnamese...");
      viScript = await translateToVietnamese(enScript);
      insertAudit({ id: uuid(), jobId, segmentId: null, event: "translate", detail: "EN→VI", engine: null, timestamp: new Date().toISOString() });
      updateJob(jobId, { viScript, viTranslation: { machine: viScript, edited: null, approved: null } });
    } else if (job.outputLanguages.includes("vi") && !viScript && job.sourceLanguage === "vi") {
      // Source is VI and VI is requested but no script — use the source as VI script
      viScript = job.originalScript;
      updateJob(jobId, { viScript });

      insertAudit({ id: uuid(), jobId, segmentId: null, event: "translate", detail: "EN→VI", engine: null, timestamp: new Date().toISOString() });
      updateJob(jobId, { viScript, viTranslation: { machine: viScript, edited: null, approved: null } });
    }

    onProgress(20, "Scripts ready — awaiting approval");

    // Scripts need approval before synthesis (Workflow B / Section 15)
    // In auto-mode (no admin review) we proceed; in manual-mode the state pauses at await_script_approval
    setState(jobId, "awaiting_script_approval");
    onStateChange("awaiting_script_approval");
    onProgress(25, "Scripts ready — awaiting approval");
    // TODO: hook to pause here for admin review; for now proceed automatically
    setState(jobId, "generating_en");
    onStateChange("generating_en");

    // ── Phase 2: Generate requested language narrations ─────────────────────
    if (job.outputLanguages.includes("en")) {
      await generateLanguage(ctx, jobId, "en", enScript, job.speakingSpeed);
    }
    if (job.outputLanguages.includes("vi")) {
      
      setState(jobId, "generating_vi");
      onStateChange("generating_vi");
      await generateLanguage(ctx, jobId, "vi", viScript, job.speakingSpeed);
    }

    // ── Phase 3: Audio QA ────────────────────────────────────────────────────
    setState(jobId, "audio_qa");
    onStateChange("audio_qa");
    onProgress(75, "Running audio QA...");
    const segments = getSegmentsByJob(jobId);
    const avgScore = segments.reduce((s, seg) => s + (seg.qualityScore ?? 0), 0) / (segments.length || 1);
    updateJob(jobId, { qaScore: avgScore });

    if (avgScore >= QA_THRESHOLD) {
      onProgress(85, "QA passed");
    } else {
      // Check for human-review segments
      const humanReviewSegs = segments.filter((s) => s.status === "human_review_required");
      if (humanReviewSegs.length > 0) {
        setState(jobId, "human_review_required");
        onStateChange("human_review_required");
        onProgress(85, "Human review required");
      }
    }

    // ── Phase 4: Video mixing ────────────────────────────────────────────────
    if (job.sourceVideoPath) {
      setState(jobId, "mixing_video");
      onStateChange("mixing_video");
      onProgress(90, "Mixing video...");
      await mixJobVideo(jobId, job.sourceVideoPath);
    }

    // ── Phase 5: Subtitle export ────────────────────────────────────────────
    onProgress(93, "Exporting subtitles...");
    const enSegs = segments.filter((s) => s.language === "en" && s.status === "qa_passed");
    const viSegs = segments.filter((s) => s.language === "vi" && s.status === "qa_passed");
    exportSubtitles(jobId, enSegs, viSegs);

    // ── Phase 6: Final QA + report ──────────────────────────────────────────
    onProgress(97, "Generating report...");
    const report = generateReport(jobId);
    console.log("[job-runner] Report:", miSummary(report));

    if (report.miWorkflowReady) {
      setState(jobId, "completed");
      onStateChange("completed");
      onProgress(100, "Completed");
    } else if (report.segments.humanReviewRequired > 0) {
      setState(jobId, "human_review_required");
      onStateChange("human_review_required");
    } else {
      setState(jobId, "failed");
      onError(`QA score ${Math.round(avgScore)}% below threshold ${QA_THRESHOLD}%`);
    }
  } catch (err) {
    console.error(`[job-runner] Job ${jobId} failed:`, err);
    setState(jobId, "failed");
    onError(String(err));
  }
}

/** Generate all segments for one language. */
async function generateLanguage(
  ctx: JobContext,
  jobId: string,
  lang: Language,
  script: string,
  speed: number
): Promise<void> {
  const { onProgress } = ctx;

  // 1. Normalize
  const normResult = normalizeText(script, lang);
  const normalized = normResult.normalized;

  // 2. Apply pronunciation dictionary
  const withPron = applyPronunciations(normalized, lang);

  // 3. Segment
  const segInputs = segmentScript(withPron, lang);
  const segDir = jobSegmentsDir(jobId);
  const langDir = path.join(segDir, lang);
  fs.mkdirSync(langDir, { recursive: true });

  const total = segInputs.length;
  const outDir = jobOutputsDir(jobId);
  const audioOut = path.join(outDir, `${jobId}-${lang}.mp3`);
  const audioOutWav = path.join(outDir, `${jobId}-${lang}.wav`);
  fs.mkdirSync(outDir, { recursive: true });

  let cumulativeOffset = 0;
  const allSegmentFiles: string[] = [];

  for (let i = 0; i < segInputs.length; i++) {
    const si = segInputs[i];
    const segId = `${jobId}-${lang}-${String(i).padStart(3, "0")}`;
    const outFile = path.join(langDir, `${segId}.mp3`);
    const basePath = path.join(langDir, `${segId}`);

    onProgress(25 + Math.round((i / total) * 40), `Generating ${lang} segment ${i + 1}/${total}`, segId);

    const seg: Segment = {
      segmentId: segId, jobId, language: lang, index: i,
      sourceText: si.sourceText, normalizedText: si.normalizedText,
      voiceId: null, engine: null, duration: null, outputFile: null,
      status: "generating", qualityScore: null, retryCount: 0,
      startOffset: cumulativeOffset,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    upsertSegment(seg);
    updateJob(jobId, { currentSegmentId: segId, activeEngine: null });

    let success = false;
    let attempt = 0;

    while (!success && attempt <= MAX_RETRIES) {
      attempt++;
      try {
        const result = await ttsRouter.synthesize({
          text: si.normalizedText,
          language: lang,
          outputPath: basePath,
          format: "mp3",
          voiceId: "default",
          speed,
        }, jobId);

        updateSegment(segId, { outputFile: result.outputFile, duration: result.durationSec, engine: result.engine });
        cumulativeOffset += result.durationSec;

        // QA check
        const qa = await runSegmentQA(segId, result.outputFile, si.sourceText, lang, result.engine, attempt);
        updateSegment(segId, { status: qa.passed ? "qa_passed" : "qa_failed", qualityScore: qa.similarity });
        if (qa.passed) {
          allSegmentFiles.push(result.outputFile);
          success = true;
        } else {
          insertAudit({ id: uuid(), jobId, segmentId: segId, event: "qa_failed", detail: qa.notes, engine: result.engine, timestamp: new Date().toISOString() });
          if (attempt > MAX_RETRIES) {
            updateSegment(segId, { status: "human_review_required" });
          }
        }
      } catch (err) {
        insertAudit({ id: uuid(), jobId, segmentId: segId, event: "synthesis_error", detail: String(err), engine: null, timestamp: new Date().toISOString() });
        if (attempt > MAX_RETRIES) {
          updateSegment(segId, { status: "failed" });
          break;
        }
      }
    }
  }

  // Concatenate all QA-passed segments
  if (allSegmentFiles.length > 0) {
    concatAudio(allSegmentFiles, audioOut);
    convertAudio(audioOut, audioOutWav);
  }
}

async function mixJobVideo(jobId: string, sourceVideoPath: string): Promise<void> {
  const { mixVideoWithNarration } = await import("./services/video-mixer.js");
  const segments = getSegmentsByJob(jobId);
  const enSegs = segments.filter((s) => s.language === "en" && s.outputFile);
  if (!enSegs.length) return;

  const outDir = jobOutputsDir(jobId);
  const mixedAudio = path.join(outDir, `${jobId}-en-mixed.mp3`);
  const { concatAudio } = await import("./services/video-mixer.js");
  concatAudio(enSegs.map((s) => s.outputFile!), mixedAudio);

  const enVideo = path.join(outDir, `${jobId}-en.mp4`);
  mixVideoWithNarration(jobId, mixedAudio, sourceVideoPath, {});
  const viVideo = path.join(outDir, `${jobId}-vi.mp4`);
  // VI video: use same audio if VI segments exist
  const viSegs = segments.filter((s) => s.language === "vi" && s.outputFile);
  if (viSegs.length > 0) {
    const viMixed = path.join(outDir, `${jobId}-vi-mixed.mp3`);
    concatAudio(viSegs.map((s) => s.outputFile!), viMixed);
    mixVideoWithNarration(jobId, viMixed, sourceVideoPath, {});
  }
}

function setState(jobId: string, state: string): void {
  updateJob(jobId, { state: state as Parameters<typeof updateJob>[1]["state"] });
}
