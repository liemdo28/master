'use strict';
/**
 * food-safety-zip-exporter.js
 * Zips an audit package directory.
 * Uses child_process + PowerShell Compress-Archive (Windows) or zip (Linux/Mac).
 */

const path = require('path');
const { execFile } = require('child_process');
const { makeLogger } = require('../logger');
const log = makeLogger('audit');

async function zipAuditPackage(packageDir) {
  if (!packageDir) throw new Error('packageDir required');
  const zipPath = packageDir.replace(/[\\/]+$/, '') + '.zip';

  await new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    if (isWin) {
      execFile('powershell.exe', [
        '-NoProfile', '-Command',
        `Compress-Archive -Path "${packageDir}\\*" -DestinationPath "${zipPath}" -Force`,
      ], { timeout: 30000 }, (err) => err ? reject(err) : resolve());
    } else {
      execFile('zip', ['-r', zipPath, path.basename(packageDir)], { cwd: path.dirname(packageDir), timeout: 30000 }, (err) => err ? reject(err) : resolve());
    }
  });

  log.info('Audit package zipped', { zipPath });
  return { ok: true, zipPath };
}

module.exports = { zipAuditPackage };
