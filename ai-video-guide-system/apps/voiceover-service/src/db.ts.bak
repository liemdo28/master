// src/db.ts — database access layer
import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";
import type { VoiceoverJob, Segment, VoiceProfile, Pronunciation, QACheck, AuditEvent } from "@ai-video-guide/voiceover-core";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

export function closeDb(): void {
  if (_db) { _db.close(); _db = null; }
}

// ── Jobs ───────────────────────────────────────────────────────────────────
export function createJob(job: VoiceoverJob): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO voiceover_jobs (id, project_name, source_language, output_languages,
      original_script, en_script, vi_script, voice_profile_id, speaking_speed, emotion,
      pronunciation_set_id, output_format, subtitle_toggle, source_video_path,
      background_volume, voice_volume, en_translation, vi_translation,
      state, progress_percent, current_stage, active_engine, current_segment_id,
      eta_seconds, error_message, qa_score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id, job.projectName, job.sourceLanguage, JSON.stringify(job.outputLanguages),
    job.originalScript, job.enScript, job.viScript, job.voiceProfileId,
    job.speakingSpeed, job.emotion, job.pronunciationSetId, job.outputFormat,
    job.subtitleToggle ? 1 : 0, job.sourceVideoPath, job.backgroundVolume,
    job.voiceVolume, JSON.stringify(job.enTranslation), JSON.stringify(job.viTranslation),
    job.state, job.progressPercent, job.currentStage, job.activeEngine,
    job.currentSegmentId, job.etaSeconds, job.errorMessage, job.qaScore,
    job.createdAt, job.updatedAt
  );
}

export function getJob(id: string): VoiceoverJob | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM voiceover_jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToJob(row);
}

export function listJobs(limit = 50): VoiceoverJob[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM voiceover_jobs ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[];
  return rows.map(rowToJob);
}

export function updateJob(id: string, updates: Partial<VoiceoverJob>): void {
  const db = getDb();
  const fields = Object.entries(updates)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${snakeCase(k)} = ?`);
  const vals = Object.entries(updates).filter(([, v]) => v !== undefined).map(([, v]) => {
    if (Array.isArray(v) || typeof v === "object") return JSON.stringify(v);
    return v;
  });
  if (!fields.length) return;
  db.prepare(`UPDATE voiceover_jobs SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
}

function rowToJob(r: Record<string, unknown>): VoiceoverJob {
  return {
    id: String(r.id),
    projectName: String(r.project_name),
    sourceLanguage: String(r.source_language) as VoiceoverJob["sourceLanguage"],
    outputLanguages: JSON.parse(String(r.output_languages)),
    originalScript: String(r.original_script ?? ""),
    enScript: r.en_script ? String(r.en_script) : null,
    viScript: r.vi_script ? String(r.vi_script) : null,
    voiceProfileId: r.voice_profile_id ? String(r.voice_profile_id) : null,
    speakingSpeed: Number(r.speaking_speed ?? 1),
    emotion: r.emotion ? String(r.emotion) : null,
    pronunciationSetId: r.pronunciation_set_id ? String(r.pronunciation_set_id) : null,
    outputFormat: String(r.output_format ?? "both") as VoiceoverJob["outputFormat"],
    subtitleToggle: Boolean(r.subtitle_toggle),
    sourceVideoPath: r.source_video_path ? String(r.source_video_path) : null,
    backgroundVolume: Number(r.background_volume ?? 0.3),
    voiceVolume: Number(r.voice_volume ?? 1),
    enTranslation: JSON.parse(String(r.en_translation)),
    viTranslation: JSON.parse(String(r.vi_translation)),
    state: String(r.state) as VoiceoverJob["state"],
    progressPercent: Number(r.progress_percent ?? 0),
    currentStage: r.current_stage ? String(r.current_stage) : null,
    activeEngine: r.active_engine ? String(r.active_engine) as VoiceoverJob["activeEngine"] : null,
    currentSegmentId: r.current_segment_id ? String(r.current_segment_id) : null,
    etaSeconds: r.eta_seconds ? Number(r.eta_seconds) : null,
    errorMessage: r.error_message ? String(r.error_message) : null,
    qaScore: r.qa_score ? Number(r.qa_score) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ── Segments ────────────────────────────────────────────────────────────────
export function upsertSegment(seg: Segment): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO voiceover_segments (id, job_id, language, seg_index, source_text,
      normalized_text, voice_id, engine, duration, output_file, status,
      quality_score, retry_count, start_offset, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      normalized_text = excluded.normalized_text,
      voice_id = excluded.voice_id,
      engine = excluded.engine,
      duration = excluded.duration,
      output_file = excluded.output_file,
      status = excluded.status,
      quality_score = excluded.quality_score,
      retry_count = excluded.retry_count,
      start_offset = excluded.start_offset,
      updated_at = datetime('now')
  `).run(
    seg.segmentId, seg.jobId, seg.language, seg.index, seg.sourceText,
    seg.normalizedText, seg.voiceId, seg.engine, seg.duration,
    seg.outputFile, seg.status, seg.qualityScore, seg.retryCount,
    seg.startOffset, seg.createdAt, seg.updatedAt
  );
}

export function getSegmentsByJob(jobId: string): Segment[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM voiceover_segments WHERE job_id = ? ORDER BY seg_index").all(jobId) as Record<string, unknown>[];
  return rows.map(rowToSegment);
}

export function getSegment(id: string): Segment | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM voiceover_segments WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToSegment(row) : null;
}

export function updateSegment(id: string, updates: Partial<Segment>): void {
  const db = getDb();
  const fields = Object.entries(updates)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${snakeCase(k)} = ?`);
  const vals = Object.entries(updates).filter(([, v]) => v !== undefined).map(([, v]) => v);
  if (!fields.length) return;
  db.prepare(`UPDATE voiceover_segments SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
}

function rowToSegment(r: Record<string, unknown>): Segment {
  return {
    segmentId: String(r.id),
    jobId: String(r.job_id),
    language: String(r.language) as Segment["language"],
    index: Number(r.seg_index),
    sourceText: String(r.source_text),
    normalizedText: String(r.normalized_text),
    voiceId: r.voice_id ? String(r.voice_id) : null,
    engine: r.engine ? String(r.engine) as Segment["engine"] : null,
    duration: r.duration ? Number(r.duration) : null,
    outputFile: r.output_file ? String(r.output_file) : null,
    status: String(r.status) as Segment["status"],
    qualityScore: r.quality_score ? Number(r.quality_score) : null,
    retryCount: Number(r.retry_count ?? 0),
    startOffset: r.start_offset ? Number(r.start_offset) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ── Voice Profiles ──────────────────────────────────────────────────────────
export function upsertVoiceProfile(vp: VoiceProfile): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO voice_profiles (id, name, languages, gender, style, engine,
      reference_audio, clone_status, default_speed, default_emotion, default_pitch,
      default_pause_style, approved_usage, consent, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, languages = excluded.languages, gender = excluded.gender,
      style = excluded.style, engine = excluded.engine, reference_audio = excluded.reference_audio,
      clone_status = excluded.clone_status, default_speed = excluded.default_speed,
      default_emotion = excluded.default_emotion, default_pitch = excluded.default_pitch,
      default_pause_style = excluded.default_pause_style, approved_usage = excluded.approved_usage,
      consent = excluded.consent, updated_at = datetime('now')
  `).run(
    vp.id, vp.name, JSON.stringify(vp.languages), vp.gender, vp.style, vp.engine,
    vp.referenceAudio, vp.cloneStatus, vp.defaultSpeed, vp.defaultEmotion, vp.defaultPitch,
    vp.defaultPauseStyle, vp.approvedUsage ? 1 : 0, JSON.stringify(vp.consent),
    vp.createdBy, vp.updatedAt
  );
}

export function listVoiceProfiles(): VoiceProfile[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM voice_profiles ORDER BY name").all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id), name: String(r.name),
    languages: JSON.parse(String(r.languages)),
    gender: r.gender ? String(r.gender) : null,
    style: r.style ? String(r.style) : null,
    engine: String(r.engine) as VoiceProfile["engine"],
    referenceAudio: r.reference_audio ? String(r.reference_audio) : null,
    cloneStatus: String(r.clone_status) as VoiceProfile["cloneStatus"],
    defaultSpeed: Number(r.default_speed ?? 1),
    defaultEmotion: r.default_emotion ? String(r.default_emotion) : null,
    defaultPitch: Number(r.default_pitch ?? 0),
    defaultPauseStyle: r.default_pause_style ? String(r.default_pause_style) : null,
    approvedUsage: Boolean(r.approved_usage),
    consent: JSON.parse(String(r.consent)),
    createdBy: String(r.created_by),
    updatedAt: String(r.updated_at),
  }));
}

export function getVoiceProfile(id: string): VoiceProfile | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM voice_profiles WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    id: String(r.id), name: String(r.name),
    languages: JSON.parse(String(r.languages)),
    gender: r.gender ? String(r.gender) : null,
    style: r.style ? String(r.style) : null,
    engine: String(r.engine) as VoiceProfile["engine"],
    referenceAudio: r.reference_audio ? String(r.reference_audio) : null,
    cloneStatus: String(r.clone_status) as VoiceProfile["cloneStatus"],
    defaultSpeed: Number(r.default_speed ?? 1),
    defaultEmotion: r.default_emotion ? String(r.default_emotion) : null,
    defaultPitch: Number(r.default_pitch ?? 0),
    defaultPauseStyle: r.default_pause_style ? String(r.default_pause_style) : null,
    approvedUsage: Boolean(r.approved_usage),
    consent: JSON.parse(String(r.consent)),
    createdBy: String(r.created_by),
    updatedAt: String(r.updated_at),
  };
}

export function deleteVoiceProfile(id: string): void {
  getDb().prepare("DELETE FROM voice_profiles WHERE id = ?").run(id);
}

// ── Pronunciation Dictionary ────────────────────────────────────────────────
export function upsertPronunciation(p: Pronunciation): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO pronunciation_dict (id, term, en_pronunciation, vi_pronunciation,
      language, active, project_override, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(term) DO UPDATE SET
      en_pronunciation = excluded.en_pronunciation,
      vi_pronunciation = excluded.vi_pronunciation,
      language = excluded.language,
      active = excluded.active,
      project_override = excluded.project_override
  `).run(p.id, p.term, p.en, p.vi, p.language, p.active ? 1 : 0, p.projectOverride, p.createdAt);
}

export function listPronunciations(): Pronunciation[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM pronunciation_dict WHERE active = 1 ORDER BY term").all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id), term: String(r.term),
    en: r.en_pronunciation ? String(r.en_pronunciation) : null,
    vi: r.vi_pronunciation ? String(r.vi_pronunciation) : null,
    language: String(r.language) as Pronunciation["language"],
    active: Boolean(r.active),
    projectOverride: r.project_override ? String(r.project_override) : null,
    createdAt: String(r.created_at),
  }));
}

export function deletePronunciation(id: string): void {
  getDb().prepare("DELETE FROM pronunciation_dict WHERE id = ?").run(id);
}

// ── QA Checks ──────────────────────────────────────────────────────────────
export function insertQACheck(qa: QACheck): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO qa_checks (id, segment_id, language, passed, similarity_percent,
      checks, notes, engine_used, attempt, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    qa.id, qa.segmentId, qa.language, qa.passed ? 1 : 0, qa.similarityPercent,
    JSON.stringify(qa.checks), qa.notes, qa.engineUsed, qa.attempt, qa.timestamp
  );
}

export function listQAChecksByJob(jobId: string): QACheck[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT q.* FROM qa_checks q
    JOIN voiceover_segments s ON q.segment_id = s.id
    WHERE s.job_id = ? ORDER BY q.timestamp DESC
  `).all(jobId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id), segmentId: String(r.segment_id),
    language: String(r.language) as QACheck["language"],
    passed: Boolean(r.passed), similarityPercent: Number(r.similarity_percent),
    checks: JSON.parse(String(r.checks)),
    notes: r.notes ? String(r.notes) : null,
    engineUsed: String(r.engine_used) as QACheck["engineUsed"],
    attempt: Number(r.attempt), timestamp: String(r.timestamp),
  }));
}

// ── Audit Log ─────────────────────────────────────────────────────────────
export function insertAudit(event: AuditEvent): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (id, job_id, segment_id, event, detail, engine, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(event.id, event.jobId, event.segmentId, event.event, event.detail, event.engine, event.timestamp);
}

export function listAuditByJob(jobId: string): AuditEvent[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM audit_log WHERE job_id = ? ORDER BY timestamp ASC").all(jobId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id), jobId: String(r.job_id),
    segmentId: r.segment_id ? String(r.segment_id) : null,
    event: String(r.event), detail: r.detail ? String(r.detail) : null,
    engine: r.engine ? String(r.engine) as AuditEvent["engine"] : null,
    timestamp: String(r.timestamp),
  }));
}

// ── Utility ────────────────────────────────────────────────────────────────
function snakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

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

import path from "path";
import { VOICEOVER_STORAGE } from "./config.js";
