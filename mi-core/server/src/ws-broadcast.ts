/**
 * WebSocket Broadcast Hub — Sprint 1.2
 *
 * Single source of truth for WebSocket broadcast across the server.
 * Modules import `broadcast` from here instead of relying on a local closure.
 *
 * Usage:
 *   import { broadcast, registerWss } from './ws-broadcast';
 *
 * Registration (in index.ts):
 *   import { registerWss } from './ws-broadcast';
 *   const wss = new WebSocketServer({ server, path: '/ws' });
 *   registerWss(wss);
 *
 * Emitting:
 *   broadcast({ type: 'connector_alert', alert });
 *   broadcast({ type: 'file_change', connector_id: 'dashboard', ... });
 */

import type { WebSocketServer } from 'ws';

let _wss: WebSocketServer | null = null;

/**
 * Register the WebSocketServer instance. Call once after wss is created in index.ts.
 */
export function registerWss(wss: WebSocketServer) {
  _wss = wss;
}

/**
 * Broadcast a JSON-serializable payload to all connected WebSocket clients.
 * Silently ignores errors (e.g., client disconnected mid-send).
 */
export function broadcast(data: object): void {
  if (!_wss) return; // Not initialized yet — non-fatal

  const payload = JSON.stringify(data);
  (_wss as any).clients.forEach((client: any) => {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(payload);
      } catch {
        // Client disconnected mid-send — ignore
      }
    }
  });
}
