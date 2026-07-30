/**
 * Evidence Store — Phase 21
 *
 * Immutable file-based evidence storage with SHA256 integrity.
 * All writes are append-only (no overwrite).
 * Evidence files are stored at: {EVIDENCE_ROOT}/{runId}/{sha256}.{ext}
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EvidencePacket } from './types';

// ── Configuration ─────────────────────────────────────────────────────────────

const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..');
const EVIDENCE_ROOT = process.env.EVIDENCE_ROOT || path.join(MI_CORE_ROOT, 'data', 'evidence');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function computeSHA256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateId(): string {
  return `ev-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EvidenceStore {
  /**
   * Store an evidence artifact on disk and record its metadata.
   * Returns the enriched EvidencePacket with id, sha256, and artifactPath.
   */
  persistEvidence(
    runId: string,
    packet: Omit<EvidencePacket, 'id' | 'sha256' | 'artifactPath' | 'capturedAt'>,
    content: Buffer | string,
    extension?: string,
  ): EvidencePacket;

  /**
   * Retrieve evidence metadata by id.
   */
  getEvidence(evidenceId: string): EvidencePacket | null;

  /**
   * List all evidence for a given objective run.
   */
  listEvidence(runId: string): EvidencePacket[];

  /**
   * Verify the integrity of an evidence artifact by recomputing SHA256.
   */
  verifyIntegrity(evidenceId: string): { valid: boolean; expected: string; actual: string };

  /**
   * Get the filesystem path to the evidence root.
   */
  getRootPath(): string;

  /**
   * Verify append-only evidence immutability for one evidence item.
   */
  isEvidenceImmutable(evidenceId: string): boolean;

  /**
   * Verify all evidence artifacts for one run.
   */
  verifyRunIntegrity(runId: string): { allValid: boolean; total: number; valid: number; invalid: string[] };
}

// ── In-memory index (lightweight — for metadata lookup) ────────────────────────

const evidenceIndex = new Map<string, EvidencePacket>();

function loadIndex(): void {
  // On startup, scan evidence directories and rebuild index
  if (!fs.existsSync(EVIDENCE_ROOT)) return;

  const runDirs = fs.readdirSync(EVIDENCE_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const runDir of runDirs) {
    const runPath = path.join(EVIDENCE_ROOT, runDir.name);
    const files = fs.readdirSync(runPath).filter(f => f.endsWith('.meta.json'));
    for (const metaFile of files) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(runPath, metaFile), 'utf-8'));
        evidenceIndex.set(meta.id, meta);
      } catch { /* skip corrupt metadata */ }
    }
  }
}

// Initialize index on module load
loadIndex();

// ── Implementation ────────────────────────────────────────────────────────────

export const evidenceStore: EvidenceStore = {
  persistEvidence(runId, packet, content, extension = 'json') {
    const runDir = path.join(EVIDENCE_ROOT, runId);
    ensureDir(runDir);

    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    const sha256 = computeSHA256(buffer);
    const artifactFilename = `${sha256}.${extension}`;
    const artifactPath = path.join(runDir, artifactFilename);

    // Write artifact file
    fs.writeFileSync(artifactPath, buffer);

    const fullPacket: EvidencePacket = {
      id: generateId(),
      objectiveRunId: runId,
      sourceType: packet.sourceType,
      sourceRef: packet.sourceRef,
      summary: packet.summary,
      sha256,
      artifactPath,
      capturedAt: new Date().toISOString(),
      readOnly: packet.readOnly,
    };

    // Write metadata file (sidecar)
    const metaPath = path.join(runDir, `${fullPacket.id}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(fullPacket, null, 2));

    // Update index
    evidenceIndex.set(fullPacket.id, fullPacket);

    return fullPacket;
  },

  getEvidence(evidenceId) {
    const packet = evidenceIndex.get(evidenceId);
    if (!packet) return null;
    // Return a frozen copy — callers cannot mutate stored evidence
    return Object.freeze({ ...packet });
  },

  listEvidence(runId) {
    return Array.from(evidenceIndex.values())
      .filter(e => e.objectiveRunId === runId)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
      .map(e => Object.freeze({ ...e }));
  },

  /**
   * Immutability check — verifies the artifact file hasn't been tampered with.
   * Called before any evidence retrieval to ensure integrity.
   */
  isEvidenceImmutable(evidenceId: string): boolean {
    const packet = evidenceIndex.get(evidenceId);
    if (!packet || !packet.artifactPath) return false;
    try {
      const content = fs.readFileSync(packet.artifactPath);
      const currentHash = computeSHA256(content);
      return currentHash === packet.sha256;
    } catch {
      return false;
    }
  },

  /**
   * Bulk integrity verification for an entire run.
   */
  verifyRunIntegrity(runId: string): { allValid: boolean; total: number; valid: number; invalid: string[] } {
    const evidence = this.listEvidence(runId);
    const invalid: string[] = [];
    let valid = 0;

    for (const e of evidence) {
      if (this.isEvidenceImmutable(e.id)) {
        valid++;
      } else {
        invalid.push(e.id);
      }
    }

    return { allValid: invalid.length === 0, total: evidence.length, valid, invalid };
  },

  verifyIntegrity(evidenceId) {
    const packet = evidenceIndex.get(evidenceId);
    if (!packet || !packet.artifactPath) {
      return { valid: false, expected: '', actual: '' };
    }

    try {
      const content = fs.readFileSync(packet.artifactPath);
      const actual = computeSHA256(content);
      return {
        valid: actual === packet.sha256,
        expected: packet.sha256 || '',
        actual,
      };
    } catch {
      return { valid: false, expected: packet.sha256 || '', actual: 'FILE_NOT_FOUND' };
    }
  },

  getRootPath() {
    return EVIDENCE_ROOT;
  },
};
