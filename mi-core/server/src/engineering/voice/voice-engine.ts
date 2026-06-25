export async function transcribe(_audio: Buffer, filename?: string) {
  return {
    ok: false,
    filename,
    error: 'Speech-to-text backend is not configured on this PC.',
  };
}

export async function synthesize(text: string, voice = 'nova') {
  return {
    ok: false,
    text,
    voice,
    error: 'Text-to-speech backend is not configured on this PC.',
  };
}

export function classifyVoiceCommand(text: string) {
  const normalized = text.toLowerCase();
  const intent = normalized.includes('status')
    ? 'status'
    : normalized.includes('approve')
      ? 'approval'
      : normalized.includes('sync')
        ? 'sync'
        : 'general';

  return { text, intent, confidence: intent === 'general' ? 0.4 : 0.75 };
}
