import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';
import type { VoiceResponse, VoiceSynthesizeResponse } from '@/lib/types';
import { LoadingState } from '@/components/States';

/**
 * Phase 7F — voice controls for the Jarvis Operator Workspace (§22-24).
 * Push-to-talk only, transcript is always shown and editable before
 * sending, sending is always an explicit click — never automatic (§23).
 * Fully optional: the existing typed-text form is untouched and remains
 * the first-class path regardless of browser support (§24).
 */
export function VoiceControls({
  projectId,
  sessionId,
  onVoiceResponse,
}: {
  projectId: string | null;
  sessionId: string | undefined;
  onVoiceResponse: (response: VoiceResponse, transcript: string) => void;
}) {
  const speech = useSpeechRecognition();
  const [transcript, setTranscript] = useState('');
  const [usedSpeechThisTurn, setUsedSpeechThisTurn] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastBlocked, setLastBlocked] = useState<VoiceResponse | null>(null);
  const [ttsUnavailableNotice, setTtsUnavailableNotice] = useState<string | null>(null);

  // Speech recognition results flow into the same transcript field the
  // caller can type into directly — one field, one source of truth. This
  // also means the transcript field is always keyboard-usable even when
  // the browser has no Web Speech API (§24 no-microphone fallback) or when
  // a real microphone/network round-trip isn't available.
  useEffect(() => {
    if (speech.transcript) {
      setTranscript(speech.transcript);
      setUsedSpeechThisTurn(true);
    }
  }, [speech.transcript]);

  function handleStart() {
    setSendError(null);
    setLastBlocked(null);
    setUsedSpeechThisTurn(false);
    speech.start();
  }

  async function handleSend() {
    const text = transcript.trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    setLastBlocked(null);
    try {
      const response = await api.post<VoiceResponse>('/jarvis/voice/transcript', {
        transcript: text,
        source: usedSpeechThisTurn ? 'web_speech' : 'typed',
        projectId,
        sessionId,
        confidence: usedSpeechThisTurn ? speech.confidence : undefined,
      });
      if (response.gatewayResponse) {
        onVoiceResponse(response, text);
      } else {
        // Safety-blocked, confirmation-boundary, or low-confidence
        // clarification — always shown here, never silently discarded.
        setLastBlocked(response);
      }
      setTranscript('');
      setUsedSpeechThisTurn(false);
      speech.reset();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send voice request.');
    } finally {
      setSending(false);
    }
  }

  async function handlePlay(text: string) {
    setTtsUnavailableNotice(null);
    try {
      const result = await api.post<VoiceSynthesizeResponse>('/jarvis/voice/synthesize', { text });
      if (!result.available || !result.audioBase64) {
        setTtsUnavailableNotice(result.error ?? 'Spoken playback is currently unavailable — the answer is shown as text above.');
        return;
      }
      const audio = new Audio(`data:${result.mimeType ?? 'audio/mpeg'};base64,${result.audioBase64}`);
      audio.play().catch(() => setTtsUnavailableNotice('Spoken playback failed to start — the answer is shown as text above.'));
    } catch {
      setTtsUnavailableNotice('Spoken playback is currently unavailable — the answer is shown as text above.');
    }
  }

  return (
    <section aria-label="Voice input" className="space-y-2 rounded-md border border-(--color-border) p-2">
      {speech.supported ? (
        <div className="flex items-center gap-2">
          {speech.state !== 'listening' ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={sending}
              className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              🎤 Push to talk
            </button>
          ) : (
            <button
              type="button"
              onClick={speech.stop}
              className="rounded-md bg-(--color-blocked) px-3 py-1.5 text-sm font-medium text-white"
            >
              ⏹ Stop recording
            </button>
          )}
          <span role="status" aria-live="polite" className="text-xs text-(--color-text-faint)">
            {speech.state === 'listening' && 'Listening…'}
            {speech.state === 'permission-denied' && 'Microphone permission denied — you can still type your question below.'}
            {speech.state === 'error' && speech.errorMessage}
          </span>
        </div>
      ) : (
        <p className="text-xs text-(--color-text-faint)">
          Voice input isn't supported in this browser — type your question below, or use the text box above.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="voice-transcript-preview" className="text-xs font-medium text-(--color-text-faint)">
          Transcript (type or speak; edit if needed — nothing is sent until you click Submit)
        </label>
        <textarea
          id="voice-transcript-preview"
          value={transcript}
          onChange={e => { setTranscript(e.target.value); setUsedSpeechThisTurn(false); }}
          placeholder="Type a question here, or use Push to talk above…"
          rows={2}
          className="w-full rounded-md border border-(--color-border) bg-(--color-surface) p-2 text-sm text-(--color-text)"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !transcript.trim()}
          className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      {sending && <LoadingState label="Sending voice request…" />}
      {sendError && <p role="alert" className="text-xs text-(--color-blocked)">{sendError}</p>}

      {lastBlocked && (
        <div role="status" className="rounded-md border border-(--color-border) bg-(--color-surface) p-2 text-sm text-(--color-text-dim)">
          <p>{lastBlocked.spokenText}</p>
          <button
            type="button"
            onClick={() => handlePlay(lastBlocked.spokenText)}
            className="mt-1 text-xs text-(--color-accent) underline"
          >
            🔊 Play
          </button>
        </div>
      )}
      {ttsUnavailableNotice && <p className="text-xs text-(--color-text-faint)">{ttsUnavailableNotice}</p>}
    </section>
  );
}
