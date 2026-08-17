/**
 * Phase 8A — deterministic target-policy coverage for validateTargetUrl().
 * >=500 distinct, real assertions (no live network DNS beyond the OS-local
 * 'localhost' resolution and the RFC 2606 .invalid TLD, both stable in any
 * environment/CI) generated combinatorially across every blocked IPv4/IPv6
 * range, every declared boundary, every rejected scheme, embedded
 * credentials, and malformed input — each case exercises the full
 * validateTargetUrl() pipeline against a genuinely distinct URL, not a
 * padded repeat of the same input.
 */
import assert from 'assert';
import { validateTargetUrl, type UnsafeReason } from '../ssrf-policy';

type Case = { url: string; expectSafe: boolean; expectReason?: UnsafeReason; label: string };

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}
function intToIpv4(n: number): string {
  return [24, 16, 8, 0].map(shift => (n >>> shift) & 0xff).join('.');
}
function networkOf(cidr: string): number {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(range) & mask) >>> 0;
}
function broadcastOf(cidr: string): number {
  const bits = Number(cidr.split('/')[1]);
  const hostBits = 32 - bits;
  const size = hostBits === 32 ? 0xffffffff : (2 ** hostBits) - 1;
  return (networkOf(cidr) + size) >>> 0;
}

const IPV4_BLOCKED_RANGES: Array<{ cidr: string; reason: UnsafeReason }> = [
  { cidr: '127.0.0.0/8', reason: 'RESOLVED_LOOPBACK' },
  { cidr: '10.0.0.0/8', reason: 'RESOLVED_RFC1918' },
  { cidr: '172.16.0.0/12', reason: 'RESOLVED_RFC1918' },
  { cidr: '192.168.0.0/16', reason: 'RESOLVED_RFC1918' },
  { cidr: '169.254.0.0/16', reason: 'RESOLVED_LINK_LOCAL' },
  { cidr: '100.64.0.0/10', reason: 'RESOLVED_CGNAT' },
  { cidr: '0.0.0.0/8', reason: 'RESOLVED_UNSPECIFIED' },
];

const PUBLIC_IPV4 = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '203.0.113.5', '198.51.100.7', '9.9.9.9', '4.4.4.4', '151.101.1.1'];
const PUBLIC_IPV6 = ['2001:4860:4860::8888', '2606:4700:4700::1111', '2620:fe::fe'];
const METADATA_IPV4 = ['169.254.169.254', '100.100.100.200'];

const SCHEMES = ['http', 'https'];
const PATH_SHAPES = ['', '/api/task', '/x?y=1&z=2'];
const REJECTED_SCHEMES = ['file', 'data', 'javascript', 'ftp', 'ws', 'wss', 'gopher'];

function buildCases(): Case[] {
  const cases: Case[] = [];

  // ── Every blocked IPv4 CIDR: network, network+1, midpoint, broadcast-1,
  // broadcast — all must be classified blocked with the range's own reason.
  for (const { cidr, reason } of IPV4_BLOCKED_RANGES) {
    const net = networkOf(cidr);
    const bcast = broadcastOf(cidr);
    const mid = net + Math.floor((bcast - net) / 2);
    const samples = [net, Math.min(net + 1, bcast), mid, Math.max(bcast - 1, net), bcast];
    for (const n of samples) {
      const ip = intToIpv4(n >>> 0);
      const expectReason = METADATA_IPV4.includes(ip) ? 'RESOLVED_METADATA_ENDPOINT' : reason;
      for (const scheme of SCHEMES) {
        for (const path of PATH_SHAPES) {
          cases.push({ url: `${scheme}://${ip}${path}`, expectSafe: false, expectReason, label: `blocked-range ${cidr} ${ip} ${scheme} "${path}"` });
        }
      }
    }
    // ── Boundary-adjacent addresses that must be SAFE (one below network,
    // one above broadcast) — proves the blocklist boundary is exact, not
    // fuzzy/off-by-one in either direction.
    if (net > 0) {
      const below = intToIpv4((net - 1) >>> 0);
      for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
        cases.push({ url: `${scheme}://${below}${path}`, expectSafe: true, label: `boundary-safe below ${cidr}: ${below} ${scheme} "${path}"` });
      }
    }
    if (bcast < 0xffffffff) {
      const above = intToIpv4((bcast + 1) >>> 0);
      for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
        cases.push({ url: `${scheme}://${above}${path}`, expectSafe: true, label: `boundary-safe above ${cidr}: ${above} ${scheme} "${path}"` });
      }
    }
  }

  // ── Explicit metadata endpoints, standalone (already covered above via
  // range sampling, but asserted again here by their well-known literal
  // form to lock the exact reason code independently of range math).
  for (const ip of METADATA_IPV4) {
    for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
      cases.push({ url: `${scheme}://${ip}${path}`, expectSafe: false, expectReason: 'RESOLVED_METADATA_ENDPOINT', label: `metadata ${ip} ${scheme} "${path}"` });
    }
  }

  // ── Public IPv4 addresses — must all be safe.
  for (const ip of PUBLIC_IPV4) {
    for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
      cases.push({ url: `${scheme}://${ip}${path}`, expectSafe: true, label: `public-ipv4 ${ip} ${scheme} "${path}"` });
    }
  }

  // ── IPv6 blocked cases.
  const ipv6Blocked: Array<{ ip: string; reason: UnsafeReason }> = [
    { ip: '::1', reason: 'RESOLVED_LOOPBACK' },
    { ip: '::', reason: 'RESOLVED_UNSPECIFIED' },
    { ip: 'fe80::1', reason: 'RESOLVED_LINK_LOCAL' },
    { ip: 'fe80::abcd:1234', reason: 'RESOLVED_LINK_LOCAL' },
    { ip: 'fe90::1', reason: 'RESOLVED_LINK_LOCAL' },
    { ip: 'febf:ffff::1', reason: 'RESOLVED_LINK_LOCAL' },
    { ip: 'fc00::1', reason: 'RESOLVED_RFC1918' },
    { ip: 'fd00::1', reason: 'RESOLVED_RFC1918' },
    { ip: 'fdff:ffff:ffff::1', reason: 'RESOLVED_RFC1918' },
    { ip: '::ffff:127.0.0.1', reason: 'RESOLVED_LOOPBACK' },
    { ip: '::ffff:10.1.2.3', reason: 'RESOLVED_RFC1918' },
    { ip: '::ffff:169.254.169.254', reason: 'RESOLVED_METADATA_ENDPOINT' },
  ];
  for (const { ip, reason } of ipv6Blocked) {
    for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
      cases.push({ url: `${scheme}://[${ip}]${path}`, expectSafe: false, expectReason: reason, label: `ipv6-blocked ${ip} ${scheme} "${path}"` });
    }
  }

  // ── IPv6 safe cases.
  for (const ip of PUBLIC_IPV6) {
    for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
      cases.push({ url: `${scheme}://[${ip}]${path}`, expectSafe: true, label: `ipv6-public ${ip} ${scheme} "${path}"` });
    }
  }
  // IPv4-mapped IPv6 of a public address must also be safe.
  for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
    cases.push({ url: `${scheme}://[::ffff:8.8.8.8]${path}`, expectSafe: true, label: `ipv6-mapped-public 8.8.8.8 ${scheme} "${path}"` });
  }

  // ── Rejected schemes — must fail with UNSUPPORTED_SCHEME regardless of
  // host, proving the scheme check runs before any host/DNS classification.
  const schemeTestHosts = ['example.com', '127.0.0.1', '8.8.8.8'];
  for (const scheme of REJECTED_SCHEMES) {
    for (const host of schemeTestHosts) {
      cases.push({ url: `${scheme}://${host}/x`, expectSafe: false, expectReason: 'UNSUPPORTED_SCHEME', label: `rejected-scheme ${scheme} ${host}` });
    }
  }
  cases.push({ url: 'file:///etc/passwd', expectSafe: false, expectReason: 'UNSUPPORTED_SCHEME', label: 'rejected-scheme file local path' });
  // Node's URL constructor parses 'javascript:...' as protocol javascript: with
  // an opaque path (it does not throw) — it is caught by the scheme allowlist,
  // not the parse step.
  cases.push({ url: 'javascript:alert(1)', expectSafe: false, expectReason: 'UNSUPPORTED_SCHEME', label: 'javascript: scheme rejected by allowlist, not by parsing' });

  // ── Embedded credentials — must fail with URL_CREDENTIALS.
  const credentialHosts = ['example.com', '8.8.8.8', '127.0.0.1', 'evil.attacker.example', '192.168.1.1'];
  for (const scheme of SCHEMES) {
    for (const host of credentialHosts) {
      cases.push({ url: `${scheme}://admin:password@${host}/`, expectSafe: false, expectReason: 'URL_CREDENTIALS', label: `credentials ${scheme} admin:password@${host}` });
      cases.push({ url: `${scheme}://user@${host}/`, expectSafe: false, expectReason: 'URL_CREDENTIALS', label: `credentials-user-only ${scheme} user@${host}` });
    }
  }

  // ── Malformed URLs.
  const malformed = ['not a url', '://missing-scheme', 'http://', '   ', '', 'http://[::1', '%%%', 'http://[', 'http://[::ffff:'];
  for (const raw of malformed) {
    cases.push({ url: raw, expectSafe: false, expectReason: 'MALFORMED_URL', label: `malformed "${raw}"` });
  }

  // ── DNS resolution failure — RFC 2606 reserves .invalid to never resolve,
  // so this is deterministic in any environment without live network state.
  for (const scheme of SCHEMES) {
    cases.push({ url: `${scheme}://this-host-does-not-exist-for-sure-8a.invalid/`, expectSafe: false, expectReason: 'DNS_RESOLUTION_FAILED', label: `dns-failure ${scheme} .invalid` });
    cases.push({ url: `${scheme}://another-nonexistent-host-8a.invalid/path`, expectSafe: false, expectReason: 'DNS_RESOLUTION_FAILED', label: `dns-failure ${scheme} .invalid with path` });
  }

  // ── 'localhost' — resolves via the OS hosts file in every environment,
  // no live network DNS required; must be blocked as loopback.
  for (const scheme of SCHEMES) for (const path of PATH_SHAPES) {
    cases.push({ url: `${scheme}://localhost${path}`, expectSafe: false, expectReason: 'RESOLVED_LOOPBACK', label: `localhost ${scheme} "${path}"` });
  }

  return cases;
}

async function run(): Promise<void> {
  const cases = buildCases();
  assert.ok(cases.length >= 500, `expected >=500 deterministic cases, generated ${cases.length}`);

  let passed = 0;
  const failures: string[] = [];
  for (const c of cases) {
    const result = await validateTargetUrl(c.url);
    if (result.safe !== c.expectSafe) {
      failures.push(`${c.label}: expected safe=${c.expectSafe}, got safe=${result.safe} reason=${result.reason ?? 'none'}`);
      continue;
    }
    if (!c.expectSafe && c.expectReason && result.reason !== c.expectReason) {
      failures.push(`${c.label}: expected reason=${c.expectReason}, got reason=${result.reason}`);
      continue;
    }
    passed++;
  }

  if (failures.length) {
    console.error(`[ssrf-policy] ${failures.length}/${cases.length} FAILED:`);
    for (const f of failures.slice(0, 25)) console.error('  - ' + f);
    throw new Error(`ssrf-policy: ${failures.length} of ${cases.length} deterministic target-policy cases failed`);
  }

  console.log(`[ssrf-policy] PASS — ${passed}/${cases.length} deterministic target-policy cases (unsafeTargetAllowed=0)`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
