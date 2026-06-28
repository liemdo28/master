/**
 * durable-store.ts — Phase 2D+ durable persistence.
 *
 * A tiny, portable, append-friendly JSON table. Each store is one JSON file
 * holding an array of records. Survives process restart (the gap Phase 2D
 * deferred — its registries were in-memory Maps). Portable: the data dir is
 * resolved relative to opts/env, never a hard-coded OS path.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';

export function resolveApprovalDataDir(override?: string): string {
  return (
    override ||
    process.env.MI_APPROVAL_DATA_DIR ||
    join(__dirname, '..', '..', '..', '.local-agent-global', 'production-approval')
  );
}

export class DurableStore<T extends { id: string }> {
  readonly path: string;
  private records: T[] = [];

  constructor(name: string, dataDir: string) {
    this.path = join(dataDir, `${name}.json`);
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.path)) {
        const parsed = JSON.parse(readFileSync(this.path, 'utf8'));
        this.records = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      this.records = [];
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.records, null, 2));
  }

  insert(record: T): T {
    this.records.push(record);
    this.persist();
    return record;
  }

  update(id: string, patch: Partial<T>): T | null {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.records[idx] = { ...this.records[idx], ...patch };
    this.persist();
    return this.records[idx];
  }

  get(id: string): T | null {
    return this.records.find((r) => r.id === id) ?? null;
  }

  filter(predicate: (r: T) => boolean): T[] {
    return this.records.filter(predicate);
  }

  all(): T[] {
    return [...this.records];
  }

  count(): number {
    return this.records.length;
  }

  /** Test isolation only. */
  destroy(): void {
    try {
      if (existsSync(this.path)) rmSync(this.path, { force: true });
    } catch {
      /* noop */
    }
    this.records = [];
  }
}
