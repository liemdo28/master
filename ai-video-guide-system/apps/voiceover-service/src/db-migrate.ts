// src/db-migrate.ts — run once to set up voiceover tables
import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const migrations = [
  `CREATE TABLE IF NOT EXISTS voiceover_jobs (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    source_language TEXT NOT NULL DEFAULT 'en',
    output_languages TEXT NOT NULL DEFAULT '["en"]',
    original_script TEXT NOT NULL DEFAULT '',
    en_script TEXT,
    vi_script TEXT,
    voice_profile_id TEXT,
    speaking_speed REAL DEFAULT 1.0,
    emotion TEXT,
    pronunciation_set_id TEXT,
    output_format TEXT DEFAULT 'both',
    subtitle_toggle INTEGER DEFAULT 1,
    source_video_path TEXT,
    background_volume REAL DEFAULT 0.3,
    voice_volume REAL DEFAULT 1.0,
    en_translation TEXT DEFAULT '{"machine":null,"edited":null,"approved":null}',
    vi_translation TEXT DEFAULT '{"machine":null,"edited":null,"approved":null}',
    state TEXT NOT NULL DEFAULT 'draft',
    progress_percent REAL DEFAULT 0,
    current_stage TEXT,
    active_engine TEXT,
    current_segment_id TEXT,
    eta_seconds REAL,
    error_message TEXT,
    qa_score REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS voiceover_segments (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    language TEXT NOT NULL,
    seg_index INTEGER NOT NULL,
    source_text TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    voice_id TEXT,
    engine TEXT,
    duration REAL,
    output_file TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    quality_score REAL,
    retry_count INTEGER DEFAULT 0,
    start_offset REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES voiceover_jobs(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS voice_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    languages TEXT NOT NULL DEFAULT '["en"]',
    gender TEXT,
    style TEXT,
    engine TEXT NOT NULL DEFAULT 'edge-tts',
    reference_audio TEXT,
    clone_status TEXT DEFAULT 'none',
    default_speed REAL DEFAULT 1.0,
    default_emotion TEXT,
    default_pitch REAL DEFAULT 0,
    default_pause_style TEXT,
    approved_usage INTEGER DEFAULT 1,
    consent TEXT DEFAULT '{"owner":"","consentStatus":"none","consentDate":null,"allowedProjects":[],"allowedLanguages":[],"expiration":null,"referenceFile":null}',
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS pronunciation_dict (
    id TEXT PRIMARY KEY,
    term TEXT NOT NULL UNIQUE,
    en_pronunciation TEXT,
    vi_pronunciation TEXT,
    language TEXT DEFAULT 'both',
    active INTEGER DEFAULT 1,
    project_override TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS qa_checks (
    id TEXT PRIMARY KEY,
    segment_id TEXT NOT NULL,
    language TEXT NOT NULL,
    passed INTEGER NOT NULL,
    similarity_percent REAL NOT NULL,
    checks TEXT NOT NULL,
    notes TEXT,
    engine_used TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (segment_id) REFERENCES voiceover_segments(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    segment_id TEXT,
    event TEXT NOT NULL,
    detail TEXT,
    engine TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_segments_job ON voiceover_segments(job_id)`,
  `CREATE INDEX IF NOT EXISTS idx_segments_status ON voiceover_segments(status)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_state ON voiceover_jobs(state)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_job ON audit_log(job_id)`,
  `CREATE INDEX IF NOT EXISTS idx_qa_segment ON qa_checks(segment_id)`,
];

for (const sql of migrations) db.exec(sql);

console.log(`[db-migrate] voiceover schema initialized at ${DB_PATH}`);
db.close();
