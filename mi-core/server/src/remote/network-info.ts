/**
 * Network Info — detect LAN IP, Tailscale IP, build remote URLs
 */

import os from 'os';
import http from 'http';

export interface NetworkInfo {
  lan_ip: string | null;
  tailscale_ip: string | null;
  lan_url: string | null;
  tailscale_url: string | null;
  port: number;
}

export function getNetworkInfo(port: number = 4001): NetworkInfo {
  const ifaces = os.networkInterfaces();
  let lan_ip: string | null = null;
  let tailscale_ip: string | null = null;

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      // Tailscale uses 100.x.x.x range
      if (addr.address.startsWith('100.')) {
        tailscale_ip = addr.address;
        continue;
      }
      // LAN: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
      if (
        addr.address.startsWith('192.168.') ||
        addr.address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(addr.address)
      ) {
        lan_ip = addr.address;
      }
    }
  }

  return {
    lan_ip,
    tailscale_ip,
    lan_url:        lan_ip        ? `http://${lan_ip}:${port}` : null,
    tailscale_url:  tailscale_ip  ? `http://${tailscale_ip}:${port}` : null,
    port,
  };
}

/** Quick async check if a URL responds */
export function pingUrl(url: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const req = http.get(url, (res) => {
        resolve(res.statusCode !== undefined);
        req.destroy();
      });
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    } catch { resolve(false); }
  });
}
