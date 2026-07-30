/**
 * Normalizes raw WhatsApp messages into a canonical form for routing.
 * Strips /mi prefix, detects language, classifies source.
 */

export type MessageSource = 'whatsapp' | 'api' | 'test';
export type Language = 'vi' | 'en' | 'mixed';

export interface NormalizedMessage {
  raw: string;
  text: string;            // cleaned text without /mi prefix
  command: string | null;  // first token if starts with a known command
  args: string;            // remainder after command
  language: Language;
  source: MessageSource;
  is_voice: boolean;
  sender: string;
  chat_id: string;
  message_id: string;
  group_id?: string;
  timestamp: string;
}

const VI_PATTERN = /[àáạảãăắặẳẵâấậẩẫèéẹẻẽêếệểễìíịỉĩòóọỏõôốộổỗơớợởỡùúụủũưứựửữỳýỵỷỹđ]/i;
const COMMAND_PREFIXES = ['/mi ', '/mi\n', 'mi,', 'mi '];

export function normalizeMessage(params: {
  raw: string;
  sender: string;
  chat_id: string;
  message_id: string;
  group_id?: string;
  source?: MessageSource;
  is_voice?: boolean;
}): NormalizedMessage {
  const { raw, sender, chat_id, message_id, group_id, source = 'whatsapp', is_voice = false } = params;

  // Strip /mi prefix
  let text = raw.trim();
  for (const prefix of COMMAND_PREFIXES) {
    if (text.toLowerCase().startsWith(prefix)) {
      text = text.slice(prefix.length).trim();
      break;
    }
  }
  // Also handle bare "mi" at start
  if (/^mi\b/i.test(text) && !text.toLowerCase().startsWith('mi-')) {
    text = text.replace(/^mi\s*/i, '').trim();
  }

  // Detect first token as command
  const parts = text.split(/\s+/);
  const firstWord = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).join(' ');

  // Language detection
  const language: Language = VI_PATTERN.test(text) ? 'vi' : 'en';

  return {
    raw,
    text,
    command: firstWord || null,
    args,
    language,
    source,
    is_voice,
    sender,
    chat_id,
    message_id,
    group_id,
    timestamp: new Date().toISOString(),
  };
}

export function isVoiceMessage(payload: Record<string, unknown>): boolean {
  return (
    payload.type === 'audio' ||
    payload.type === 'voice' ||
    typeof payload.audio_url === 'string' ||
    typeof payload.voice_url === 'string'
  );
}
