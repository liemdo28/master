import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { queueToCeo } from '../services/whatsapp-sender';

const REVIEWS_DIR = path.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'reviews');

export interface Review { id: string; platform: 'google' | 'doordash' | 'yelp'; store: string; author: string; rating: number; text: string; date: string; responded: boolean; response_draft?: string; }
export interface ReviewResponse { review_id: string; draft: string; tone: 'professional' | 'friendly' | 'apologetic'; approved: boolean; posted: boolean; error?: string; }

function selectTone(rating: number): 'professional' | 'friendly' | 'apologetic' {
  if (rating >= 4) return 'friendly'; if (rating === 3) return 'professional'; return 'apologetic';
}

function generateTemplateResponse(review: Review): string {
  if (review.rating >= 4) return `Thank you so much for the wonderful review! We're so glad you enjoyed your experience at ${review.store}. We look forward to seeing you again soon!`;
  if (review.rating === 3) return `Thank you for taking the time to share your feedback about ${review.store}. We appreciate your honest review and will use it to improve your next visit.`;
  return `We sincerely apologize for the experience you had at ${review.store}. This is not the standard we hold ourselves to. Please contact us directly so we can make this right for you.`;
}

export async function draftResponse(review: Review): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return generateTemplateResponse(review);
  const tone = selectTone(review.rating);
  const body = JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, system: `You are a professional restaurant manager for ${review.store}. Write a ${tone} response to a customer review. Be genuine, specific, concise (2-4 sentences). Do NOT use generic phrases.`, messages: [{ role: 'user', content: `Customer review (${review.rating}/5 stars): "${review.text}"\n\nWrite a ${tone} response under 100 words.` }] });
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || generateTemplateResponse(review)); } catch { resolve(generateTemplateResponse(review)); } });
    });
    req.on('error', () => resolve(generateTemplateResponse(review)));
    req.write(body); req.end();
  });
}

export async function postGoogleResponse(reviewId: string, locationId: string, reply: string): Promise<boolean> {
  const token = process.env.GOOGLE_ACCESS_TOKEN; if (!token) return false;
  const body = JSON.stringify({ comment: reply });
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'mybusiness.googleapis.com', path: `/v4/${locationId}/reviews/${reviewId}/reply`, method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode === 200)); });
    req.on('error', () => resolve(false)); req.write(body); req.end();
  });
}

export async function processReviewBatch(reviews: Review[]): Promise<ReviewResponse[]> {
  fs.mkdirSync(REVIEWS_DIR, { recursive: true });
  const responses: ReviewResponse[] = [];
  for (const review of reviews) {
    if (review.responded) continue;
    const draft = await draftResponse(review);
    const tone  = selectTone(review.rating);
    const resp: ReviewResponse = { review_id: review.id, draft, tone, approved: false, posted: false };
    fs.writeFileSync(path.join(REVIEWS_DIR, `${review.id}-draft.json`), JSON.stringify({ review, response: resp }, null, 2));
    const stars = '⭐'.repeat(review.rating);
    queueToCeo([`📝 *Review Response Draft — ${review.store}*`, `Platform: ${review.platform} | Rating: ${stars}`, `Reviewer: ${review.author}`, ``, `*Review:*`, `"${review.text.slice(0,200)}"`, ``, `*Draft (${tone}):*`, `"${draft}"`, ``, `• \`approve-review ${review.id}\` — post`, `• \`skip-review ${review.id}\` — skip`].join('\n'));
    responses.push(resp);
  }
  return responses;
}

export function getPendingReviewDrafts(): { review: Review; response: ReviewResponse }[] {
  if (!fs.existsSync(REVIEWS_DIR)) return [];
  return fs.readdirSync(REVIEWS_DIR).filter(f => f.endsWith('-draft.json')).map(f => { try { return JSON.parse(fs.readFileSync(path.join(REVIEWS_DIR, f), 'utf8')); } catch { return null; } }).filter(Boolean).filter((d: any) => !d.response.approved);
}
