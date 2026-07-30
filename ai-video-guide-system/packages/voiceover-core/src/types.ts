// =============================================================================
// BILINGUAL VOICEOVER — CORE TYPES & SCHEMAS
// Shared between apps/voiceover-service, api-server and admin-dashboard.
// =============================================================================
import { z } from "zod";

// ── Languages ────────────────────────────────────────────────────────────────
export const SUPPORTED_LANGUAGES = ["en", "vi"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// ── Job state machine (see BILINGUAL_VOICE_ARCHITECTURE.md) ──────────────────
export const JOB_STATES = [
  "draft",
  "script_processing",
  "awaiting_script_approval",
  "generating_en",
  "generating_vi",
  "audio_qa",
  "mixing_video",
  "video_qa",
  "human_review_required",
  "approved",
  "failed",
  "cancelled",
  "completed",
] as const;
export type JobState = (typeof JOB_STATES)[number];

export const TERMINAL_STATES: JobState[] = [
  "completed",
  "failed",
  "cancelled",
  "approved",
];

// ── Engines ──────────────────────────────────────────────────────────────────
export const ENGINE_IDS = ["edge-tts", "fish-speech", "openvoice"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

// ── Segment status ───────────────────────────────────────────────────────────
export const SEGMENT_STATES = [
  "pending",
  "generating",
  "qa_passed",
  "qa_failed",
  "retrying",
  "human_review_required",
  "failed",
] as const;
export type SegmentState = (typeof SEGMENT_STATES)[number];

// ── QA thresholds ────────────────────────────────────────────────────────────
export const QA_PASS_THRESHOLD = 95; // percent similarity required
export const DEFAULT_MAX_RETRIES = 3;

// =============================================================================
// ZOD SCHEMAS
// =============================================================================
export const LanguageSchema = z.enum(SUPPORTED_LANGUAGES);

export const RoutingConfigSchema = z.object({
  english: z.object({
    primary: z.enum(ENGINE_IDS).default("edge-tts"),
    fallback: z.enum(ENGINE_IDS).default("edge-tts"),
  }),
  vietnamese: z.object({
    primary: z.enum(ENGINE_IDS).default("edge-tts"),
    fallback: z.enum(ENGINE_IDS).default("edge-tts"),
  }),
});
export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;

export const VoiceProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  languages: z.array(LanguageSchema),
  gender: z.string().nullable(),
  style: z.string().nullable(),
  engine: z.enum(ENGINE_IDS),
  referenceAudio: z.string().nullable(),
  cloneStatus: z.enum(["none", "pending", "approved", "denied", "expired"]).default("none"),
  defaultSpeed: z.number().default(1.0),
  defaultEmotion: z.string().nullable(),
  defaultPitch: z.number().default(0),
  defaultPauseStyle: z.string().nullable(),
  approvedUsage: z.boolean().default(true),
  // Voice cloning safety / consent (Section 10)
  consent: z
    .object({
      owner: z.string(),
      consentStatus: z.enum(["none", "pending", "granted", "revoked", "expired"]).default("none"),
      consentDate: z.string().nullable(),
      allowedProjects: z.array(z.string()).default([]),
      allowedLanguages: z.array(LanguageSchema).default([]),
      expiration: z.string().nullable(),
      referenceFile: z.string().nullable(),
    })
    .default({ owner: "", consentStatus: "none", consentDate: null, allowedProjects: [], allowedLanguages: [], expiration: null, referenceFile: null }),
  createdBy: z.string(),
  updatedAt: z.string(),
});
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

export const PronunciationSchema = z.object({
  id: z.string(),
  term: z.string(),
  en: z.string().nullable(),
  vi: z.string().nullable(),
  language: z.enum(["en", "vi", "both"]).default("both"),
  active: z.boolean().default(true),
  projectOverride: z.string().nullable(),
  createdAt: z.string(),
});
export type Pronunciation = z.infer<typeof PronunciationSchema>;

export const SegmentSchema = z.object({
  segmentId: z.string(),
  jobId: z.string(),
  language: LanguageSchema,
  index: z.number(),
  sourceText: z.string(),
  normalizedText: z.string(),
  voiceId: z.string().nullable(),
  engine: z.enum(ENGINE_IDS).nullable(),
  duration: z.number().nullable(),
  outputFile: z.string().nullable(),
  status: z.enum(SEGMENT_STATES),
  qualityScore: z.number().nullable(),
  retryCount: z.number().default(0),
  startOffset: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const VoiceoverJobSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  sourceLanguage: LanguageSchema,
  outputLanguages: z.array(LanguageSchema),
  originalScript: z.string(),
  enScript: z.string().nullable(),
  viScript: z.string().nullable(),
  voiceProfileId: z.string().nullable(),
  speakingSpeed: z.number().default(1.0),
  emotion: z.string().nullable(),
  pronunciationSetId: z.string().nullable(),
  outputFormat: z.enum(["wav", "mp3", "both"]).default("both"),
  subtitleToggle: z.boolean().default(true),
  // Video inputs (Workflow C)
  sourceVideoPath: z.string().nullable(),
  backgroundVolume: z.number().default(0.3),
  voiceVolume: z.number().default(1.0),
  // Translation provenance (Section 15)
  enTranslation: z
    .object({
      machine: z.string().nullable(),
      edited: z.string().nullable(),
      approved: z.string().nullable(),
    })
    .default({ machine: null, edited: null, approved: null }),
  viTranslation: z
    .object({
      machine: z.string().nullable(),
      edited: z.string().nullable(),
      approved: z.string().nullable(),
    })
    .default({ machine: null, edited: null, approved: null }),
  // Runtime / progress
  state: z.enum(JOB_STATES).default("draft"),
  progressPercent: z.number().default(0),
  currentStage: z.string().nullable(),
  activeEngine: z.enum(ENGINE_IDS).nullable(),
  currentSegmentId: z.string().nullable(),
  etaSeconds: z.number().nullable(),
  errorMessage: z.string().nullable(),
  qaScore: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VoiceoverJob = z.infer<typeof VoiceoverJobSchema>;

export const QACheckSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  language: LanguageSchema,
  passed: z.boolean(),
  similarityPercent: z.number(),
  checks: z.record(z.string(), z.boolean()),
  notes: z.string().nullable(),
  engineUsed: z.enum(ENGINE_IDS),
  attempt: z.number(),
  timestamp: z.string(),
});
export type QACheck = z.infer<typeof QACheckSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  segmentId: z.string().nullable(),
  event: z.string(),
  detail: z.string().nullable(),
  engine: z.enum(ENGINE_IDS).nullable(),
  timestamp: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
