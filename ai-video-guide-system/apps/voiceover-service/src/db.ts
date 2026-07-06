// src/storage.ts
// JSON file-backed storage (no native dependencies).
// Same interface as db.ts but uses atomic JSON writes.
// Section 5 (storage structure) + Section 19 (APIs) + Section 21 (no duplicate model instances).
import fs from "fs";
import path from "path";
import { DB_PATH } from "./config.js";
import type { VoiceoverJob, Segment, VoiceProfile, Pronunciation, QACheck, AuditEvent } from "@ai-video-guide/voiceover-core";

// JSON DB stored in data/voiceover.json (not voiceover.db).
const DATA_FILE = DB_PATH.replace(/\.db$/, ".json");
export const VOICEOVER_DATA_FILE = DATA_FILE;

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

interface DBState {
  jobs: VoiceoverJob[];
  segments: Segment[];
  voiceProfiles: VoiceProfile[];
  pronunciations: Pronunciation[];
  qaChecks: QACheck[];
  auditEvents: AuditEvent[];
}

const EMPTY: DBState = { jobs: [], segments: [], voiceProfiles: [], pronunciations: [], qaChecks: [], auditEvents: [] };

function load(): DBState {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { ...EMPTY };
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

function save(state: DBState): void {
  ensureDataDir();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tmp, DATA_FILE);
}

function mutate<T>(fn: (s: DBState) => T): T {
  const s = load();
  const result = fn(s);
  save(s);
  return result;
}

// ── Jobs ────────────────────────────────────────────────────────────────────
export function createJob(job: VoiceoverJob): void {
  mutate((s) => { s.jobs.push(job); });
}
export function getJob(id: string): VoiceoverJob | null {
  return load().jobs.find((j) => j.id === id) ?? null;
}
export function listJobs(limit = 50): VoiceoverJob[] {
  return load().jobs.slice(-limit).reverse();
}
export function updateJob(id: string, updates: Partial<VoiceoverJob>): void {
  mutate((s) => {
    const idx = s.jobs.findIndex((j) => j.id === id);
    if (idx >= 0) {
      s.jobs[idx] = { ...s.jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    }
  });
}

// ── Segments ─────────────────────────────────────────────────────────────────
export function upsertSegment(seg: Segment): void {
  mutate((s) => {
    const idx = s.segments.findIndex((x) => x.segmentId === seg.segmentId);
    if (idx >= 0) s.segments[idx] = seg;
    else s.segments.push(seg);
  });
}
export function getSegmentsByJob(jobId: string): Segment[] {
  return load().segments.filter((s) => s.jobId === jobId).sort((a, b) => a.index - b.index);
}
export function getSegment(id: string): Segment | null {
  return load().segments.find((s) => s.segmentId === id) ?? null;
}
export function updateSegment(id: string, updates: Partial<Segment>): void {
  mutate((s) => {
    const idx = s.segments.findIndex((x) => x.segmentId === id);
    if (idx >= 0) s.segments[idx] = { ...s.segments[idx], ...updates, updatedAt: new Date().toISOString() };
  });
}

// ── Voice Profiles ──────────────────────────────────────────────────────────
export function upsertVoiceProfile(vp: VoiceProfile): void {
  mutate((s) => {
    const idx = s.voiceProfiles.findIndex((x) => x.id === vp.id);
    if (idx >= 0) s.voiceProfiles[idx] = vp;
    else s.voiceProfiles.push(vp);
  });
}
export function listVoiceProfiles(): VoiceProfile[] {
  return load().voiceProfiles;
}
export function getVoiceProfile(id: string): VoiceProfile | null {
  return load().voiceProfiles.find((v) => v.id === id) ?? null;
}
export function deleteVoiceProfile(id: string): void {
  mutate((s) => { s.voiceProfiles = s.voiceProfiles.filter((v) => v.id !== id); });
}

// ── Pronunciation Dictionary ────────────────────────────────────────────────
export function upsertPronunciation(p: Pronunciation): void {
  mutate((s) => {
    const idx = s.pronunciations.findIndex((x) => x.term.toLowerCase() === p.term.toLowerCase());
    if (idx >= 0) s.pronunciations[idx] = p;
    else s.pronunciations.push(p);
  });
}
export function listPronunciations(): Pronunciation[] {
  return load().pronunciations.filter((p) => p.active);
}
export function deletePronunciation(id: string): void {
  mutate((s) => { s.pronunciations = s.pronunciations.filter((p) => p.id !== id); });
}

// ── QA Checks ──────────────────────────────────────────────────────────────
export function insertQACheck(qa: QACheck): void {
  mutate((s) => {
    // Omit the id field, which the Zod QA schema doesn't define
    const { id: _ignored, ...rest } = qa as unknown as QACheck & { id?: string };
    s.qaChecks.push({ ...rest, id: qa.id } as QACheck);
  });
}
export function listQAChecksByJob(jobId: string): QACheck[] {
  const segIds = new Set(load().segments.filter((s) => s.jobId === jobId).map((s) => s.segmentId));
  return load().qaChecks.filter((q) => segIds.has(q.segmentId)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ── Audit Log ──────────────────────────────────────────────────────────────
export function insertAudit(event: AuditEvent): void {
  mutate((s) => { s.auditEvents.push(event); });
}
export function listAuditByJob(jobId: string): AuditEvent[] {
  return load().auditEvents.filter((a) => a.jobId === jobId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ── Storage paths ──────────────────────────────────────────────────────────
import { VOICEOVER_STORAGE } from "./config.js";
export function jobSegmentsDir(jobId: string): string {
  return path.join(VOICEOVER_STORAGE, "projects", jobId, "segments");
}
export function jobOutputsDir(jobId: string): string {
  return path.join(VOICEOVER_STORAGE, "projects", jobId, "outputs");
}
export function jobSubtitlesDir(jobId: string): string {
  return path.join(VOICEOVER_STORAGE, "projects", jobId, "subtitles");
}
export function jobReportsDir(jobId: string): string {
  return path.join(VOICEOVER_STORAGE, "projects", jobId, "reports");
}
export function jobPreviewsDir(jobId: string): string {
  return path.join(VOICEOVER_STORAGE, "projects", jobId, "previews");
}
