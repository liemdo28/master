/**
 * qbAgentSheetSyncService.ts
 * ===========================
 * Wires QB Agent API events to Google Sheet writes.
 * Called from the QB Agent routes immediately after DB insert.
 *
 * All writes are fire-and-forget: errors are logged but never throw
 * to the QB Agent (a Sheet failure must not break the agent report).
 */

import {
  writeMachineHeartbeat,
  writeMachineRegistration,
  writeQbFile,
  writeSyncCycle,
  writeActivityLog,
  writeTimeline,
  writeError,
  writeRemoteCommand,
  isConfigured,
} from './googleSheetReporter';

let _sheetEnabled: boolean | null = null;

async function sheetEnabled(): Promise<boolean> {
  if (_sheetEnabled === null) {
    _sheetEnabled = await isConfigured();
    if (!_sheetEnabled) {
      console.warn('[SheetSync] Google Sheets not configured. Set GOOGLE_SHEET_ID and auth env vars to enable.');
    }
  }
  return _sheetEnabled;
}

function safe(label: string, fn: () => Promise<any>): void {
  fn().then(r => {
    if (r && !r.ok) {
      console.warn(`[SheetSync] ${label} write failed:`, r.error);
    }
  }).catch(e => {
    console.warn(`[SheetSync] ${label} exception:`, e?.message || e);
  });
}

// ── Public sync hooks ─────────────────────────────────────────────────────────

export function onRegister(data: Record<string, any>): void {
  safe('register', async () => {
    if (!await sheetEnabled()) return { ok: true };
    return writeMachineRegistration(data);
  });
}

export function onHeartbeat(data: Record<string, any>): void {
  safe('heartbeat', async () => {
    if (!await sheetEnabled()) return { ok: true };
    return writeMachineHeartbeat({
      machine_id:     data.machine_id,
      machine_name:   data.machine_name,
      store_code:     data.store_code,
      status:         data.status,
      qb_open:        !!data.qb_open,
      qb_company:     data.qb_company,
      app_version:    data.app_version,
      last_heartbeat: data.received_at,
    });
  });
}

export function onQbFiles(machineId: string, laptopName: string, files: any[]): void {
  for (const f of files) {
    safe('qb-file', async () => {
      if (!await sheetEnabled()) return { ok: true };
      return writeQbFile(machineId, laptopName, f);
    });
  }
}

export function onSyncCycle(data: Record<string, any>): void {
  safe('sync-cycle', async () => {
    if (!await sheetEnabled()) return { ok: true };
    return writeSyncCycle(data);
  });
}

export function onActivityLogResult(data: Record<string, any>): void {
  safe('activity-log', async () => {
    if (!await sheetEnabled()) return { ok: true };
    return writeActivityLog(data);
  });
}

export function onTimelineResult(data: Record<string, any>): void {
  safe('timeline', async () => {
    if (!await sheetEnabled()) return { ok: true };
    return writeTimeline(data);
  });
}

export function onError(data: Record<string, any>): void {
  safe('error', async () => {
    if (!await sheetEnabled()) return { ok: true };
    return writeError(data);
  });
}

export function onCommandUpdate(data: Record<string, any>): void {
  safe('remote-command', async () => {
    if (!await sheetEnabled()) return { ok: true };
    return writeRemoteCommand(data);
  });
}
