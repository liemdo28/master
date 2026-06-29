/**
 * evidence-idempotency.ts
 * Ensures evidence files are written idempotently.
 */
import { existsSync, writeFileSync } from 'fs';

export interface IdempotentWriteResult {
  written: boolean;
  existing: boolean;
  path: string;
}

const writtenChecksums = new Map<string, string>();

export function writeEvidenceIdempotent(path: string, content: object, checksum: string): IdempotentWriteResult {
  if (existsSync(path)) {
    const existingChecksum = writtenChecksums.get(path);
    if (existingChecksum === checksum) {
      return { written: false, existing: true, path };
    }
  }
  writeFileSync(path, JSON.stringify(content, null, 2));
  writtenChecksums.set(path, checksum);
  return { written: true, existing: false, path };
}

export function clearChecksum(path: string): void {
  writtenChecksums.delete(path);
}
