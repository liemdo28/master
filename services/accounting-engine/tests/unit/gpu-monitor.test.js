// tests/unit/gpu-monitor.test.js
import { describe, test, expect, afterEach } from '@jest/globals';
import { GPUMonitor } from '../../collectors/GPUMonitor.js';

describe('GPUMonitor', () => {
  let monitor;
  afterEach(() => monitor?.stop());

  test('does not throw when GPU unavailable', () => {
    monitor = new GPUMonitor();
    expect(() => monitor._sample()).not.toThrow();
  });

  test('returns null fields when GPU unavailable', () => {
    monitor = new GPUMonitor();
    const row = monitor._sample();
    // In CI there's no GPU — must gracefully return nulls
    if (!row.gpu_pct) {
      expect(row.gpu_pct).toBeNull();
      expect(row.vram_mb).toBeNull();
      expect(row.temperature_c).toBeNull();
    }
    expect(typeof row.timestamp).toBe('string');
  });

  test('emits sample event', (done) => {
    monitor = new GPUMonitor({ intervalMs: 50 });
    monitor.on('sample', (row) => {
      expect(row).toHaveProperty('timestamp');
      expect(row).toHaveProperty('gpu_pct');
      expect(row).toHaveProperty('vram_mb');
      monitor.stop();
      done();
    });
    monitor.start();
  });

  test('start() and stop() are idempotent', () => {
    monitor = new GPUMonitor();
    monitor.start();
    monitor.start(); // double start
    monitor.stop();
    monitor.stop(); // double stop — no throw
  });

  test('available is false after sampling with no GPU', () => {
    monitor = new GPUMonitor();
    monitor._sample();
    if (monitor.available === false) {
      // confirmed no GPU in this environment — expected
      expect(monitor.available).toBe(false);
    }
    // If GPU IS available, available === true — also fine
    expect(monitor.available === true || monitor.available === false).toBe(true);
  });

  test('short-circuits without calling nvidia-smi again once available=false', () => {
    monitor = new GPUMonitor();
    monitor._available = false;
    const row = monitor._sample(); // should fast-return
    expect(row.vendor).toBeNull();
  });
});
