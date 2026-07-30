/**
 * eval/vendor/mbpp-vendor.js — Vendor MBPP dataset
 * =================================================
 * MBPP: 974 Python programming problems (Google Research, CC BY 4.0).
 * Source: https://github.com/google-research/google-research/tree/master/mbpp
 *
 * The vendored data file is committed at:
 *   eval/benchmarks/mbpp/data/mbpp.json
 *
 * This script re-vendors from upstream if the data file is absent or corrupted.
 * Once vendored (or after git clone), eval runs FULLY OFFLINE.
 *
 * Usage:
 *   node eval/vendor/mbpp-vendor.js          # re-vendor if needed
 *   node eval/vendor/mbpp-vendor.js --force  # always re-download
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT     = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'benchmarks', 'mbpp', 'data');
const OUT_FILE = join(DATA_DIR, 'mbpp.json');
const SOURCE   = 'https://raw.githubusercontent.com/google-research/google-research/master/mbpp/mbpp.jsonl';

mkdirSync(DATA_DIR, { recursive: true });

const force = process.argv.includes('--force');

if (!force && existsSync(OUT_FILE)) {
  try {
    const data = JSON.parse(readFileSync(OUT_FILE, 'utf-8'));
    if (Array.isArray(data) && data.length > 0 && data[0].task_id) {
      console.log(`[mbpp-vendor] Already vendored: ${data.length} problems at ${OUT_FILE}`);
      console.log('[mbpp-vendor] Eval runs offline. Use --force to re-download.');
      process.exit(0);
    }
  } catch { /* corrupted — re-vendor */ }
}

console.log('[mbpp-vendor] Downloading MBPP from GitHub (requires internet)...');
console.log(`[mbpp-vendor] Source: ${SOURCE}`);

const res  = await fetch(SOURCE);
if (!res.ok) throw new Error(`HTTP ${res.status} ${SOURCE}`);
const text = await res.text();

const problems = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
writeFileSync(OUT_FILE, JSON.stringify(problems, null, 2));
console.log(`[mbpp-vendor] ✓ Vendored ${problems.length} problems → ${OUT_FILE}`);
console.log('[mbpp-vendor] Commit this file for fully offline operation.');
