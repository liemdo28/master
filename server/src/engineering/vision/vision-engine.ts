/**
 * Vision Engine — OCR / Image Analysis
 * Routes to Gemini Vision, GPT Vision, or Claude Vision based on availability.
 */

import { routeToProvider } from '../providers/provider-router';

export interface VisionResult {
  text:       string;
  model:      string;
  type:       'ocr' | 'description' | 'qa';
  confidence: number;
  latency_ms: number;
  error?:     string;
}

export async function analyzeImage(
  image_b64: string,
  prompt:    string = 'Describe this image in detail. Extract all visible text.',
  type:      'ocr' | 'description' | 'qa' = 'description',
): Promise<VisionResult> {
  const start = Date.now();

  const ocrPrompt = type === 'ocr'
    ? 'Extract ALL text from this image exactly as it appears. Return only the text, no commentary.'
    : prompt;

  const resp = await routeToProvider({
    tier:      'vision',
    prompt:    ocrPrompt,
    image_b64,
    max_tokens: 1024,
    temperature: 0,
  });

  return {
    text:       resp.content,
    model:      resp.model,
    type,
    confidence: resp.error ? 0 : 90,
    latency_ms: Date.now() - start,
    ...(resp.error ? { error: resp.error } : {}),
  };
}

export async function screenshotQA(image_b64: string, expectation: string): Promise<{
  passed:   boolean;
  score:    number;
  feedback: string;
  model:    string;
}> {
  const prompt = `You are a QA engineer reviewing a screenshot.
Expectation: "${expectation}"
Does the screenshot match the expectation? Reply with JSON only:
{"passed": true/false, "score": 0-100, "feedback": "one sentence explanation"}`;

  const resp = await routeToProvider({ tier: 'vision', prompt, image_b64, temperature: 0 });

  try {
    const result = JSON.parse(resp.content.replace(/```json|```/g, '').trim());
    return { ...result, model: resp.model };
  } catch {
    return { passed: false, score: 0, feedback: resp.content || resp.error || 'Parse error', model: resp.model };
  }
}
