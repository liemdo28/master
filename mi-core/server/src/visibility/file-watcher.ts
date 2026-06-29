/**
 * File Watcher for Real-Time Push — Sprint 1.2
 * Uses chokidar to watch local project files and emit sync events.
 * When a watched file changes, triggers a WebSocket broadcast so clients
 * can refresh their data without polling.
 */

import chokidar from 'chokidar';
import path from 'path';
import { broadcast } from '../ws-broadcast';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

// Paths to watch for real-time updates
const WATCH_PATHS: string[] = [
  path.join(GLOBAL_DIR, 'visibility', 'connectors'),
  path.join(GLOBAL_DIR, 'visibility', 'projects'),
  path.join(GLOBAL_DIR, 'visibility', 'dashboard'),
  path.join(GLOBAL_DIR, 'visibility', 'gmail'),
  path.join(GLOBAL_DIR, 'visibility', 'google-calendar'),
  path.join(GLOBAL_DIR, 'visibility', 'google-drive'),
  path.join(GLOBAL_DIR, 'visibility', 'google-sheets'),
  path.join(GLOBAL_DIR, 'visibility', 'asana'),
  path.join(GLOBAL_DIR, 'visibility', 'health-export'),
  path.join(GLOBAL_DIR, 'visibility', 'accounting'),
  path.join(GLOBAL_DIR, 'visibility', 'quickbooks'),
  path.join(GLOBAL_DIR, 'visibility', 'food-safety'),
  path.join(GLOBAL_DIR, 'visibility', 'website-bakudan'),
  path.join(GLOBAL_DIR, 'visibility', 'website-raw'),
  path.join(GLOBAL_DIR, 'projects'),
  path.join(GLOBAL_DIR, 'execution-ledger'),
];

// Debounce: don't fire more than once per connector per 2 seconds
const DEBOUNCE_MS = 2_000;
const _debounce: Record<string, NodeJS.Timeout> = {};

let _watcher: ReturnType<typeof chokidar.watch> | null = null;
let _started = false;

/**
 * Starts the file watcher. Call once at server boot.
 * Non-fatal — if it fails, server continues normally.
 */
export function startFileWatcher() {
  if (_started) return;
  _started = true;

  try {
    // Filter to existing paths only
    const fs = require('fs') as typeof import('fs');
    const existingPaths = WATCH_PATHS.filter(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    if (existingPaths.length === 0) {
      console.log('[Mi] FileWatcher: no watch paths exist yet — skipping');
      return;
    }

    _watcher = chokidar.watch(existingPaths, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      usePolling: false,          // Use native FS events (faster)
      interval: 1000,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.*',                // Hidden files
        '**/*.tmp',
        '**/*.log',
      ],
    });

    _watcher.on('change', (filePath: string) => {
      _emitChange(filePath, 'change');
    });

    _watcher.on('add', (filePath: string) => {
      _emitChange(filePath, 'add');
    });

    _watcher.on('unlink', (filePath: string) => {
      _emitChange(filePath, 'unlink');
    });

    _watcher.on('error', (err: unknown) => {
      console.warn('[Mi] FileWatcher error:', err instanceof Error ? err.message : String(err));
    });

    console.log(`[Mi] FileWatcher started — watching ${existingPaths.length} paths`);
  } catch (err) {
    console.warn('[Mi] FileWatcher init failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

/**
 * Stop the watcher gracefully.
 */
export function stopFileWatcher() {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
    _started = false;
    console.log('[Mi] FileWatcher stopped');
  }
}

function _emitChange(filePath: string, event: 'change' | 'add' | 'unlink') {
  // Derive connector_id from path
  const rel = filePath.replace(GLOBAL_DIR, '').replace(/\\/g, '/').replace(/^\//, '');
  const segments = rel.split('/');

  let connectorId = 'unknown';
  if (segments[0] === 'visibility') {
    // visibility/connectors/dashboard → dashboard
    // visibility/google-calendar/data.json → google-calendar
    if (segments[1] === 'connectors' && segments[2]) {
      connectorId = segments[2];
    } else if (segments[1]) {
      connectorId = segments[1];
    }
  } else if (segments[0] === 'projects') {
    connectorId = 'local-projects';
  } else if (segments[0] === 'execution-ledger') {
    connectorId = 'execution-ledger';
  }

  // Debounce per connector
  if (_debounce[connectorId]) {
    clearTimeout(_debounce[connectorId]);
  }
  _debounce[connectorId] = setTimeout(() => {
    const payload = {
      type: 'file_change',
      connector_id: connectorId,
      event,
      path: rel,
      timestamp: new Date().toISOString(),
    };
    console.log(`[Mi] FileWatcher: ${event} → ${connectorId} (${rel})`);
    broadcast(payload);
    delete _debounce[connectorId];
  }, DEBOUNCE_MS);
}
