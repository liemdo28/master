import https from 'https';

export type Platform = 'google_business' | 'facebook' | 'instagram';
export interface PostContent { text: string; image_url?: string; link?: string; call_to_action?: string; cta_url?: string; }
export interface PostResult { platform: Platform; post_id?: string; url?: string; success: boolean; error?: string; }

function postForm(options: https.RequestOptions, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d.slice(0,300) }); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

export async function postToGBP(locationId: string, content: PostContent): Promise<PostResult> {
  const token = process.env.GOOGLE_ACCESS_TOKEN; if (!token) return { platform: 'google_business', success: false, error: 'GOOGLE_ACCESS_TOKEN not set' };
  const post: any = { languageCode: 'en-US', summary: content.text.slice(0, 1500), topicType: 'STANDARD' };
  if (content.call_to_action && content.cta_url) post.callToAction = { actionType: content.call_to_action, url: content.cta_url };
  if (content.image_url) post.media = [{ mediaFormat: 'PHOTO', sourceUrl: content.image_url }];
  const body = JSON.stringify(post);
  const data = await postForm({ hostname: 'mybusiness.googleapis.com', path: `/v4/${locationId}/localPosts`, method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, body);
  if (data.error) return { platform: 'google_business', success: false, error: JSON.stringify(data.error) };
  return { platform: 'google_business', post_id: data.name, success: true };
}

export async function postToFacebook(content: PostContent): Promise<PostResult> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN; const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) return { platform: 'facebook', success: false, error: 'FB_PAGE_ACCESS_TOKEN or FB_PAGE_ID not set' };
  const params: Record<string, string> = { message: content.text, access_token: token };
  if (content.link) params.link = content.link;
  const body = new URLSearchParams(params).toString();
  const data = await postForm({ hostname: 'graph.facebook.com', path: `/v19.0/${pageId}/feed`, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
  if (data.error) return { platform: 'facebook', success: false, error: data.error.message };
  return { platform: 'facebook', post_id: data.id, url: data.id ? `https://facebook.com/${data.id}` : undefined, success: !!data.id };
}

export async function postToInstagram(content: PostContent): Promise<PostResult> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN; const igUserId = process.env.FB_IG_USER_ID;
  if (!token || !igUserId) return { platform: 'instagram', success: false, error: 'FB_PAGE_ACCESS_TOKEN or FB_IG_USER_ID not set' };
  if (!content.image_url) return { platform: 'instagram', success: false, error: 'Instagram requires image_url' };
  const createBody = new URLSearchParams({ image_url: content.image_url, caption: content.text.slice(0,2200), access_token: token }).toString();
  const container = await postForm({ hostname: 'graph.facebook.com', path: `/v19.0/${igUserId}/media`, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(createBody) } }, createBody);
  if (!container.id) return { platform: 'instagram', success: false, error: container.error?.message || 'Container failed' };
  const publishBody = new URLSearchParams({ creation_id: container.id, access_token: token }).toString();
  const published = await postForm({ hostname: 'graph.facebook.com', path: `/v19.0/${igUserId}/media_publish`, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(publishBody) } }, publishBody);
  if (published.error) return { platform: 'instagram', success: false, error: published.error.message };
  return { platform: 'instagram', post_id: published.id, success: !!published.id };
}

export async function broadcastPost(content: PostContent, platforms: Platform[], gbpLocationIds: string[] = []): Promise<PostResult[]> {
  const results: PostResult[] = [];
  await Promise.all(platforms.map(async (platform) => {
    if (platform === 'google_business') { for (const locId of gbpLocationIds) results.push(await postToGBP(locId, content)); }
    else if (platform === 'facebook') results.push(await postToFacebook(content));
    else if (platform === 'instagram') results.push(await postToInstagram(content));
  }));
  return results;
}

export async function generatePostContent(topic: string, store: string, platform: Platform): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return `${topic} — ${store}`;
  const limits: Record<Platform, number> = { google_business: 1500, facebook: 500, instagram: 300 };
  const body = JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: `You write engaging social media posts for ${store}, a restaurant. Keep under ${limits[platform]} chars. Warm, authentic, relevant emojis.`, messages: [{ role: 'user', content: `Write a ${platform} post about: ${topic}` }] });
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).content?.[0]?.text || topic); } catch { resolve(topic); } });
    });
    req.on('error', () => resolve(topic)); req.write(body); req.end();
  });
}
