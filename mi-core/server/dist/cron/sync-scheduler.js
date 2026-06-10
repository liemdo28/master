"use strict";
/**
 * Auto-sync scheduler — runs periodic syncs in background.
 * Does NOT use node-cron (avoids extra dependency) — uses setInterval.
 * All syncs are read-only Level 1 operations — no approval needed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
exports.stopScheduler = stopScheduler;
exports.getSchedulerStatus = getSchedulerStatus;
const visibility_hub_1 = require("../visibility/visibility-hub");
const knowledge_db_1 = require("../knowledge/knowledge-db");
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min visibility sync
const KB_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hr KB re-ingest
let syncTimer = null;
let kbTimer = null;
let lastVisibilitySync = null;
let lastKbSync = null;
function startScheduler() {
    if (syncTimer)
        return; // already running
    // Visibility sync
    syncTimer = setInterval(async () => {
        try {
            console.log('[Scheduler] Running visibility sync...');
            await (0, visibility_hub_1.syncAll)();
            lastVisibilitySync = new Date();
            console.log('[Scheduler] Visibility sync complete');
        }
        catch (e) {
            console.warn('[Scheduler] Visibility sync error:', e);
        }
    }, SYNC_INTERVAL_MS);
    // KB re-ingest
    kbTimer = setInterval(() => {
        try {
            console.log('[Scheduler] Running KB incremental ingest...');
            const result = (0, knowledge_db_1.fullIngest)();
            lastKbSync = new Date();
            console.log(`[Scheduler] KB ingest: ${result.ingested} docs`);
        }
        catch (e) {
            console.warn('[Scheduler] KB ingest error:', e);
        }
    }, KB_SYNC_INTERVAL_MS);
    console.log('[Scheduler] Auto-sync started (visibility: 30min, KB: 4hr)');
}
function stopScheduler() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
    if (kbTimer) {
        clearInterval(kbTimer);
        kbTimer = null;
    }
}
function getSchedulerStatus() {
    return {
        running: !!syncTimer,
        visibility_interval_min: SYNC_INTERVAL_MS / 60000,
        kb_interval_hr: KB_SYNC_INTERVAL_MS / 3600000,
        last_visibility_sync: lastVisibilitySync?.toISOString() || null,
        last_kb_sync: lastKbSync?.toISOString() || null,
    };
}
