/**
 * File Packager — bundles multiple output files into a ZIP for delivery.
 * Uses built-in Node.js zlib + tar, or AdmZip if available.
 */

import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';

const OUTPUT_DIR = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'action-outputs', 'packages'
);

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export interface PackageResult {
  path: string;
  filename: string;
  files_included: number;
  size_bytes: number;
  method: string;
}

export async function packageFiles(params: {
  files: string[];
  package_name: string;
}): Promise<PackageResult> {
  ensureDir();
  const safe = params.package_name.replace(/[^a-zA-Z0-9_\-]/g, '_');

  // Try AdmZip
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    let included = 0;
    for (const f of params.files) {
      if (fs.existsSync(f)) { zip.addLocalFile(f); included++; }
    }
    const zipPath = path.join(OUTPUT_DIR, safe + '.zip');
    zip.writeZip(zipPath);
    return { path: zipPath, filename: safe + '.zip', files_included: included, size_bytes: fs.statSync(zipPath).size, method: 'adm-zip' };
  } catch { /* fallback */ }

  // Fallback: write manifest file listing all paths
  const manifest = params.files.filter(f => fs.existsSync(f));
  const manifestPath = path.join(OUTPUT_DIR, safe + '_manifest.txt');
  fs.writeFileSync(manifestPath, manifest.join('\n'), 'utf8');
  return {
    path: manifestPath,
    filename: safe + '_manifest.txt',
    files_included: manifest.length,
    size_bytes: fs.statSync(manifestPath).size,
    method: 'manifest-only (install adm-zip for zip support)',
  };
}
