"use strict";
/**
 * qbAgentSheetSyncService.ts
 * ===========================
 * Wires QB Agent API events to Google Sheet writes.
 * Called from the QB Agent routes immediately after DB insert.
 *
 * All writes are fire-and-forget: errors are logged but never throw
 * to the QB Agent (a Sheet failure must not break the agent report).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRegister = onRegister;
exports.onHeartbeat = onHeartbeat;
exports.onQbFiles = onQbFiles;
exports.onSyncCycle = onSyncCycle;
exports.onActivityLogResult = onActivityLogResult;
exports.onTimelineResult = onTimelineResult;
exports.onError = onError;
exports.onCommandUpdate = onCommandUpdate;
const googleSheetReporter_1 = require("./googleSheetReporter");
let _sheetEnabled = null;
async function sheetEnabled() {
    if (_sheetEnabled === null) {
        _sheetEnabled = await (0, googleSheetReporter_1.isConfigured)();
        if (!_sheetEnabled) {
            console.warn('[SheetSync] Google Sheets not configured. Set GOOGLE_SHEET_ID and auth env vars to enable.');
        }
    }
    return _sheetEnabled;
}
function safe(label, fn) {
    fn().then(r => {
        if (r && !r.ok) {
            console.warn(`[SheetSync] ${label} write failed:`, r.error);
        }
    }).catch(e => {
        console.warn(`[SheetSync] ${label} exception:`, e?.message || e);
    });
}
// ── Public sync hooks ─────────────────────────────────────────────────────────
function onRegister(data) {
    safe('register', async () => {
        if (!await sheetEnabled())
            return { ok: true };
        return (0, googleSheetReporter_1.writeMachineRegistration)(data);
    });
}
function onHeartbeat(data) {
    safe('heartbeat', async () => {
        if (!await sheetEnabled())
            return { ok: true };
        return (0, googleSheetReporter_1.writeMachineHeartbeat)({
            machine_id: data.machine_id,
            machine_name: data.machine_name,
            store_code: data.store_code,
            status: data.status,
            qb_open: !!data.qb_open,
            qb_company: data.qb_company,
            app_version: data.app_version,
            last_heartbeat: data.received_at,
        });
    });
}
function onQbFiles(machineId, laptopName, files) {
    for (const f of files) {
        safe('qb-file', async () => {
            if (!await sheetEnabled())
                return { ok: true };
            return (0, googleSheetReporter_1.writeQbFile)(machineId, laptopName, f);
        });
    }
}
function onSyncCycle(data) {
    safe('sync-cycle', async () => {
        if (!await sheetEnabled())
            return { ok: true };
        return (0, googleSheetReporter_1.writeSyncCycle)(data);
    });
}
function onActivityLogResult(data) {
    safe('activity-log', async () => {
        if (!await sheetEnabled())
            return { ok: true };
        return (0, googleSheetReporter_1.writeActivityLog)(data);
    });
}
function onTimelineResult(data) {
    safe('timeline', async () => {
        if (!await sheetEnabled())
            return { ok: true };
        return (0, googleSheetReporter_1.writeTimeline)(data);
    });
}
function onError(data) {
    safe('error', async () => {
        if (!await sheetEnabled())
            return { ok: true };
        return (0, googleSheetReporter_1.writeError)(data);
    });
}
function onCommandUpdate(data) {
    safe('remote-command', async () => {
        if (!await sheetEnabled())
            return { ok: true };
        return (0, googleSheetReporter_1.writeRemoteCommand)(data);
    });
}
