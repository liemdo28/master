// src/services/reporter.ts
// Section 9, 14, 26 — QA reports and Mi workflow reporting.
import fs from "fs";
import path from "path";
import { jobReportsDir, listQAChecksByJob, listAuditByJob, getJob, getSegmentsByJob } from "../db.js";
import { QA_THRESHOLD } from "../config.js";

export interface VoiceoverReport {
  jobId: string;
  projectName: string;
  state: string;
  qaScore: number | null;
  qaPassed: boolean;
  threshold: number;
  segments: {
    total: number;
    passed: number;
    failed: number;
    humanReviewRequired: number;
  };
  languages: {
    en: { segments: number; passed: number; failed: number };
    vi: { segments: number; passed: number; failed: number };
  };
  engines: Record<string, number>;
  qaChecks: Array<{
    segmentId: string;
    language: string;
    passed: boolean;
    similarity: number;
    notes: string;
    engine: string;
    attempt: number;
  }>;
  auditTrail: Array<{ event: string; detail: string | null; engine: string | null; timestamp: string }>;
  recommendations: string[];
  miWorkflowReady: boolean;
  generatedAt: string;
}

export function generateReport(jobId: string): VoiceoverReport {
  const job = getJob(jobId);
  const segments = getSegmentsByJob(jobId);
  const qaChecks = listQAChecksByJob(jobId);
  const audit = listAuditByJob(jobId);

  const enSegs = segments.filter((s) => s.language === "en");
  const viSegs = segments.filter((s) => s.language === "vi");
  const passed = segments.filter((s) => s.status === "qa_passed");
  const failed = segments.filter((s) => ["qa_failed", "failed"].includes(s.status));
  const humanReview = segments.filter((s) => s.status === "human_review_required");

  const engineCounts: Record<string, number> = {};
  for (const seg of segments) {
    if (seg.engine) engineCounts[seg.engine] = (engineCounts[seg.engine] ?? 0) + 1;
  }
  const avgScore = segments.length
    ? segments.reduce((sum, s) => sum + (s.qualityScore ?? 0), 0) / segments.length : null;

  const recommendations: string[] = [];
  if ((avgScore ?? 0) < QA_THRESHOLD) recommendations.push(`QA score ${Math.round(avgScore ?? 0)}% below threshold ${QA_THRESHOLD}%.`);
  if (humanReview.length > 0) recommendations.push(`${humanReview.length} segment(s) require human review.`);
  if (failed.length > 0) recommendations.push(`${failed.length} segment(s) failed QA.`);
  if (engineCounts["edge-tts"] === segments.length && segments.length > 5) recommendations.push("Consider Fish Speech GPU for better quality.");

  const report: VoiceoverReport = {
    jobId, projectName: job?.projectName ?? "", state: job?.state ?? "unknown",
    qaScore: avgScore, qaPassed: (avgScore ?? 0) >= QA_THRESHOLD, threshold: QA_THRESHOLD,
    segments: { total: segments.length, passed: passed.length, failed: failed.length, humanReviewRequired: humanReview.length },
    languages: {
      en: { segments: enSegs.length, passed: enSegs.filter((s) => s.status === "qa_passed").length, failed: enSegs.filter((s) => ["qa_failed", "failed"].includes(s.status)).length },
      vi: { segments: viSegs.length, passed: viSegs.filter((s) => s.status === "qa_passed").length, failed: viSegs.filter((s) => ["qa_failed", "failed"].includes(s.status)).length },
    },
    engines: engineCounts,
    qaChecks: qaChecks.map((q) => ({ segmentId: q.segmentId, language: q.language, passed: q.passed, similarity: q.similarityPercent, notes: q.notes ?? "", engine: q.engineUsed, attempt: q.attempt })),
    auditTrail: audit.map((a) => ({ event: a.event, detail: a.detail, engine: a.engine, timestamp: a.timestamp })),
    recommendations,
    miWorkflowReady: (avgScore ?? 0) >= QA_THRESHOLD && failed.length === 0 && humanReview.length === 0,
    generatedAt: new Date().toISOString(),
  };

  const dir = jobReportsDir(jobId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${jobId}-qa-report.json`), JSON.stringify(report, null, 2), "utf-8");
  return report;
}

/** Format a compact report for Mi/CEO notification. */
export function miSummary(report: VoiceoverReport): string {
  return [
    `Voiceover Report — ${report.projectName}`,
    `Job: ${report.jobId}`,
    `State: ${report.state}`,
    `QA Score: ${report.qaScore != null ? Math.round(report.qaScore) + "%" : "N/A"} (${report.qaPassed ? "PASS" : "FAIL"})`,
    `Segments: ${report.segments.passed}/${report.segments.total} passed, ${report.segments.failed} failed, ${report.segments.humanReviewRequired} human review`,
    `EN: ${report.languages.en.passed}/${report.languages.en.segments} | VI: ${report.languages.vi.passed}/${report.languages.vi.segments}`,
    `Engines used: ${Object.entries(report.engines).map(([k,v]) => `${k}(${v})`).join(", ")}`,
    `Recommendations: ${report.recommendations.length ? report.recommendations.join("; ") : "None"}`,
    `Mi Workflow Ready: ${report.miWorkflowReady ? "YES" : "NO"}`,
    `Generated: ${report.generatedAt}`,
  ].join("\n");
}
