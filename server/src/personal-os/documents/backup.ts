/**
 * Backup/restore foundation for the Personal OS database (Phase 5D-2 §22).
 *
 * Uses SQLite's online backup API so a consistent copy can be taken without stopping the
 * process or locking out writers — the same mechanism used for every migration proof in
 * Phase 5D. This never touches the source database: `backupDatabase` only ever reads it.
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

export interface BackupResult {
  sourcePath: string;
  destPath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupVerification {
  integrityCheck: string;
  foreignKeyViolations: number;
  schemaVersion: number;
  documents: number;
  chunks: number;
  ftsRows: number;
  conflicts: number;
  relations: number;
}

/** Takes a consistent online-backup copy of `sourcePath` at `destPath`. Read-only on the source. */
export async function backupDatabase(sourcePath: string, destPath: string): Promise<BackupResult> {
  if (!fs.existsSync(sourcePath)) throw new Error('source database does not exist');
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (fs.existsSync(destPath)) fs.rmSync(destPath, { force: true });

  const source = new Database(sourcePath, { readonly: true });
  try {
    await source.backup(destPath);
  } finally {
    source.close();
  }

  return {
    sourcePath, destPath,
    sizeBytes: fs.statSync(destPath).size,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Opens the backup copy read-only and confirms it is internally consistent and that the
 * Phase 5D-2 index/conflict/relation tables came along with it — a backup that can't be
 * verified this way is not a backup, just a file.
 */
export function verifyBackup(destPath: string): BackupVerification {
  const db = new Database(destPath, { readonly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get() as Record<string, string>;
    const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
    const schemaVersion = (db.prepare('SELECT MAX(version) v FROM schema_migrations').get() as { v: number | null }).v ?? 0;
    const count = (table: string): number => (db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as { c: number }).c;
    return {
      integrityCheck: Object.values(integrity)[0],
      foreignKeyViolations: fkViolations.length,
      schemaVersion,
      documents: count('knowledge_documents'),
      chunks: count('knowledge_chunks'),
      ftsRows: count('knowledge_chunks_fts'),
      conflicts: count('knowledge_conflicts'),
      relations: count('knowledge_relations'),
    };
  } finally {
    db.close();
  }
}

/** Restores a backup by copying it into place as the new live database file. Caller must
 *  ensure no store has the destination open when this runs. Never touches `backupPath`. */
export function restoreFromBackup(backupPath: string, liveDbPath: string): void {
  if (!fs.existsSync(backupPath)) throw new Error('backup file does not exist');
  fs.mkdirSync(path.dirname(liveDbPath), { recursive: true });
  fs.copyFileSync(backupPath, liveDbPath);
  for (const suffix of ['-wal', '-shm']) {
    const stale = `${liveDbPath}${suffix}`;
    if (fs.existsSync(stale)) fs.rmSync(stale, { force: true });
  }
}
