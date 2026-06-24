/**
 * Voice Output Orchestrator — end-to-end voice memo pipeline.
 *
 * Flow:
 *   1. Generate text report (from daily summary, briefing, or direct text)
 *   2. Synthesize to MP3 via VieNeu-TTS (edge-tts)
 *   3. Approval gate check (auto-approve for CEO, require approval for others)
 *   4. Send WhatsApp voice note (via gateway /api/send-audio)
 *   5. Save audio evidence with workflow ID
 *
 * CEO exemption: voice notes to CEO skip the approval gate.
 * Non-CEO recipients: approval gate enqueues the request, CEO must approve.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { synthesizeSpeech, isTTSAvailable, type TTSResult } from './tts-service';
import { saveVoiceEvidence, type VoiceEvidence } from './voice-evidence-store';
import { queueToCeo, sendWhatsApp, sendWhatsAppAudio } from '../services/whatsapp-sender';
import { cleanForVoiceIdentity, type MiVoiceRole } from './voice-personality';
import { enqueue, approve, getById } from '../approval/gate';

// ── Types ──────────────────────────────────────────────────────────────────

export interface VoiceOutputRequest {
  /** Text content to synthesize */
  text: string;
  /** Text report (for evidence/reference) */
  text_report?: string;
  /** Recipient WhatsApp number */
  recipient?: string;
  /** Recipient name */
  recipient_name?: string;
  /** Whether recipient is CEO (skips approval gate) */
  is_ceo?: boolean;
  /** Workflow ID for evidence linking */
  workflow_id?: string;
  /** Voice preference */
  voice?: string;
  /** Speech rate */
  rate?: string;
}

export interface VoiceOutputResult {
  ok: boolean;
  workflow_id: string;
  /** Text report generated */
  text_report?: string;
  /** TTS synthesis result */
  tts: TTSResult;
  /** Whether sent via WhatsApp */
  whatsapp_sent: boolean;
  /** Approval gate status */
  approval_status: 'auto_approved' | 'pending_approval' | 'approved' | 'skipped_ceo';
  /** Approval ID if gated */
  approval_id?: string;
  /** Evidence record */
  evidence?: VoiceEvidence;
  error?: string;
}

// ── Default CEO number ─────────────────────────────────────────────────────

function getCeoNumber(): string {
  return process.env.CEO_WHATSAPP_NUMBER || '';
}

// ── Main orchestration ─────────────────────────────────────────────────────

export async function orchestrateVoiceOutput(
  request: VoiceOutputRequest
): Promise<VoiceOutputResult> {
  const workflow_id = request.workflow_id || `voice-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const recipient = request.recipient || getCeoNumber();
  const is_ceo = request.is_ceo ?? (recipient === getCeoNumber());

  console.log(`[VoiceOrchestrator] Starting workflow ${workflow_id} → ${request.recipient_name || recipient || 'unknown'}`);

  // Step 1: Check TTS availability
  if (!isTTSAvailable()) {
    return {
      ok: false,
      workflow_id,
      tts: { available: false, error: 'TTS not available' },
      whatsapp_sent: false,
      approval_status: 'skipped_ceo',
      error: 'VieNeu-TTS not available. Ensure VOICE_TTS_ENABLED=1 and edge-tts is installed.',
    };
  }

  // Step 2: Synthesize speech
  const tts = await synthesizeSpeech(request.text, 'vi', {
    voice: request.voice,
    rate: request.rate,
    workflow_id,
  });

  if (!tts.available || !tts.audio_path) {
    return {
      ok: false,
      workflow_id,
      tts,
      whatsapp_sent: false,
      approval_status: 'skipped_ceo',
      error: `TTS synthesis failed: ${tts.error}`,
    };
  }

  // Step 3: Approval gate
  let approval_status: VoiceOutputResult['approval_status'] = 'auto_approved';
  let approval_id: string | undefined;

  if (is_ceo) {
    // CEO-to-CEO: auto-approve, skip gate
    approval_status = 'skipped_ceo';
    console.log(`[VoiceOrchestrator] CEO exemption — skipping approval gate`);
  } else {
    // Non-CEO: enqueue for approval
    const action = enqueue({
      risk_level: 2,
      category: 'voice_output',
      description: `Send voice note to ${request.recipient_name || recipient}: "${request.text.slice(0, 80)}..."`,
      target: `whatsapp:${recipient}`,
      before_state: 'text_only',
      after_state: 'voice_note_sent',
      rollback_plan: 'Delete audio file, do not send voice note',
    });
    approval_id = action.id;
    approval_status = 'pending_approval';
    console.log(`[VoiceOrchestrator] Enqueued approval ${action.id} — waiting for CEO approval`);
  }

  // Step 4: Send WhatsApp voice note (only if approved or CEO-exempt)
  let whatsapp_sent = false;
  if (approval_status === 'skipped_ceo') {
    if (recipient && tts.audio_path) {
      try {
        whatsapp_sent = await sendWhatsAppAudio(recipient, tts.audio_path, request.text);
        console.log(`[VoiceOrchestrator] WhatsApp voice note sent: ${whatsapp_sent}`);
      } catch (e) {
        console.error(`[VoiceOrchestrator] WhatsApp send failed:`, e);
      }
    }
  }

  // Step 5: Save evidence
  const evidence = await saveVoiceEvidence({
    workflow_id,
    audio_id: tts.audio_id || '',
    audio_path: tts.audio_path || '',
    text_content: request.text,
    text_report: request.text_report,
    recipient,
    recipient_name: request.recipient_name,
    is_ceo,
    approval_id,
    approval_status,
    whatsapp_sent,
    voice: tts.voice || 'vi-VN-HoaiMyNeural',
    file_size_bytes: tts.file_size_bytes || 0,
    synthesis_ms: tts.synthesis_ms || 0,
  });

  // Step 6: Notify CEO (for non-CEO voice notes, send text notification)
  if (!is_ceo && approval_status === 'pending_approval') {
    queueToCeo(
      `🎤 *Voice Note cần duyệt*\n\n` +
      `Gửi đến: ${request.recipient_name || recipient}\n` +
      `Nội dung: ${request.text.slice(0, 150)}...\n\n` +
      `Duyệt: /mi approve ${approval_id}\n` +
      `Từ chối: /mi reject ${approval_id}`
    );
  }

  return {
    ok: true,
    workflow_id,
    text_report: request.text_report,
    tts,
    whatsapp_sent,
    approval_status,
    approval_id,
    evidence,
  };
}

// ── Approve a pending voice note ───────────────────────────────────────────

export async function approveVoiceNote(
  approval_id: string,
  approver = 'ceo'
): Promise<{ approved: boolean; result?: VoiceOutputResult; error?: string }> {
  const action = approve(approval_id, approver);
  if (!action) {
    return { approved: false, error: `Approval ${approval_id} not found or already resolved` };
  }

  if (action.status !== 'approved') {
    return { approved: false, error: 'Partial approval — Level 3 needs 2 confirmations' };
  }

  // Extract recipient from target
  const recipient = action.target?.replace('whatsapp:', '') || '';
  if (recipient) {
    // Find the audio file from evidence
    const evidenceDir = path.join(
      process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
      'voice', 'evidence'
    );
    const evidenceFiles = fs.readdirSync(evidenceDir).filter(f => f.endsWith('.json'));
    for (const f of evidenceFiles) {
      try {
        const ev: VoiceEvidence = JSON.parse(fs.readFileSync(path.join(evidenceDir, f), 'utf-8'));
        if (ev.approval_id === approval_id && ev.audio_path && fs.existsSync(ev.audio_path)) {
          const sent = await sendWhatsAppAudio(recipient, ev.audio_path, ev.text_content);
          return { approved: true, whatsapp_sent: sent } as any;
        }
      } catch { /* continue */ }
    }
  }

  return { approved: true };
}
