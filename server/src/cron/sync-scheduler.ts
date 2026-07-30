/**
 * Auto-sync scheduler — runs periodic syncs in background.
 * Does NOT use node-cron (avoids extra dependency) — uses setInterval.
 * All syncs are read-only Level 1 operations — no approval needed.
 */

import { syncAll } from '../visibility/visibility-hub';
import { fullIngest } from '../knowledge/knowledge-db';
import { generateDev2OperationsPackage } from '../operations/dev2-operations';

const SYNC_INTERVAL_MS = 30 * 60 * 1000;   // 30 min visibility sync
const KB_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hr KB re-ingest
const DEV2_OPS_INTERVAL_MS = 60 * 60 * 1000; // 1 hr operations evidence refresh

let syncTimer: ReturnType<typeof setInterval> | null = null;
let kbTimer: ReturnType<typeof setInterval> | null = null;
let dev2OpsTimer: ReturnType<typeof setInterval> | null = null;
let lastVisibilitySync: Date | null = null;
let lastKbSync: Date | null = null;
let lastDev2OpsRun: Date | null = null;

export function startScheduler() {
  if (syncTimer) return; // already running

  // Visibility sync
  syncTimer = setInterval(async () => {
    try {
      console.log('[Scheduler] Running visibility sync...');
      await syncAll();
      lastVisibilitySync = new Date();
      console.log('[Scheduler] Visibility sync complete');
    } catch (e) {
      console.warn('[Scheduler] Visibility sync error:', e);
    }
  }, SYNC_INTERVAL_MS);

  // KB re-ingest
  kbTimer = setInterval(() => {
    try {
      console.log('[Scheduler] Running KB incremental ingest...');
      const result = fullIngest();
      lastKbSync = new Date();
      console.log(`[Scheduler] KB ingest: ${result.ingested} docs`);
    } catch (e) {
      console.warn('[Scheduler] KB ingest error:', e);
    }
  }, KB_SYNC_INTERVAL_MS);

  dev2OpsTimer = setInterval(() => {
    generateDev2OperationsPackage()
      .then(() => {
        lastDev2OpsRun = new Date();
        console.log('[Scheduler] DEV2 operations evidence refreshed');
      })
      .catch(e => console.warn('[Scheduler] DEV2 operations refresh error:', e));
  }, DEV2_OPS_INTERVAL_MS);

  console.log('[Scheduler] Auto-sync started (visibility: 30min, KB: 4hr, DEV2 ops: 1hr)');
}

export function stopScheduler() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  if (kbTimer) { clearInterval(kbTimer); kbTimer = null; }
  if (dev2OpsTimer) { clearInterval(dev2OpsTimer); dev2OpsTimer = null; }
}

export function getSchedulerStatus() {
  return {
    running: !!syncTimer,
    visibility_interval_min: SYNC_INTERVAL_MS / 60000,
    kb_interval_hr: KB_SYNC_INTERVAL_MS / 3600000,
    dev2_ops_interval_min: DEV2_OPS_INTERVAL_MS / 60000,
    last_visibility_sync: lastVisibilitySync?.toISOString() || null,
    last_kb_sync: lastKbSync?.toISOString() || null,
    last_dev2_ops_run: lastDev2OpsRun?.toISOString() || null,
  };
}
