import type { EvidenceCategory, EvidenceFreshness } from './types';

/** Per-category TTL, in minutes. Point-in-time historical records (decisions, approvals,
 *  executions, side effects) use a generous window since "freshness" there means
 *  recency-for-digest-purposes, not correctness. Live-probed health decays fastest.
 *  Never a single one-size-fits-all TTL (directive §6D.5). Knowledge facts prefer the
 *  source document's own STALE signal over time-decay — see normalize.ts — so they are
 *  not listed here. */
const TTL_MINUTES: Partial<Record<EvidenceCategory, { fresh: number; aging: number }>> = {
  HEALTH: { fresh: 5, aging: 30 },
  DECISION: { fresh: 60, aging: 24 * 60 },
  APPROVAL: { fresh: 60, aging: 24 * 60 },
  EXECUTION: { fresh: 60, aging: 24 * 60 },
  SIDE_EFFECT: { fresh: 60, aging: 24 * 60 },
  POLICY: { fresh: 60, aging: 24 * 60 },
  CONFLICT: { fresh: 24 * 60, aging: 7 * 24 * 60 },
};
const DEFAULT_TTL = { fresh: 60, aging: 24 * 60 };

/** Pure. Never fabricates a timestamp — an unparseable/missing observedAt is UNKNOWN,
 *  never silently treated as FRESH. */
export function classifyFreshness(observedAt: string | null | undefined, category: EvidenceCategory, now: Date): EvidenceFreshness {
  if (!observedAt) return 'UNKNOWN';
  const t = new Date(observedAt).getTime();
  if (Number.isNaN(t)) return 'UNKNOWN';
  const ageMinutes = (now.getTime() - t) / 60_000;
  if (ageMinutes < 0) return 'UNKNOWN'; // future-dated source data — never claim freshness for it
  const ttl = TTL_MINUTES[category] ?? DEFAULT_TTL;
  if (ageMinutes <= ttl.fresh) return 'FRESH';
  if (ageMinutes <= ttl.aging) return 'AGING';
  return 'STALE';
}
