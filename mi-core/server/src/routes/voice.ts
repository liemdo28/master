/**
 * Voice API Routes
 * POST /api/voice/transcribe   — transcribe audio file or URL
 * POST /api/voice/ask          — transcribe audio and ask Mi
 * GET  /api/voice/health       — check transcription service health
 * POST /api/voice/test         — inject test voice message
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { handleMiHumanAssistant } from '../communication/mi-human-assistant';
import { runPipeline } from '../pipeline/response-pipeline';
import { orchestrateVoiceOutput } from '../voice/voice-output-orchestrator';
import { generateDailySummary } from '../whatsapp/daily-summary';
import { isTTSAvailable, synthesizeSpeech, listVietnameseVoices } from '../voice/tts-service';
import { getVoiceEvidence, listVoiceEvidence } from '../voice/voice-evidence-store';
import { summarizeToExecutive, executiveToVoiceText, approvalToVoiceText, workflowToVoiceText } from '../voice/voice-personality';

export const voiceRouter = Router();

const UPLOAD_DIR = path.join(
  process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global',
  'voice', 'uploads'
);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/voice/health
voiceRouter.get('/health', async (_req: Request, res: Response) => {
  const { isTranscriptionAvailable } = await import('../voice/transcription-service');
  const { isTTSAvailable } = await import('../voice/tts-service');
  const available = await isTranscriptionAvailable();
  res.json({
    status: available ? 'ok' : 'degraded',
    transcription: { available, model: process.env.WHISPER_MODEL || 'medium', engine: 'faster-whisper' },
    tts: { available: isTTSAvailable() },
    language: process.env.WHISPER_LANG || 'vi',
  });
});

// POST /api/voice/transcribe — upload audio file and transcribe
voiceRouter.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  const file = req.file;
  const audio_url = req.body?.audio_url;

  if (!file && !audio_url) {
    return res.status(400).json({ error: 'Provide audio file (multipart) or audio_url in body' });
  }

  const { transcribeAudio } = await import('../voice/transcription-service');
  const { parseVietnameseIntent } = await import('../voice/vietnamese-intent-parser');

  const audioPath = file ? file.path : null;
  if (!audioPath && !audio_url) return res.status(400).json({ error: 'No audio path' });

  let result;
  if (audioPath) {
    result = await transcribeAudio(audioPath);
  } else {
    return res.status(501).json({ error: 'URL-based transcription not yet implemented — upload file instead' });
  }

  const intent = result.text ? parseVietnameseIntent(result.text) : null;

  res.json({
    ok: !result.error,
    transcript: result.text,
    language: result.language,
    confidence: result.confidence,
    duration_seconds: result.duration_seconds,
    model: result.model,
    intent,
    error: result.error,
  });
});

// POST /api/voice/ask — microphone audio → transcript → Mi answer
voiceRouter.post('/ask', upload.single('audio'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Provide audio file as multipart field "audio"' });
  }

  const { transcribeAudio } = await import('../voice/transcription-service');
  const { parseVietnameseIntent } = await import('../voice/vietnamese-intent-parser');

  const startedAt = Date.now();
  const tx = await transcribeAudio(file.path);
  const transcript = (tx.text || '').trim();
  const parsedIntent = transcript ? parseVietnameseIntent(transcript) : null;

  if (!transcript || tx.error) {
    return res.json({
      ok: false,
      transcript,
      language: tx.language,
      confidence: tx.confidence,
      duration_seconds: tx.duration_seconds,
      model: tx.model,
      intent: parsedIntent,
      error: tx.error || 'Không nghe rõ nội dung.',
      latency_ms: Date.now() - startedAt,
    });
  }

  const sender = req.body?.sender || process.env.CEO_WHATSAPP_NUMBER || '+84931773657';
  const humanResult = await handleMiHumanAssistant(transcript, sender);
  let reply = humanResult?.reply || '';
  let source = humanResult?.action_mode || 'mi-human-assistant';

  if (!humanResult?.handled) {
    const { processJarvisQuery } = await import('../jarvis/phase30-jarvis/jarvis-core');
    const jarvis = await processJarvisQuery({
      sender,
      raw_text: transcript,
      normalized: transcript,
      timestamp: new Date().toISOString(),
      session_id: 'voice',
    });
    if (jarvis.handled && jarvis.reply) {
      reply = jarvis.reply;
      source = `jarvis-phase-${jarvis.phase || 30}`;
    } else {
      const out = await runPipeline({
        message: transcript,
        mode: 'ceo',
        history: [],
        intent: parsedIntent?.intent || 'voice',
      });
      reply = out.reply;
      source = `pipeline:${out.model}`;
    }
  }

  res.json({
    ok: true,
    transcript,
    reply,
    source,
    language: tx.language,
    confidence: tx.confidence,
    duration_seconds: tx.duration_seconds,
    model: tx.model,
    intent: parsedIntent,
    latency_ms: Date.now() - startedAt,
  });
});

// POST /api/voice/test — test the voice pipeline with a sample audio (if available)
voiceRouter.post('/test', async (_req: Request, res: Response) => {
  const { isTranscriptionAvailable } = await import('../voice/transcription-service');
  const available = await isTranscriptionAvailable();
  res.json({
    ok: available,
    message: available
      ? 'Voice pipeline ready. Upload audio to POST /api/voice/ask'
      : 'faster-whisper not available. Run: pip install faster-whisper',
    pipeline: ['detect_voice', 'download_audio', 'save_to_minio', 'transcribe_vi', 'parse_intent', 'run_pipeline', 'reply'],
  });
});

// ── VieNeu-TTS Voice Output Routes ──────────────────────────────────────────

// GET /api/voice/output/health — TTS engine health
voiceRouter.get('/output/health', async (_req: Request, res: Response) => {
  const available = isTTSAvailable();
  const voices = available ? await listVietnameseVoices() : [];
  res.json({
    status: available ? 'ok' : 'degraded',
    tts: { available, engine: 'edge-tts', voices },
    default_voice: process.env.VIETTS_VOICE || 'vi-VN-HoaiMyNeural',
    default_rate: process.env.VIETTS_RATE || '+0%',
    script: 'scripts/vietts_synthesize.py',
  });
});

// GET /api/voice/output/voices — list available Vietnamese voices
voiceRouter.get('/output/voices', async (_req: Request, res: Response) => {
  const voices = await listVietnameseVoices();
  res.json({ ok: true, voices });
});

// POST /api/voice/output/speak — synthesize text to audio file
voiceRouter.post('/output/speak', async (req: Request, res: Response) => {
  const { text, voice, rate, workflow_id } = req.body as {
    text?: string;
    voice?: string;
    rate?: string;
    workflow_id?: string;
  };

  if (!text) {
    return res.status(400).json({ ok: false, error: 'Provide "text" in body' });
  }

  if (!isTTSAvailable()) {
    return res.status(503).json({ ok: false, error: 'TTS not available. Set VOICE_TTS_ENABLED=1 and ensure edge-tts is installed.' });
  }

  const result = await synthesizeSpeech(text, 'vi', { voice, rate, workflow_id });
  res.json({ ok: result.available, ...result });
});

// POST /api/voice/output/daily-brief — generate voice memo from daily summary
// CEO command: "Mi đọc báo cáo hôm nay cho anh."
voiceRouter.post('/output/daily-brief', async (req: Request, res: Response) => {
  const { recipient, recipient_name, is_ceo, voice, rate } = req.body as {
    recipient?: string;
    recipient_name?: string;
    is_ceo?: boolean;
    voice?: string;
    rate?: string;
  };

  const t0 = Date.now();

  // Generate the daily text summary
  const summary = await generateDailySummary();

  // Executive summarization — convert raw metrics to Top 3 priorities/risks/actions
  const executiveSummary = summarizeToExecutive(summary.text);
  const speechText = executiveToVoiceText(executiveSummary);

  const workflow_id = `daily-brief-${Date.now()}`;

  const result = await orchestrateVoiceOutput({
    text: speechText,
    text_report: summary.text,
    recipient,
    recipient_name,
    is_ceo,
    workflow_id,
    voice,
    rate,
  });

  res.json({
    ok: result.ok,
    workflow_id: result.workflow_id,
    duration_ms: Date.now() - t0,
    text_report: result.text_report,
    tts: result.tts,
    whatsapp_sent: result.whatsapp_sent,
    approval_status: result.approval_status,
    approval_id: result.approval_id,
    evidence: result.evidence ? {
      workflow_id: result.evidence.workflow_id,
      audio_path: result.evidence.audio_path,
      voice: result.evidence.voice,
      file_size_bytes: result.evidence.file_size_bytes,
      created_at: result.evidence.created_at,
    } : null,
    error: result.error,
  });
});

// POST /api/voice/output/send — orchestrate voice output to a recipient
voiceRouter.post('/output/send', async (req: Request, res: Response) => {
  const { text, text_report, recipient, recipient_name, is_ceo, workflow_id, voice, rate } = req.body as {
    text?: string;
    text_report?: string;
    recipient?: string;
    recipient_name?: string;
    is_ceo?: boolean;
    workflow_id?: string;
    voice?: string;
    rate?: string;
  };

  if (!text) {
    return res.status(400).json({ ok: false, error: 'Provide "text" in body' });
  }

  const result = await orchestrateVoiceOutput({
    text,
    text_report,
    recipient,
    recipient_name,
    is_ceo,
    workflow_id,
    voice,
    rate,
  });

  res.json({
    ok: result.ok,
    workflow_id: result.workflow_id,
    tts: result.tts,
    whatsapp_sent: result.whatsapp_sent,
    approval_status: result.approval_status,
    approval_id: result.approval_id,
    evidence: result.evidence ? {
      workflow_id: result.evidence.workflow_id,
      audio_path: result.evidence.audio_path,
      voice: result.evidence.voice,
      file_size_bytes: result.evidence.file_size_bytes,
      created_at: result.evidence.created_at,
    } : null,
    error: result.error,
  });
});

// GET /api/voice/output/evidence — list recent voice evidence records
voiceRouter.get('/output/evidence', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const records = listVoiceEvidence(limit);
  res.json({ ok: true, count: records.length, records });
});

// GET /api/voice/output/evidence/:workflow_id — get specific evidence record
voiceRouter.get('/output/evidence/:workflow_id', (req: Request, res: Response) => {
  const record = getVoiceEvidence(req.params.workflow_id);
  if (!record) {
    return res.status(404).json({ ok: false, error: 'Evidence not found' });
  }
  res.json({ ok: true, record });
});
