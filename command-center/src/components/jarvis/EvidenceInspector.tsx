import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api-client';
import type { EvidenceRecord } from '@/lib/types';
import { parseEvidenceRef } from '@/lib/jarvis-workspace';
import { EmptyState } from '@/components/States';

/**
 * Directive §7 — reuses Phase 6D EvidenceService exclusively via its
 * existing GET /evidence/:id route (which itself hardcodes
 * redactionClassAtMost server-side — this component never bypasses that,
 * it only renders whatever the router already decided is operator-safe).
 * `evidenceRefs` may also contain Jarvis Gateway's own short-prefix
 * pointers (`task:<id>`, `plan:<id>`, ...) which are not real Evidence
 * Service ids — those render as a direct link to the canonical page
 * instead of an Evidence fetch (see parseEvidenceRef).
 */
export function EvidenceInspector({ evidenceRefs }: { evidenceRefs: string[] }) {
  const parsed = evidenceRefs.map(parseEvidenceRef);
  const recordRefs = parsed.filter(p => p.kind === 'evidence-record');

  const results = useQueries({
    queries: recordRefs.map(p => ({
      queryKey: ['evidence', p.id],
      queryFn: () => api.get<{ evidence: EvidenceRecord }>(`/evidence/${encodeURIComponent(p.id)}`),
      staleTime: 60_000,
    })),
  });

  if (evidenceRefs.length === 0) {
    return <EmptyState title="No evidence" hint="This response has no associated evidence references." />;
  }

  return (
    <section aria-label="Evidence" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Evidence</h2>
      <ul className="space-y-2">
        {parsed.map(p => {
          if (p.kind !== 'evidence-record') {
            return (
              <li key={p.raw} className="rounded border border-(--color-border) p-2 text-sm">
                <Link to={p.linkTo!} className="text-(--color-accent) underline">
                  Open {p.kind} {p.id}
                </Link>
              </li>
            );
          }
          const idx = recordRefs.indexOf(p);
          const result = results[idx];
          if (result.isLoading) {
            return <li key={p.raw} className="text-xs text-(--color-text-faint)">Loading evidence {p.id}…</li>;
          }
          if (result.isError || !result.data) {
            return (
              <li key={p.raw} className="rounded border border-(--color-border) p-2 text-xs text-(--color-text-faint)">
                Evidence {p.id} is not available (redacted, expired, or not found).
              </li>
            );
          }
          const e = result.data.evidence;
          return (
            <li key={p.raw} className="rounded border border-(--color-border) p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-text-faint)">
                <span>{e.category}</span>
                <span>·</span>
                <span>{e.sourceSystem}</span>
                <span>·</span>
                <span>{e.confidence}</span>
                <span>·</span>
                <span>{e.freshness}</span>
              </div>
              <p className="mt-1 text-(--color-text-dim)">{e.claim}</p>
              <p className="mt-1 text-xs text-(--color-text-faint)">{new Date(e.observedAt).toLocaleString()}</p>
              {e.conflictGroup && (
                <p className="mt-1 text-xs text-(--color-attention)">Part of an open conflict group.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
