// tests/unit/power-estimator.test.js
import { describe, test, expect, beforeEach } from '@jest/globals';
import { PowerEstimator } from '../../collectors/PowerEstimator.js';

describe('PowerEstimator', () => {
  let pe;
  beforeEach(() => { pe = new PowerEstimator({ cpuTdpWatts: 100, gpuTdpWatts: 200, baseWatts: 20 }); });

  test('instantWatts at 0% CPU/GPU returns only base', () => {
    const w = pe.instantWatts(0, 0);
    expect(w.cpu_w).toBe(0);
    expect(w.gpu_w).toBe(0);
    expect(w.base_w).toBe(20);
    expect(w.total_w).toBe(20);
  });

  test('instantWatts at 100% CPU returns full TDP', () => {
    const w = pe.instantWatts(100, null);
    expect(w.cpu_w).toBe(100);
    expect(w.gpu_w).toBe(0);
    expect(w.total_w).toBe(120); // 100 cpu + 20 base
  });

  test('instantWatts at 50% CPU + 50% GPU', () => {
    const w = pe.instantWatts(50, 50);
    expect(w.cpu_w).toBe(50);
    expect(w.gpu_w).toBe(100);
    expect(w.total_w).toBe(170);
  });

  test('getSession starts at 0 Wh', () => {
    const s = pe.getSession();
    expect(s.total_wh).toBe(0);
    expect(s.samples).toBe(0);
  });

  test('record() accumulates energy over time', async () => {
    pe.record(100, 0);
    await new Promise((r) => setTimeout(r, 100));
    pe.record(100, 0);
    const s = pe.getSession();
    expect(s.total_wh).toBeGreaterThan(0);
    expect(s.samples).toBe(2);
  });

  test('cost_usd is a positive number after recording', async () => {
    pe.record(50, 50);
    await new Promise((r) => setTimeout(r, 50));
    pe.record(50, 50);
    const s = pe.getSession();
    expect(typeof s.cost_usd).toBe('number');
    expect(s.cost_usd).toBeGreaterThanOrEqual(0);
  });

  test('reset() clears accumulated energy', async () => {
    pe.record(100, 100);
    await new Promise((r) => setTimeout(r, 50));
    pe.record(100, 100);
    pe.reset();
    const s = pe.getSession();
    expect(s.total_wh).toBe(0);
    expect(s.samples).toBe(0);
  });

  test('clamps CPU above 100% to 100', () => {
    const w = pe.instantWatts(150, 0);
    expect(w.cpu_w).toBe(100);
  });

  test('clamps negative CPU to 0', () => {
    const w = pe.instantWatts(-10, 0);
    expect(w.cpu_w).toBe(0);
  });
});
