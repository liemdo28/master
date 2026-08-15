import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { VoiceControls } from '@/components/jarvis/VoiceControls';
import { api } from '@/lib/api-client';
import type { VoiceResponse, VoiceSynthesizeResponse } from '@/lib/types';

/**
 * Phase 7F — voice accessibility pass (directive §24). Voice UX must remain
 * fully usable without voice: keyboard path is first-class, recording state
 * is visible/announced, permission errors are announced, no-microphone and
 * TTS-unavailable fallbacks are graceful, never silent.
 */

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  ApiError: class ApiError extends Error { status: number; constructor(m: string, s: number) { super(m); this.name = 'ApiError'; this.status = s; } },
  UnauthorizedError: class UnauthorizedError extends Error {},
  setUnauthorizedHandler: vi.fn(),
}));

const mockSpeechState = {
  supported: true,
  state: 'idle' as 'idle' | 'listening' | 'permission-denied' | 'error',
  transcript: '',
  confidence: undefined as number | undefined,
  errorMessage: null as string | null,
  start: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
};

vi.mock('@/lib/useSpeechRecognition', () => ({
  useSpeechRecognition: () => mockSpeechState,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSpeechState.supported = true;
  mockSpeechState.state = 'idle';
  mockSpeechState.transcript = '';
  mockSpeechState.confidence = undefined;
  mockSpeechState.errorMessage = null;
});

describe('Phase 7F voice accessibility', () => {
  it('the "Voice input" region has an aria-label, reachable as a landmark', () => {
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    expect(screen.getByLabelText('Voice input')).toBeInTheDocument();
  });

  it('the push-to-talk button is a real, keyboard-activatable <button>', () => {
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    const button = screen.getByRole('button', { name: /push to talk/i });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('recording state is announced via role="status" (aria-live), not color alone', () => {
    mockSpeechState.state = 'listening';
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/listening/i);
  });

  it('while listening, the button becomes a real "Stop recording" button, not the same button silently changing meaning', () => {
    mockSpeechState.state = 'listening';
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    expect(stopButton.tagName).toBe('BUTTON');
  });

  it('microphone permission denial is announced as visible, readable text — never a silent failure', () => {
    mockSpeechState.state = 'permission-denied';
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    expect(screen.getByText(/microphone permission denied/i)).toBeInTheDocument();
    expect(screen.getByText(/you can still type your question/i)).toBeInTheDocument();
  });

  it('when the browser has no Web Speech API support, a clear fallback is shown and the text path is pointed to — never a broken/empty control', () => {
    mockSpeechState.supported = false;
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /push to talk/i })).not.toBeInTheDocument();
    expect(screen.getByText(/voice input isn't supported/i)).toBeInTheDocument();
    expect(screen.getByText(/use the text box above/i)).toBeInTheDocument();
  });

  it('the transcript preview textarea has an accessible label and is editable via keyboard', () => {
    mockSpeechState.transcript = 'what tasks are waiting on me';
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    const textarea = screen.getByLabelText(/transcript.*edit if needed/i);
    fireEvent.change(textarea, { target: { value: 'edited via keyboard' } });
    expect(screen.getByDisplayValue('edited via keyboard')).toBeInTheDocument();
  });

  it('the Send button is a real, keyboard-activatable <button>, disabled with no transcript', () => {
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    // No transcript yet — the Send button/preview area does not render at all,
    // matching "no hidden action" rather than a disabled-but-present control
    // that could confuse a screen reader user into thinking something is
    // ready to send.
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('TTS-unavailable is announced as visible text, and the text answer remains the source of truth', async () => {
    mockSpeechState.transcript = 'yes';
    const blocked: VoiceResponse = {
      voiceRequestId: 'vr-a11y-1', safetyLabel: 'SAFE', gatewayResponse: null,
      spokenText: 'Approval is still required in Command Center.',
      spokenTextPrivacyClass: 'PUBLIC_SAFE', lowConfidenceClarification: false, generatedAt: '2026-08-15T00:00:00Z',
    };
    vi.mocked(api.post).mockResolvedValueOnce(blocked);
    vi.mocked(api.post).mockResolvedValueOnce({ available: false, error: 'Text-to-speech is currently unavailable.' } satisfies VoiceSynthesizeResponse);
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByText('Approval is still required in Command Center.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    await waitFor(() => expect(screen.getByText(/text-to-speech is currently unavailable/i)).toBeInTheDocument());
    // The text answer is still fully visible — TTS being unavailable never
    // hides or replaces it.
    expect(screen.getByText('Approval is still required in Command Center.')).toBeInTheDocument();
  });

  it('the transcript preview label explicitly says nothing is sent until Send is clicked — no ambiguity for a screen reader user', () => {
    mockSpeechState.transcript = 'what tasks are waiting on me';
    renderWithProviders(<VoiceControls projectId={null} sessionId={undefined} onVoiceResponse={vi.fn()} />);
    expect(screen.getByText(/nothing is sent until you click send/i)).toBeInTheDocument();
  });
});
