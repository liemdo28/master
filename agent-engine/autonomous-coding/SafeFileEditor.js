import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { toAbsoluteInside } from './PatchSafetyPolicy.js';

export class SafeFileEditor {
  constructor({ workspaceRoot, backupRoot } = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot || process.cwd());
    this.backupRoot = path.resolve(backupRoot || path.join(this.workspaceRoot, '.backups'));
  }

  read(filePath) {
    const { absolute, relative } = toAbsoluteInside(this.workspaceRoot, filePath);
    return { absolute, relative, exists: existsSync(absolute), content: existsSync(absolute) ? readFileSync(absolute, 'utf8') : null };
  }

  backup(filePath, phase, patchId) {
    const current = this.read(filePath);
    if (!current.exists) return { ...current, backupPath: null };
    const backupPath = path.join(this.backupRoot, patchId, phase, current.relative);
    mkdirSync(path.dirname(backupPath), { recursive: true });
    copyFileSync(current.absolute, backupPath);
    return { ...current, backupPath };
  }

  write(filePath, content, { patchId = 'PATCH-UNKNOWN' } = {}) {
    const before = this.backup(filePath, 'before', patchId);
    const { absolute, relative } = toAbsoluteInside(this.workspaceRoot, filePath);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, 'utf8');
    const after = this.backup(relative, 'after', patchId);
    return {
      filePath: relative,
      absolutePath: absolute,
      beforeContent: before.content,
      afterContent: content,
      beforeBackupPath: before.backupPath,
      afterBackupPath: after.backupPath,
    };
  }

  restore(filePath, patchId) {
    const { absolute, relative } = toAbsoluteInside(this.workspaceRoot, filePath);
    const backupPath = path.join(this.backupRoot, patchId, 'before', relative);
    if (!existsSync(backupPath)) return { ok: false, error: `backup not found: ${backupPath}` };
    mkdirSync(path.dirname(absolute), { recursive: true });
    copyFileSync(backupPath, absolute);
    return { ok: true, filePath: relative, restoredFrom: backupPath };
  }
}
