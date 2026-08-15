/**
 * Phase 7B — per-dimension health probes. Each function reuses an existing
 * canonical implementation rather than re-checking the dependency itself:
 * - DATABASE/evidence: SelfHeal's cached scan (company-os/self-healing-monitor.ts)
 * - AUTHORITY: the same generateAuthorityManifest() /api/authority/status uses
 * - KNOWLEDGE: personal-os/documents' own stats/quality-summary logic
 * - GOOGLE_CONNECTORS: visibility/connectors/google/google-auth.ts's getAuthStatus()
 * - NODE_AGENT: nodes/node-registry.ts + SelfHeal's PM2 check
 *
 * No probe here starts, stops, or restarts anything. Read-only.
 */
import fs from 'fs';
import path from 'path';
import type { DependencyHealth, DependencyId, DependencyState, ReasonCode } from './types';
import { getLastScanResults, checkPm2Service, MONITORED_SERVICES } from '../company-os/self-healing-monitor';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function dep(
  id: DependencyId,
  state: DependencyState,
  criticality: DependencyHealth['criticality'],
  reasonCode: ReasonCode,
  detail: string,
  capabilityImpact: string[],
  timestamps?: { lastCheckedAt?: string | null; lastHealthyAt?: string | null; lastFailureAt?: string | null },
): DependencyHealth {
  return {
    id, state, criticality, reasonCode, detail, capabilityImpact,
    lastCheckedAt: timestamps?.lastCheckedAt ?? null,
    lastHealthyAt: timestamps?.lastHealthyAt ?? null,
    lastFailureAt: timestamps?.lastFailureAt ?? null,
  };
}

function scanEntry(id: string) {
  const { results, scannedAt } = getLastScanResults();
  const entry = results?.find(r => r.id === id) ?? null;
  return { entry, scannedAt };
}

// ── CORE ──────────────────────────────────────────────────────────────────────
export function probeCore(): DependencyHealth {
  // This function executing at all inside the mi-core process is itself proof
  // CORE is up — there is no meaningful "check" beyond that for the process
  // serving this very request.
  return dep('CORE', 'HEALTHY', 'REQUIRED_FOR_CORE', 'OK', 'mi-core process is serving this request.', [], { lastCheckedAt: new Date().toISOString(), lastHealthyAt: new Date().toISOString() });
}

// ── DATABASE ──────────────────────────────────────────────────────────────────
export function probeDatabase(): DependencyHealth {
  const { entry, scannedAt } = scanEntry('knowledge-db');
  if (!entry) {
    return dep('DATABASE', 'UNKNOWN', 'REQUIRED_FOR_CORE', 'UNKNOWN', 'No SelfHeal scan has completed yet since process start.', ['Personal OS data availability unconfirmed.']);
  }
  const state: DependencyState = entry.healthy ? 'HEALTHY' : 'UNAVAILABLE';
  return dep(
    'DATABASE', state, 'REQUIRED_FOR_CORE',
    entry.healthy ? 'OK' : 'DB_INTEGRITY_FAILED',
    entry.healthy ? 'personal-os.db integrity_check=ok, 0 FK violations (last SelfHeal scan).' : 'personal-os.db failed its last integrity check.',
    entry.healthy ? [] : ['Task/project/goal reads and writes are unreliable until this is resolved.'],
    { lastCheckedAt: scannedAt, lastHealthyAt: entry.last_healthy_at ?? null, lastFailureAt: entry.last_failure_at ?? null },
  );
}

// ── AUTHORITY ─────────────────────────────────────────────────────────────────
export function probeAuthority(): DependencyHealth {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateAuthorityManifest } = require('../authority-control-plane/scanner');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveAuthorityRepoRoot } = require('../authority-control-plane/source-provenance');
    const manifest = generateAuthorityManifest(resolveAuthorityRepoRoot(path.resolve(__dirname, '..', '..')));
    const unknown = manifest.counts?.unknownMutations ?? -1;
    const unresolved = manifest.counts?.unresolvedLegacyMutations ?? -1;
    const now = new Date().toISOString();

    // Hard rule (§13): unknownMutations>0 or unresolvedLegacyMutations>0 must make
    // AUTHORITY unhealthy/blocking — never averaged away, never a soft warning.
    if (unknown > 0) {
      return dep('AUTHORITY', 'UNAVAILABLE', 'REQUIRED_FOR_CORE', 'AUTHORITY_UNKNOWN_MUTATION',
        `${unknown} unknown mutation surface(s) detected — authority boundary is invalid.`,
        ['Governed action execution must not be trusted until this is resolved.'], { lastCheckedAt: now });
    }
    if (unresolved > 0) {
      return dep('AUTHORITY', 'UNAVAILABLE', 'REQUIRED_FOR_CORE', 'AUTHORITY_UNRESOLVED_LEGACY_MUTATION',
        `${unresolved} unresolved legacy mutation(s) detected — authority boundary is invalid.`,
        ['Governed action execution must not be trusted until this is resolved.'], { lastCheckedAt: now });
    }
    return dep('AUTHORITY', 'HEALTHY', 'REQUIRED_FOR_CORE', 'OK',
      `unknownMutations=0, unresolvedLegacyMutations=0, total=${manifest.counts?.total ?? 'unknown'}.`, [],
      { lastCheckedAt: now, lastHealthyAt: now });
  } catch (err) {
    return dep('AUTHORITY', 'UNKNOWN', 'REQUIRED_FOR_CORE', 'UNKNOWN',
      `Could not generate authority manifest: ${err instanceof Error ? err.message : String(err)}`,
      ['Authority state cannot be confirmed.']);
  }
}

// ── PROVENANCE (folded into AUTHORITY's detail, §18) ────────────────────────────
export function probeProvenance(): { ok: boolean; detail: string } {
  try {
    const deployedSha = process.env.MI_DEPLOYED_SOURCE_SHA;
    const deployedRoot = process.env.MI_DEPLOYED_SOURCE_ROOT;
    if (!deployedSha || !deployedRoot) return { ok: false, detail: 'MI_DEPLOYED_SOURCE_SHA/_ROOT not set.' };
    const snapshotManifestPath = path.join(REPO_ROOT, 'server', 'snapshot-manifest.json');
    if (!fs.existsSync(snapshotManifestPath)) return { ok: false, detail: 'snapshot-manifest.json not found.' };
    const snapshotManifest = JSON.parse(fs.readFileSync(snapshotManifestPath, 'utf8')) as { deployedSha?: string };
    if (snapshotManifest.deployedSha !== deployedSha) {
      return { ok: false, detail: `provenance mismatch: .env says ${deployedSha}, snapshot-manifest.json says ${snapshotManifest.deployedSha ?? 'missing'}.` };
    }
    return { ok: true, detail: `provenance aligned at ${deployedSha}.` };
  } catch (err) {
    return { ok: false, detail: `provenance check failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── KNOWLEDGE ─────────────────────────────────────────────────────────────────
export function probeKnowledge(): DependencyHealth {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DocumentStore } = require('../personal-os/documents/store');
    const store = new DocumentStore();
    try {
      const stats = store.stats();
      const activeDocs = store.listDocuments('ACTIVE', 500).length;
      const now = new Date().toISOString();
      if (stats.documents === 0) {
        return dep('KNOWLEDGE', 'HEALTHY', 'OPTIONAL_DEGRADED', 'INDEX_EMPTY',
          'Knowledge index has 0 documents — this is a valid empty state, not a failure.',
          ['Knowledge search will return no-answer/unknown for all queries until documents are ingested.'],
          { lastCheckedAt: now, lastHealthyAt: now });
      }
      return dep('KNOWLEDGE', 'HEALTHY', 'OPTIONAL_DEGRADED', 'OK',
        `${stats.documents} document(s), ${stats.chunks} chunk(s), ${activeDocs} active.`, [],
        { lastCheckedAt: now, lastHealthyAt: now });
    } finally {
      store.close();
    }
  } catch (err) {
    return dep('KNOWLEDGE', 'UNAVAILABLE', 'OPTIONAL_DEGRADED', 'INDEX_UNAVAILABLE',
      `Knowledge store unreachable: ${err instanceof Error ? err.message : String(err)}`,
      ['Knowledge search unavailable; deterministic non-knowledge features unaffected.']);
  }
}

// ── PYTHON_AI ─────────────────────────────────────────────────────────────────
export async function probePythonAi(): Promise<DependencyHealth> {
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4002';
  const now = new Date().toISOString();
  try {
    const res = await fetch(`${AI_SERVICE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return dep('PYTHON_AI', 'HEALTHY', 'FEATURE_SCOPED', 'OK',
        'ai-service process responds. Note: no canonical generation path currently calls it — real generation goes Node→Ollama directly.',
        [], { lastCheckedAt: now, lastHealthyAt: now });
    }
    return dep('PYTHON_AI', 'DEGRADED', 'FEATURE_SCOPED', 'PROCESS_NOT_RUNNING', `ai-service responded ${res.status}.`, ['ai-service-dependent features unavailable — none are currently canonical.'], { lastCheckedAt: now });
  } catch {
    return dep('PYTHON_AI', 'UNAVAILABLE', 'FEATURE_SCOPED', 'PROCESS_NOT_RUNNING', 'ai-service unreachable.', ['ai-service-dependent features unavailable — none are currently canonical.'], { lastCheckedAt: now });
  }
}

// ── LOCAL_MODEL (Ollama) ──────────────────────────────────────────────────────
export async function probeLocalModel(): Promise<DependencyHealth> {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const now = new Date().toISOString();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return dep('LOCAL_MODEL', 'HEALTHY', 'OPTIONAL_DEGRADED', 'OK', `Ollama reachable at ${OLLAMA_URL}.`, [], { lastCheckedAt: now, lastHealthyAt: now });
    }
    return dep('LOCAL_MODEL', 'UNAVAILABLE', 'OPTIONAL_DEGRADED', 'MODEL_UNAVAILABLE', `Ollama responded ${res.status}.`,
      ['Chat free-text generation, agentic coding generation, and SEO/content-generation skills are unavailable.', 'Deterministic features (daily briefing, task intelligence, knowledge search, authority/evidence/simulation) are unaffected.'],
      { lastCheckedAt: now });
  } catch {
    return dep('LOCAL_MODEL', 'UNAVAILABLE', 'OPTIONAL_DEGRADED', 'MODEL_UNAVAILABLE', `Ollama unreachable at ${OLLAMA_URL}.`,
      ['Chat free-text generation, agentic coding generation, and SEO/content-generation skills are unavailable.', 'Deterministic features (daily briefing, task intelligence, knowledge search, authority/evidence/simulation) are unaffected.'],
      { lastCheckedAt: now });
  }
}

// ── GOOGLE_CONNECTORS ─────────────────────────────────────────────────────────
export function probeGoogleConnectors(): DependencyHealth {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuthStatus } = require('../visibility/connectors/google/google-auth');
    const status = getAuthStatus() as { configured: boolean; has_tokens: boolean; status: string };
    const now = new Date().toISOString();
    if (status.status === 'connected') {
      return dep('GOOGLE_CONNECTORS', 'HEALTHY', 'FEATURE_SCOPED', 'OK', 'Google OAuth connected.', [], { lastCheckedAt: now, lastHealthyAt: now });
    }
    if (status.status === 'not_configured') {
      return dep('GOOGLE_CONNECTORS', 'DISCONNECTED', 'FEATURE_SCOPED', 'CONFIG_MISSING',
        'GOOGLE_CLIENT_ID/SECRET not configured.',
        ['Gmail draft creation and Calendar event creation are unavailable.', 'Simulation of these actions remains available (no real dispatch required).'],
        { lastCheckedAt: now });
    }
    return dep('GOOGLE_CONNECTORS', 'DISCONNECTED', 'FEATURE_SCOPED', 'OAUTH_DISCONNECTED',
      'Google OAuth client is configured but no token file exists — needs re-authorization.',
      ['Gmail draft creation and Calendar event creation are unavailable.', 'Simulation of these actions remains available (no real dispatch required).'],
      { lastCheckedAt: now });
  } catch (err) {
    return dep('GOOGLE_CONNECTORS', 'UNKNOWN', 'FEATURE_SCOPED', 'UNKNOWN', `Could not determine Google connector state: ${err instanceof Error ? err.message : String(err)}`, []);
  }
}

// ── NODE_AGENT ────────────────────────────────────────────────────────────────
export async function probeNodeAgent(): Promise<DependencyHealth> {
  const now = new Date().toISOString();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAllNodes } = require('../nodes/node-registry');
    const nodes = getAllNodes() as Array<{ node_id: string; status: string }>;
    const registered = nodes.find((n) => n.node_id === 'mi-core-primary' || n.status === 'online');

    const pm2Alive = await checkPm2Service({ id: 'mi-node-agent', name: 'mi-node-agent', type: 'pm2', pm2_name: 'mi-node-agent', critical: false });

    if (!pm2Alive) {
      return dep('NODE_AGENT', 'UNAVAILABLE', 'FEATURE_SCOPED', 'PROCESS_NOT_RUNNING', 'mi-node-agent PM2 process is not online.', ['Secondary-device coordination unavailable. Core mi-core functionality unaffected.'], { lastCheckedAt: now });
    }
    if (!registered) {
      // The process is alive (PM2 says online) but it never successfully
      // registered — this is the exact, known BLOCKED_RUNTIME state. The node
      // registry has no representable "blocked" status of its own (confirmed by
      // the Phase 7B discovery audit), so this is inferred from the combination
      // of "process alive" + "absent from registry", not fabricated.
      return dep('NODE_AGENT', 'BLOCKED', 'FEATURE_SCOPED', 'REGISTRATION_BLOCKED',
        'mi-node-agent process is running but has never successfully registered (registration/auth gap — not fixed in this phase).',
        ['Secondary-device coordination unavailable. Core mi-core functionality unaffected.'],
        { lastCheckedAt: now });
    }
    return dep('NODE_AGENT', 'HEALTHY', 'FEATURE_SCOPED', 'OK', 'mi-node-agent registered and online.', [], { lastCheckedAt: now, lastHealthyAt: now });
  } catch (err) {
    return dep('NODE_AGENT', 'UNKNOWN', 'FEATURE_SCOPED', 'UNKNOWN', `Could not determine node-agent state: ${err instanceof Error ? err.message : String(err)}`, []);
  }
}

// ── ACCOUNTING / QB_AGENT (PM2-backed, via SelfHeal's cache) ─────────────────
function probePm2Backed(id: DependencyId, scanId: string, capabilityIfDown: string): DependencyHealth {
  const { entry, scannedAt } = scanEntry(scanId);
  if (!entry) return dep(id, 'UNKNOWN', 'FEATURE_SCOPED', 'UNKNOWN', 'No SelfHeal scan has completed yet since process start.', []);
  return dep(id, entry.healthy ? 'HEALTHY' : 'UNAVAILABLE', 'FEATURE_SCOPED',
    entry.healthy ? 'OK' : 'PROCESS_NOT_RUNNING',
    entry.healthy ? `${scanId} is online.` : `${scanId} is not online.`,
    entry.healthy ? [] : [capabilityIfDown],
    { lastCheckedAt: scannedAt, lastHealthyAt: entry.last_healthy_at ?? null, lastFailureAt: entry.last_failure_at ?? null });
}

export function probeAccounting(): DependencyHealth {
  return probePm2Backed('ACCOUNTING', 'mi-accounting', 'Accounting reporting/reads unavailable.');
}
export function probeQbAgent(): DependencyHealth {
  return probePm2Backed('QB_AGENT', 'qb-ops-agent', 'QuickBooks heartbeat/workflow polling unavailable.');
}

// ── Phase 7F — VOICE_INPUT / VOICE_OUTPUT ────────────────────────────────────
// Both OPTIONAL_DEGRADED: voice unavailable never marks overall Jarvis DOWN
// (§25) — Command Center's text path is always fully available regardless
// of these two states.
export async function probeVoiceInput(): Promise<DependencyHealth> {
  const now = new Date().toISOString();
  const { isTranscriptionAvailable } = await import('../voice/transcription-service');
  try {
    const available = await isTranscriptionAvailable();
    return available
      ? dep('VOICE_INPUT', 'HEALTHY', 'OPTIONAL_DEGRADED', 'OK', 'Speech-to-text (local faster-whisper) is available.', [], { lastCheckedAt: now, lastHealthyAt: now })
      : dep('VOICE_INPUT', 'UNAVAILABLE', 'OPTIONAL_DEGRADED', 'MODEL_UNAVAILABLE', 'Speech-to-text is not available in this runtime.', ['Voice input (audio upload transcription) unavailable — typed/client-side transcript input still works normally.'], { lastCheckedAt: now });
  } catch (err) {
    return dep('VOICE_INPUT', 'UNKNOWN', 'OPTIONAL_DEGRADED', 'UNKNOWN', `Could not check speech-to-text availability: ${err instanceof Error ? err.message : String(err)}`, ['Voice input status unconfirmed — typed/client-side transcript input still works normally.'], { lastCheckedAt: now });
  }
}

export function probeVoiceOutput(): DependencyHealth {
  const now = new Date().toISOString();
  const { isTTSAvailable } = require('../voice/tts-service');
  const available: boolean = isTTSAvailable();
  return available
    ? dep('VOICE_OUTPUT', 'HEALTHY', 'OPTIONAL_DEGRADED', 'OK', 'Text-to-speech (local edge-tts) is available.', [], { lastCheckedAt: now, lastHealthyAt: now })
    : dep('VOICE_OUTPUT', 'UNAVAILABLE', 'OPTIONAL_DEGRADED', 'MODEL_UNAVAILABLE', 'Text-to-speech is not available in this runtime (set VOICE_TTS_ENABLED=1 to enable).', ['Spoken responses unavailable — the same answer is still fully shown as text.'], { lastCheckedAt: now });
}

// ── Intentionally-disabled services ──────────────────────────────────────────
const INTENTIONALLY_DISABLED_SERVICES: Record<'WHATSAPP' | 'N8N' | 'CEO_OBSERVER', { pm2Name: string; runtimeDir: string; capability: string }> = {
  WHATSAPP: { pm2Name: 'mi-whatsapp-gateway', runtimeDir: 'services/whatsapp-ai-gateway', capability: 'WhatsApp send/receive unavailable — intentionally disabled.' },
  N8N: { pm2Name: 'mi-n8n', runtimeDir: 'services/n8n-execution-bus', capability: 'n8n workflow execution unavailable — intentionally disabled.' },
  CEO_OBSERVER: { pm2Name: 'mi-ceo-observer', runtimeDir: 'services/mi-ceo-observer', capability: 'CEO WhatsApp signal ingestion unavailable — intentionally disabled.' },
};

export function probeIntentionallyDisabled(id: 'WHATSAPP' | 'N8N' | 'CEO_OBSERVER', runtimeRoot: string): DependencyHealth {
  const config = INTENTIONALLY_DISABLED_SERVICES[id];
  const codePresent = fs.existsSync(path.join(runtimeRoot, config.runtimeDir));
  const now = new Date().toISOString();
  return dep(
    id, 'INTENTIONALLY_DISABLED', 'INTENTIONALLY_DISABLED',
    codePresent ? 'INTENTIONALLY_DISABLED' : 'RUNTIME_NOT_DEPLOYED',
    codePresent
      ? `${config.pm2Name} is intentionally not started (operator decision, not a failure).`
      : `${config.pm2Name} is intentionally not started; additionally, its runtime code is not present at ${config.runtimeDir} (a separate, pre-existing gap, not caused by being disabled).`,
    [config.capability],
    { lastCheckedAt: now },
  );
}

export function allMonitoredServiceIds(): string[] {
  return MONITORED_SERVICES.map(s => s.id);
}
