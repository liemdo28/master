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
const dev2_operations_1 = require("../operations/dev2-operations");
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min visibility sync
const KB_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hr KB re-ingest
const DEV2_OPS_INTERVAL_MS = 60 * 60 * 1000; // 1 hr operations evidence refresh
let syncTimer = null;
let kbTimer = null;
let dev2OpsTimer = null;
let lastVisibilitySync = null;
let lastKbSync = null;
let lastDev2OpsRun = null;
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
    dev2OpsTimer = setInterval(() => {
        (0, dev2_operations_1.generateDev2OperationsPackage)()
            .then(() => {
            lastDev2OpsRun = new Date();
            console.log('[Scheduler] DEV2 operations evidence refreshed');
        })
            .catch(e => console.warn('[Scheduler] DEV2 operations refresh error:', e));
    }, DEV2_OPS_INTERVAL_MS);
    console.log('[Scheduler] Auto-sync started (visibility: 30min, KB: 4hr, DEV2 ops: 1hr)');
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
    if (dev2OpsTimer) {
        clearInterval(dev2OpsTimer);
        dev2OpsTimer = null;
    }
}
function getSchedulerStatus() {
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
