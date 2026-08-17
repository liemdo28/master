/**
 * Phase 7G §12-14 — boot preflight: read-only port-ownership check an
 * operator can run before `pm2 start ecosystem.config.js` (not wired into
 * the server's own listen() call — that would be a boot-behavior change
 * requiring its own review cycle, out of scope for a certification phase).
 *
 * §13: "must NOT kill arbitrary process automatically" — this module has
 * no code path that terminates anything. It only ever binds a throwaway
 * probe socket (immediately closed) or reports what it observed.
 */
import net from 'net';

export interface PortPreflightResult {
  port: number;
  available: boolean;
  detail: string;
}

/** Binds a throwaway probe socket to `port` to determine availability —
 *  the same mechanism the real server's `app.listen()` would use, so this
 *  reports exactly what a real boot attempt would encounter. The probe
 *  socket is always closed immediately, whether it succeeded or failed. */
export function checkPortAvailability(port: number, host = '0.0.0.0'): Promise<PortPreflightResult> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', (err: NodeJS.ErrnoException) => {
      probe.close();
      if (err.code === 'EADDRINUSE') {
        resolve({ port, available: false, detail: `Port ${port} is already bound by another process — refusing to start a duplicate listener.` });
      } else {
        resolve({ port, available: false, detail: `Port ${port} probe failed: ${err.code || err.message}` });
      }
    });
    probe.once('listening', () => {
      probe.close(() => resolve({ port, available: true, detail: `Port ${port} is free.` }));
    });
    probe.listen(port, host);
  });
}

/** Checks a set of canonical ports and returns a preflight report. Never
 *  throws, never kills anything — a caller decides what to do with an
 *  `available: false` result (the correct action is always "do not start
 *  a duplicate," never "kill whatever is there"). */
export async function preflightPorts(ports: number[]): Promise<{ ok: boolean; results: PortPreflightResult[] }> {
  const results = await Promise.all(ports.map(p => checkPortAvailability(p)));
  return { ok: results.every(r => r.available), results };
}
