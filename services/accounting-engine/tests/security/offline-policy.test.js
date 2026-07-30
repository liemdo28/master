// tests/security/offline-policy.test.js - Enforce offline/local-only policy
import { describe, test, expect } from '@jest/globals';
import { readFileSync }            from 'fs';
import { join, dirname }          from 'path';
import { fileURLToPath }          from 'url';
import { maskSecrets }            from '../../core/AuditLedger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '../..');

function readSrc(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

describe('API bind address policy', () => {
  test('server.js binds ONLY to 127.0.0.1, never 0.0.0.0', () => {
    const src = readSrc('api/server.js');
    expect(src).toContain("'127.0.0.1'");
    expect(src).not.toContain("'0.0.0.0'");
  });

  test('server.js uses port 8844', () => {
    const src = readSrc('api/server.js');
    expect(src).toContain('8844');
  });

  test('CLI api command binds to 127.0.0.1:8844', () => {
    const src = readSrc('bin/accounting.js');
    expect(src).toContain('127.0.0.1');
    expect(src).toContain('8844');
  });
});

describe('No outbound internet in source', () => {
  const FILES_TO_CHECK = [
    'core/DatabaseManager.js',
    'core/AuditLedger.js',
    'core/PatchLedger.js',
    'core/QAAccounting.js',
    'collectors/BatchWriter.js',
    'collectors/ResourceMonitor.js',
    'api/server.js',
  ];

  const BANNED_PATTERNS = [
    /https?:\/\/(?!127\.0\.0\.1|localhost)/,  // any external URL
    /fetch\s*\(/,                              // fetch() (outbound HTTP)
    /axios/,                                   // HTTP client
    /node-fetch/,                              // another HTTP client
    /telemetry/i,
    /google-analytics|gtag\(|segment\.com|mixpanel|amplitude\.com/i,  // external analytics SDKs (local analytics routes are permitted)
    /sentry\.io/i,
    /datadog/i,
  ];

  for (const file of FILES_TO_CHECK) {
    for (const pattern of BANNED_PATTERNS) {
      test(`${file} has no banned pattern: ${pattern}`, () => {
        const src = readSrc(file);
        expect(pattern.test(src)).toBe(false);
      });
    }
  }
});

describe('Secret masking', () => {
  test('maskSecrets hides api_key', () => {
    const secretValue = ['super', 'secret', 'value', '12345'].join('-');
    const masked = maskSecrets({ api_key: secretValue });
    expect(masked).not.toContain(secretValue);
    expect(masked).toContain('[MASKED]');
  });

  test('maskSecrets hides password field', () => {
    const masked = maskSecrets('password=hunter2hunter2');
    expect(masked).not.toContain('hunter2');
  });

  test('maskSecrets hides sk- style API keys', () => {
    const key = ['sk', 'abcdefghijklmnopqrstuvwxyz123456'].join('-');
    const masked = maskSecrets(key);
    expect(masked).not.toContain(key);
  });

  test('maskSecrets hides GitHub personal tokens', () => {
    const masked = maskSecrets('ghp_' + 'A'.repeat(36));
    expect(masked).not.toContain('ghp_' + 'A'.repeat(36));
  });

  test('maskSecrets hides AWS access key IDs', () => {
    const key = 'AKIA' + 'IOSFODNN7EXAMPLE';
    const masked = maskSecrets(key);
    expect(masked).not.toContain(key);
  });
});

describe('No GPU/NVIDIA dependency', () => {
  test('ResourceMonitor does not import nvidia or gpu libraries', () => {
    const src = readSrc('collectors/ResourceMonitor.js');
    expect(src).not.toContain('nvidia');
    expect(src).not.toContain('@gpu');
    expect(src).not.toContain('cuda');
    expect(src).not.toContain('nvml');
  });

  test('gpu_mb field is always null in sampled rows', async () => {
    const { ResourceMonitor } = await import('../../collectors/ResourceMonitor.js');
    const rows = [];
    const fakeWriter = { enqueue: (_, row) => rows.push(row) };
    const mon = new ResourceMonitor(fakeWriter, { intervalMs: 10 });
    mon._sample();
    expect(rows[0].gpu_mb).toBeNull();
  });
});
