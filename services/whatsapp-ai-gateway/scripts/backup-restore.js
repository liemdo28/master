#!/usr/bin/env node
/**
 * Backup / Restore CLI
 *
 * Usage:
 *   node scripts/backup-restore.js export [--out data/backup]
 *   node scripts/backup-restore.js validate <file>
 *   node scripts/backup-restore.js import <file> [--mode merge|replace] [--apply]
 *   node scripts/backup-restore.js list
 *
 * By default, `import` runs in dry-run mode (no DB writes). Pass `--apply`
 * to actually write. `merge` (default) preserves existing rows with the
 * same natural key; `replace` truncates the target tables first.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite = require('../src/storage/sqlite');
const backup = require('../src/backup/backup-service');

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function cmdExport(args) {
  let outDir = 'data/backup';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outDir = args[++i];
  }
  const { filePath, payload } = await backup.writeExportToDisk({ outDir });
  printJson({
    ok: true,
    filePath,
    schema_version: payload.schema_version,
    counts: payload.counts,
    template_cache_meta: payload.template_cache_meta,
    checksum_sha256: payload.checksum_sha256,
  });
  await sqlite.close();
}

async function cmdValidate(args) {
  const file = args[0];
  if (!file) throw new Error('validate requires a file path');
  const payload = backup.readImportFile(path.resolve(file));
  const v = backup.validateImport(payload);
  printJson({ ok: v.ok, errors: v.errors, counts: payload.counts });
  await sqlite.close();
  if (!v.ok) process.exit(1);
}

async function cmdImport(args) {
  let file = null;
  let mode = 'merge';
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode') mode = args[++i];
    else if (args[i] === '--apply') apply = true;
    else if (!file) file = args[i];
  }
  if (!file) throw new Error('import requires a file path');
  const payload = backup.readImportFile(path.resolve(file));
  if (!apply) {
    const dry = await backup.dryRunImport(payload);
    printJson({ ok: dry.validation.ok, dry_run: true, validation: dry.validation, diff: dry.diff });
    await sqlite.close();
    if (!dry.validation.ok) process.exit(1);
    return;
  }
  const result = await backup.applyImport(payload, { mode });
  printJson({ ok: result.ok, applied: result.applied, mode, errors: result.errors });
  await sqlite.close();
  if (!result.ok) process.exit(1);
}

async function cmdList() {
  const dir = path.resolve('./data/backup');
  if (!fs.existsSync(dir)) {
    printJson({ ok: true, files: [], note: 'data/backup does not exist yet' });
    await sqlite.close();
    return;
  }
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('waig-config-') && f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(dir, f));
      return { file: f, size_bytes: stat.size, mtime: stat.mtime.toISOString() };
    });
  printJson({ ok: true, dir, count: files.length, files });
  await sqlite.close();
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  try {
    if (cmd === 'export') return await cmdExport(rest);
    if (cmd === 'validate') return await cmdValidate(rest);
    if (cmd === 'import') return await cmdImport(rest);
    if (cmd === 'list') return await cmdList();
    printJson({
      ok: false,
      error: 'unknown command',
      usage: {
        export: 'node scripts/backup-restore.js export [--out data/backup]',
        validate: 'node scripts/backup-restore.js validate <file>',
        import: 'node scripts/backup-restore.js import <file> [--mode merge|replace] [--apply]',
        list: 'node scripts/backup-restore.js list',
      },
    });
    process.exit(2);
  } catch (err) {
    printJson({ ok: false, error: err.message, stack: err.stack });
    try { await sqlite.close(); } catch (_) {}
    process.exit(1);
  }
}

main();
