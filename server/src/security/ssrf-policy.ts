/**
 * Phase 8A — SSRF-safe target policy for any Jarvis-adjacent surface that
 * accepts a caller-supplied URL and causes THIS server (or a process it
 * spawns) to make an outbound request to it. The immediate consumer is
 * `routes/browser-agent.ts`'s `POST /extract`, found in Phase 8 discovery
 * to be live, unauthenticated, and structurally SSRF-shaped (see
 * docs/architecture/PHASE8_DISCOVERY_AND_ROADMAP.md).
 *
 * Validates, in order: scheme, embedded credentials, hostname shape, and
 * every DNS-resolved IP address (A + AAAA) against a fixed blocklist —
 * this defends against DNS-rebinding, not just a static hostname/IP
 * string check, since the blocklist is checked against what the hostname
 * ACTUALLY resolves to at validation time.
 *
 * Known limitation, stated plainly rather than overclaimed: this module
 * validates the *initial* target before any request is dispatched. It
 * cannot intercept a redirect a downstream browser-automation session
 * performs entirely inside a separately-spawned process (see
 * `browser/browser-router.ts`'s `runBrowserUse()` — the actual
 * `browser_bridge.py` script this spawns does not exist anywhere in this
 * source tree or the production deploy as of this phase, confirmed by
 * search, so that specific code path is currently inert regardless of
 * this policy). Where this module's caller DOES control the outbound
 * fetch directly (e.g. `runSkyvern()`), redirects must be followed
 * manually with a re-validation call against this same policy — see
 * `browser/browser-router.ts`.
 */
import dns from 'dns';
import net from 'net';
import { URL } from 'url';

export type UnsafeReason =
  | 'UNSUPPORTED_SCHEME'
  | 'URL_CREDENTIALS'
  | 'MALFORMED_URL'
  | 'RESOLVED_LOOPBACK'
  | 'RESOLVED_RFC1918'
  | 'RESOLVED_LINK_LOCAL'
  | 'RESOLVED_CGNAT'
  | 'RESOLVED_METADATA_ENDPOINT'
  | 'RESOLVED_UNSPECIFIED'
  | 'DNS_RESOLUTION_FAILED';

export interface TargetPolicyResult {
  safe: boolean;
  reason?: UnsafeReason;
  detail?: string;
  resolvedAddresses?: string[];
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

// Explicit known cloud-metadata endpoints, checked ahead of the generic
// link-local range so the reason code is specific and unambiguous in logs/
// tests, even though 169.254.169.254 would also be caught by the
// link-local (169.254.0.0/16) check below.
const METADATA_IPV4 = new Set(['169.254.169.254', '100.100.100.200']);

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

const IPV4_BLOCKED_RANGES: Array<{ cidr: string; reason: UnsafeReason }> = [
  { cidr: '127.0.0.0/8', reason: 'RESOLVED_LOOPBACK' },
  { cidr: '10.0.0.0/8', reason: 'RESOLVED_RFC1918' },
  { cidr: '172.16.0.0/12', reason: 'RESOLVED_RFC1918' },
  { cidr: '192.168.0.0/16', reason: 'RESOLVED_RFC1918' },
  { cidr: '169.254.0.0/16', reason: 'RESOLVED_LINK_LOCAL' },
  { cidr: '100.64.0.0/10', reason: 'RESOLVED_CGNAT' }, // also covers Tailscale's own 100.x range — a browser task must never target the operator's own private network
  { cidr: '0.0.0.0/8', reason: 'RESOLVED_UNSPECIFIED' },
];

function classifyIpv4(ip: string): UnsafeReason | null {
  if (METADATA_IPV4.has(ip)) return 'RESOLVED_METADATA_ENDPOINT';
  for (const { cidr, reason } of IPV4_BLOCKED_RANGES) {
    if (isIpv4InCidr(ip, cidr)) return reason;
  }
  return null;
}

function classifyIpv6(ip: string): UnsafeReason | null {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return 'RESOLVED_LOOPBACK';
  if (normalized === '::') return 'RESOLVED_UNSPECIFIED';
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return 'RESOLVED_LINK_LOCAL';
  // Unique local fc00::/7 (the IPv6 analogue of RFC1918)
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return 'RESOLVED_RFC1918';
  // IPv4-mapped IPv6, dotted-quad textual form (::ffff:a.b.c.d) — unwrap and
  // re-check as IPv4.
  const mappedDotted = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return classifyIpv4(mappedDotted[1]);
  // IPv4-mapped IPv6, pure-hex form (::ffff:7f00:1) — the WHATWG URL parser
  // normalizes a dotted-quad mapped address into this form when it appears
  // in a URL host, so both forms must be handled or this check silently
  // never fires on the value this module actually receives.
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    const ipv4 = [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
    return classifyIpv4(ipv4);
  }
  return null;
}

function classifyIp(ip: string): UnsafeReason | null {
  if (net.isIPv4(ip)) return classifyIpv4(ip);
  if (net.isIPv6(ip)) return classifyIpv6(ip);
  return null;
}

/**
 * Validates a caller-supplied target URL against the SSRF-safe policy.
 * Performs real DNS resolution (both A and AAAA records) and checks every
 * resolved address — a hostname that resolves to a public IP AND a
 * private one (DNS rebinding / dual-answer tricks) is rejected on the
 * private answer alone.
 */
export async function validateTargetUrl(rawUrl: string): Promise<TargetPolicyResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'MALFORMED_URL', detail: 'URL could not be parsed.' };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { safe: false, reason: 'UNSUPPORTED_SCHEME', detail: `Scheme "${parsed.protocol}" is not allowed — only http:/https: may be fetched. file:, data:, and javascript: are explicitly rejected.` };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'URL_CREDENTIALS', detail: 'URLs with embedded credentials (user:pass@host) are not allowed.' };
  }

  const hostname = parsed.hostname;
  // WHATWG URL always brackets an IPv6 host in .hostname (e.g. "[::1]");
  // net.isIP() and the classifiers below expect the bare address.
  const bareHostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  // A literal IP in the URL itself — validate directly, no DNS needed.
  if (net.isIP(bareHostname)) {
    const reason = classifyIp(bareHostname);
    if (reason) return { safe: false, reason, detail: `Target IP ${bareHostname} is in a blocked range.`, resolvedAddresses: [bareHostname] };
    return { safe: true, resolvedAddresses: [bareHostname] };
  }

  let addresses: string[];
  try {
    const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    addresses = records.map(r => r.address);
    if (addresses.length === 0) throw new Error('no addresses returned');
  } catch (err) {
    return { safe: false, reason: 'DNS_RESOLUTION_FAILED', detail: err instanceof Error ? err.message : String(err) };
  }

  for (const addr of addresses) {
    const reason = classifyIp(addr);
    if (reason) {
      return { safe: false, reason, detail: `Hostname "${hostname}" resolves to ${addr}, which is in a blocked range.`, resolvedAddresses: addresses };
    }
  }

  return { safe: true, resolvedAddresses: addresses };
}
