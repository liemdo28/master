/**
 * WhatsApp Sender — Mi's outbound channel to CEO.
 * POSTs to the whatsapp-ai-gateway relay endpoint.
 * Used by: proactive monitor, daily briefing, autonomous tasks.
 *
 * Env vars:
 *   WHATSAPP_RELAY_URL  — gateway base URL (default http://localhost:3211)
 *   CEO_WHATSAPP_NUMBER — CEO phone e.g. +84931773657
 */

import fs from 'fs';
import path from 'path';

const OUTBOX_PATH = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'connectors', 'whatsapp', 'outbox.json'
);

function getRelayUrl(): string {
  return process.env.WHATSAPP_RELAY_URL || 'http://localhost:3211';
}

function getCeoNumber(): string {
  return process.env.CEO_WHATSAPP_NUMBER || '';
}

export interface OutboundMessage {
  to: string;
  message: string;
  sent_at?: string;
  delivered?: boolean;
  error?: string;
}

function appendOutbox(entry: OutboundMessage) {
  try {
    const dir = path.dirname(OUTBOX_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const existing: OutboundMessage[] = fs.existsSync(OUTBOX_PATH)
      ? JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf8'))
      : [];
    existing.push(entry);
    if (existing.length > 500) existing.splice(0, existing.length - 500);
    fs.writeFileSync(OUTBOX_PATH, JSON.stringify(existing, null, 2), 'utf8');
  } catch { /* never crash */ }
}

/**
 * Send a message to any WhatsApp number via the gateway relay.
 * Returns true on success, false on failure.
 */
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const entry: OutboundMessage = { to, message, sent_at: new Date().toISOString() };
  try {
    const res = await fetch(`${getRelayUrl()}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
      signal: AbortSignal.timeout(10_000),
    });
    entry.delivered = res.ok;
    if (!res.ok) entry.error = `HTTP ${res.status}`;
    appendOutbox(entry);
    return res.ok;
  } catch (e) {
    entry.delivered = false;
    entry.error = e instanceof Error ? e.message : String(e);
    appendOutbox(entry);
    return false;
  }
}

/**
 * Send a message to CEO's WhatsApp.
 */
export async function sendToCeo(message: string): Promise<boolean> {
  const ceoNumber = getCeoNumber();
  if (!ceoNumber) {
    console.warn('[WhatsApp Sender] CEO_WHATSAPP_NUMBER not set — outbound disabled');
    return false;
  }
  return sendWhatsApp(ceoNumber, message);
}

/**
 * Send a voice note (audio file) via WhatsApp gateway.
 * Uses multipart form upload to the gateway's /api/send-audio endpoint.
 * Falls back to sending a text message with a [voice note] prefix if audio endpoint unavailable.
 */
export async function sendWhatsAppAudio(to: string, audioPath: string, caption = ''): Promise<boolean> {
  const relayUrl = getRelayUrl();
  const entry: OutboundMessage = { to, message: `[Voice Note] ${caption.slice(0, 100)}`, sent_at: new Date().toISOString() };

  try {
    // Try the gateway send-media endpoint
    const fileBuffer = fs.readFileSync(audioPath);
    const fileName = path.basename(audioPath);
    const mimeType = audioPath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/ogg';

    const boundary = `----MiVoice${Date.now()}`;
    const parts: Buffer[] = [];

    // Add 'to' field
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="to"\r\n\r\n${to}\r\n`
    ));

    // Add 'caption' field if present
    if (caption) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption.slice(0, 200)}\r\n`
      ));
    }

    // Add audio file
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const res = await fetch(`${relayUrl}/api/send-media`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body: body as any,
      signal: AbortSignal.timeout(30_000),
    });

    if (res.ok) {
      entry.delivered = true;
      appendOutbox(entry);
      return true;
    }

    // Fallback: send text-only with voice note reference
    console.warn(`[WhatsApp Sender] Audio send failed (HTTP ${res.status}), falling back to text`);
    return sendWhatsApp(to, `🎤 Voice note: ${caption.slice(0, 150)}`);
  } catch (e) {
    // Fallback: send text
    console.warn(`[WhatsApp Sender] Audio send error, falling back to text:`, e);
    return sendWhatsApp(to, `🎤 Voice note: ${caption.slice(0, 150)}`);
  }
}

/**
 * Queue a message for delivery. Fire-and-forget — logs but doesn't throw.
 */
export function queueToCeo(message: string): void {
  sendToCeo(message).catch(() => {/* already logged */});
}

export function getOutboxHistory(limit = 20): OutboundMessage[] {
  try {
    if (!fs.existsSync(OUTBOX_PATH)) return [];
    const all: OutboundMessage[] = JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf8'));
    return all.slice(-limit).reverse();
  } catch { return []; }
}
