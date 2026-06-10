/**
 * eval/vendor/humaneval-vendor.js — Vendor HumanEval dataset
 * ===========================================================
 * HumanEval: 164 Python programming problems (OpenAI, MIT License).
 * Source: https://github.com/openai/human-eval
 *
 * The vendored data file is committed at:
 *   eval/benchmarks/humaneval/data/humaneval.json
 *
 * This script re-vendors from upstream if the data file is absent or corrupted.
 * Once vendored (or after git clone), eval runs FULLY OFFLINE.
 *
 * Usage:
 *   node eval/vendor/humaneval-vendor.js          # re-vendor if needed
 *   node eval/vendor/humaneval-vendor.js --force  # always re-download
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gunzipSync } from 'zlib';

const ROOT     = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'benchmarks', 'humaneval', 'data');
const OUT_FILE = join(DATA_DIR, 'humaneval.json');
const SOURCE   = 'https://raw.githubusercontent.com/openai/human-eval/refs/heads/master/data/HumanEval.jsonl.gz';

mkdirSync(DATA_DIR, { recursive: true });

const force = process.argv.includes('--force');

// Check if already vendored and valid
if (!force && existsSync(OUT_FILE)) {
  try {
    const data = JSON.parse(readFileSync(OUT_FILE, 'utf-8'));
    if (Array.isArray(data) && data.length > 0 && data[0].task_id) {
      console.log(`[humaneval-vendor] Already vendored: ${data.length} problems at ${OUT_FILE}`);
      console.log('[humaneval-vendor] Eval runs offline. Use --force to re-download.');
      process.exit(0);
    }
  } catch { /* corrupted — re-vendor */ }
}

console.log('[humaneval-vendor] Downloading HumanEval from GitHub (requires internet)...');
console.log(`[humaneval-vendor] Source: ${SOURCE}`);

const res  = await fetch(SOURCE);
if (!res.ok) throw new Error(`HTTP ${res.status} ${SOURCE}`);
const buf  = await res.arrayBuffer();
const text = gunzipSync(Buffer.from(buf)).toString('utf-8');

const problems = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
writeFileSync(OUT_FILE, JSON.stringify(problems, null, 2));
console.log(`[humaneval-vendor] ✓ Vendored ${problems.length} problems → ${OUT_FILE}`);
console.log('[humaneval-vendor] Commit this file for fully offline operation.');
