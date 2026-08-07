import { createContext, useContext, useState, type ReactNode } from 'react';

export interface EvidenceEntry {
  label: string;
  value: string;
}

interface EvidencePayload {
  title: string;
  entries: EvidenceEntry[];
}

interface EvidenceContextValue {
  open: (payload: EvidencePayload) => void;
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null);

/** §20 Evidence UX — every important fact should support "Why?". This never renders
 *  secrets, tokens, stack traces, or absolute paths; callers are responsible for only
 *  passing evidence entries that are already safe to display (evidence references
 *  like `task:<id>` / `doc:<id>`, timestamps, citation excerpts). */
export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<EvidencePayload | null>(null);

  return (
    <EvidenceContext.Provider value={{ open: setPayload }}>
      {children}
      {payload && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Evidence: ${payload.title}`}>
          <button
            aria-label="Close evidence panel"
            className="flex-1 bg-black/50"
            onClick={() => setPayload(null)}
          />
          <div className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-(--color-border) bg-(--color-surface-raised) p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-(--color-text)">Why? — {payload.title}</h2>
              <button
                onClick={() => setPayload(null)}
                className="rounded p-1 text-(--color-text-dim) hover:bg-white/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <dl className="space-y-3">
              {payload.entries.map((e, i) => (
                <div key={i}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-(--color-text-faint)">{e.label}</dt>
                  <dd className="mt-0.5 break-words font-mono text-sm text-(--color-text-dim)">{e.value}</dd>
                </div>
              ))}
              {payload.entries.length === 0 && (
                <p className="text-sm text-(--color-text-faint)">No evidence recorded for this item.</p>
              )}
            </dl>
          </div>
        </div>
      )}
    </EvidenceContext.Provider>
  );
}

export function useEvidence(): EvidenceContextValue {
  const ctx = useContext(EvidenceContext);
  if (!ctx) throw new Error('useEvidence must be used within EvidenceProvider');
  return ctx;
}

export function EvidenceButton({ title, entries }: EvidencePayload) {
  const { open } = useEvidence();
  return (
    <button
      onClick={() => open({ title, entries })}
      className="rounded-md border border-(--color-border) px-2 py-0.5 text-xs text-(--color-text-dim) hover:border-(--color-accent) hover:text-(--color-accent)"
    >
      Why?
    </button>
  );
}
