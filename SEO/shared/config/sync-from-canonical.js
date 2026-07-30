#!/usr/bin/env node
/**
 * sync-from-canonical.js
 *
 * Keeps this directory's brands.json / locations.json in lockstep with the
 * canonical copies read by the live mi-core server (port 4001):
 *
 *   canonical:  <MI_CORE_ROOT>/SEO/shared/config/{brands,locations}.json
 *   mirror:     D:/Project/Master/SEO/shared/config/{brands,locations}.json  (this dir)
 *
 * Why a sync script instead of a real filesystem symlink/junction:
 * this repo has `core.symlinks=false` in its local git config (verified via
 * `git config core.symlinks`). With that setting, any real symlink committed
 * here gets silently flattened by git into a plain text file containing the
 * link-target path string on the next checkout/reset/stash — which would
 * corrupt these files (JSON.parse would choke on a bare path string). A
 * plain copy-on-demand script has no such failure mode and needs no
 * elevated privileges, junction support, or git config changes.
 *
 * Usage:
 *   node sync-from-canonical.js            # sync + print a report
 *   require('./sync-from-canonical')()      # programmatic use (e.g. from
 *                                            # validate-brand-config.js)
 *
 * The canonical root can be overridden with MI_CORE_ROOT, matching the env
 * var mi-core/server/src/seo/brand-config.ts already honors, so this script
 * and the live server always agree on where "canonical" points.
 */
const fs = require('fs');
const path = require('path');

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const CANONICAL_DIR = path.join(MI_CORE_ROOT, 'SEO', 'shared', 'config');
const MIRROR_DIR = __dirname;

const FILES = ['brands.json', 'locations.json'];

/**
 * Copies each canonical file over its mirror counterpart if content differs.
 * Returns a report array: [{ file, canonicalPath, mirrorPath, action, error? }]
 */
function syncFromCanonical({ silent = false } = {}) {
  const report = [];

  for (const file of FILES) {
    const canonicalPath = path.join(CANONICAL_DIR, file);
    const mirrorPath = path.join(MIRROR_DIR, file);
    const entry = { file, canonicalPath, mirrorPath, action: 'none' };

    try {
      if (!fs.existsSync(canonicalPath)) {
        entry.action = 'error';
        entry.error = `Canonical file missing: ${canonicalPath}`;
        report.push(entry);
        continue;
      }

      const canonicalContent = fs.readFileSync(canonicalPath, 'utf8');

      // Validate canonical content is parseable JSON before propagating it —
      // never mirror a half-written / corrupt canonical file.
      try {
        JSON.parse(canonicalContent);
      } catch (parseErr) {
        entry.action = 'error';
        entry.error = `Canonical file is not valid JSON, refusing to sync: ${parseErr.message}`;
        report.push(entry);
        continue;
      }

      const mirrorContent = fs.existsSync(mirrorPath) ? fs.readFileSync(mirrorPath, 'utf8') : null;

      if (mirrorContent === canonicalContent) {
        entry.action = 'unchanged';
      } else {
        fs.writeFileSync(mirrorPath, canonicalContent, 'utf8');
        entry.action = mirrorContent === null ? 'created' : 'updated';
      }
    } catch (e) {
      entry.action = 'error';
      entry.error = e.message;
    }

    report.push(entry);
  }

  if (!silent) {
    for (const entry of report) {
      if (entry.action === 'error') {
        console.error(`[sync-from-canonical] ${entry.file}: ERROR — ${entry.error}`);
      } else {
        console.log(`[sync-from-canonical] ${entry.file}: ${entry.action} (canonical -> mirror)`);
      }
    }
  }

  return report;
}

module.exports = syncFromCanonical;
module.exports.CANONICAL_DIR = CANONICAL_DIR;
module.exports.MIRROR_DIR = MIRROR_DIR;

if (require.main === module) {
  const report = syncFromCanonical();
  const hasErrors = report.some(r => r.action === 'error');
  process.exit(hasErrors ? 1 : 0);
}
