import { routeToProvider } from '../providers/provider-router';

export async function analyzeImage(imageB64: string, prompt = 'Analyze this image.', type = 'general') {
  const result = await routeToProvider({
    tier: 'vision',
    prompt: `${prompt}\nType: ${type}`,
    image_b64: imageB64,
  });
  return { ok: !result.error, type, result };
}

export async function screenshotQA(imageB64: string, expectation: string) {
  return analyzeImage(imageB64, `Check this screenshot against expectation: ${expectation}`, 'screenshot-qa');
}
