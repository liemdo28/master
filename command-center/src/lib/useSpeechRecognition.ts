/**
 * Phase 7F — thin wrapper over the browser's native Web Speech API
 * (SpeechRecognition). This is the primary, zero-upload voice input path
 * (§21's "transcript-first" preference) — no audio ever leaves the browser
 * for this path; only the resulting transcript is sent to the server.
 * Push-to-talk only (§8) — no continuous/always-listening loop, no wake
 * word, matches the directive's explicit preference for the safer mode.
 *
 * Not available in all browsers (notably Firefox) — callers must always
 * treat `supported === false` as a normal, expected state and fall back to
 * the existing typed-text path, never as an error.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionResultLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechRecognitionState = 'idle' | 'listening' | 'permission-denied' | 'error';

export interface UseSpeechRecognitionResult {
  supported: boolean;
  state: SpeechRecognitionState;
  transcript: string;
  confidence: number | undefined;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(language = 'en-US'): UseSpeechRecognitionResult {
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [state, setState] = useState<SpeechRecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    setTranscript('');
    setConfidence(undefined);
    setErrorMessage(null);
    const recognition = new Ctor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const result = event.results[0]?.[0];
      if (result) {
        setTranscript(result.transcript);
        setConfidence(result.confidence);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setState('permission-denied');
        setErrorMessage('Microphone permission was denied.');
      } else {
        setState('error');
        setErrorMessage(`Speech recognition error: ${event.error}`);
      }
    };
    recognition.onend = () => {
      setState(prev => (prev === 'listening' ? 'idle' : prev));
    };
    recognitionRef.current = recognition;
    setState('listening');
    recognition.start();
  }, [language]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setConfidence(undefined);
    setErrorMessage(null);
    setState('idle');
  }, []);

  return { supported, state, transcript, confidence, errorMessage, start, stop, reset };
}
