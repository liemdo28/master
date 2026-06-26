/**
 * Review Automation Connector — ingests Google/Yelp reviews from Review Automation System.
 */

import { ingestJson } from '../../ingestion-service';
import fs from 'fs';
import path from 'path';

const REVIEW_DATA_DIR = process.env.REVIEW_DATA_DIR || 'D:/Project/Master/review-automation-system/data';
const SOURCE_NAME = 'review-automation';

function readReviews(): Record<string, unknown>[] {
  const reviews: Record<string, unknown>[] = [];
  const dirs = [REVIEW_DATA_DIR, path.join(REVIEW_DATA_DIR, 'pending'), path.join(REVIEW_DATA_DIR, 'escalated')];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files.slice(0, 50)) { // cap at 50 per run
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
        if (Array.isArray(content)) reviews.push(...content);
        else reviews.push(content);
      } catch { continue; }
    }
  }
  return reviews;
}

export async function ingestReviews(): Promise<void> {
  const reviews = readReviews();
  if (reviews.length === 0) {
    console.log('[Review Connector] No reviews found to ingest');
    return;
  }

  // Group by store and ingest in batches
  const byStore: Record<string, Record<string, unknown>[]> = {};
  for (const r of reviews) {
    const store = (r['store'] as string) || 'unknown';
    byStore[store] = byStore[store] || [];
    byStore[store].push(r);
  }

  for (const [store, items] of Object.entries(byStore)) {
    await ingestJson({
      source_name: SOURCE_NAME,
      payload: { store, reviews: items, captured_at: new Date().toISOString() },
      filename: `reviews_${store}_${Date.now()}.json`,
      actor: 'review-connector',
    });
  }
  console.log(`[Review Connector] Ingested ${reviews.length} reviews`);
}

if (require.main === module) {
  ingestReviews().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
