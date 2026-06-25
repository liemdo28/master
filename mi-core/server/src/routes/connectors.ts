/**
 * Connectors API Routes
 * GET  /api/connectors/drive/files         — list Drive files
 * GET  /api/connectors/drive/search        — search Drive
 * POST /api/connectors/drive/ingest        — ingest files to knowledge
 * GET  /api/connectors/reviews/pending     — pending review drafts
 * POST /api/connectors/reviews/batch       — draft responses for batch
 * POST /api/connectors/reviews/post        — post approved response
 * GET  /api/connectors/social/status       — check social account status
 * POST /api/connectors/social/post         — post to social media
 * POST /api/connectors/social/generate     — AI-generate post content
 */

import { Router, Request, Response } from 'express';
import { listFiles, searchDriveFiles, ingestFilesToKnowledge } from '../connectors/google-drive-connector';
import { processReviewBatch, getPendingReviewDrafts, postGoogleResponse } from '../connectors/review-automation';
import { broadcastPost, generatePostContent, PostContent, Platform } from '../connectors/social-posting';

export const connectorsRouter = Router();

// ── Google Drive ──────────────────────────────────────────────────────────────

connectorsRouter.get('/drive/files', async (req: Request, res: Response) => {
  const { folder_id, limit } = req.query as any;
  try {
    const files = await listFiles(folder_id, limit ? parseInt(limit) : 50);
    res.json({ files, count: files.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

connectorsRouter.get('/drive/search', async (req: Request, res: Response) => {
  const { q } = req.query as any;
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const files = await searchDriveFiles(q);
    res.json({ files, count: files.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

connectorsRouter.post('/drive/ingest', async (req: Request, res: Response) => {
  const { file_ids } = req.body || {};
  if (!file_ids?.length) return res.status(400).json({ error: 'file_ids array required' });
  try {
    const results = await ingestFilesToKnowledge(file_ids);
    res.json({ results, ingested: results.filter(r => r.ingested).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Review Automation ─────────────────────────────────────────────────────────

connectorsRouter.get('/reviews/pending', (_req: Request, res: Response) => {
  try {
    const drafts = getPendingReviewDrafts();
    res.json({ drafts, count: drafts.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

connectorsRouter.post('/reviews/batch', async (req: Request, res: Response) => {
  const { reviews } = req.body || {};
  if (!reviews?.length) return res.status(400).json({ error: 'reviews array required' });
  try {
    const responses = await processReviewBatch(reviews);
    res.json({ responses, drafted: responses.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

connectorsRouter.post('/reviews/post', async (req: Request, res: Response) => {
  const { review_id, location_id, reply } = req.body || {};
  if (!review_id || !location_id || !reply) return res.status(400).json({ error: 'review_id, location_id, reply required' });
  try {
    const ok = await postGoogleResponse(review_id, location_id, reply);
    res.json({ success: ok });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Social Media ──────────────────────────────────────────────────────────────

connectorsRouter.get('/social/status', (_req: Request, res: Response) => {
  res.json({
    google_business: { configured: !!process.env.GOOGLE_ACCESS_TOKEN },
    facebook:        { configured: !!(process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_PAGE_ID) },
    instagram:       { configured: !!(process.env.FB_PAGE_ACCESS_TOKEN && process.env.FB_IG_USER_ID) },
  });
});

connectorsRouter.post('/social/post', async (req: Request, res: Response) => {
  const { content, platforms, gbp_location_ids } = req.body || {};
  if (!content?.text || !platforms?.length) return res.status(400).json({ error: 'content.text and platforms required' });
  try {
    const results = await broadcastPost(
      content as PostContent,
      platforms as Platform[],
      gbp_location_ids || [],
    );
    res.json({ results, posted: results.filter(r => r.success).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

connectorsRouter.post('/social/generate', async (req: Request, res: Response) => {
  const { topic, store, platform } = req.body || {};
  if (!topic || !store || !platform) return res.status(400).json({ error: 'topic, store, platform required' });
  try {
    const text = await generatePostContent(topic, store, platform as Platform);
    res.json({ text, platform, store });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
