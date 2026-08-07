import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { NAV_ITEMS } from './Layout';

interface Command {
  id: string;
  label: string;
  group: 'Navigate' | 'Refresh';
  run: () => void | Promise<void>;
}

/** §19 — command palette. Every command here is navigation, a read-refetch, or a
 *  local generate call that already exists as an idempotent GET/POST in the backend
 *  (morning brief / plan / EOD review, all safe to re-request). Nothing here sends,
 *  deploys, executes, merges, publishes, or deletes external data — there is no
 *  command that could, since the palette only ever calls navigate() or api.get/post
 *  against the same bounded set of Command Center read/generate endpoints every
 *  screen already uses. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const commands = useMemo<Command[]>(() => [
    ...NAV_ITEMS.map(item => ({
      id: `nav-${item.to}`,
      label: `Go to ${item.label}`,
      group: 'Navigate' as const,
      run: () => navigate(item.to),
    })),
    {
      id: 'refresh-today',
      label: 'Refresh today (detect changes since morning brief)',
      group: 'Refresh',
      run: async () => { await api.post('/operating/today/refresh'); queryClient.invalidateQueries({ queryKey: ['operating'] }); },
    },
    {
      id: 'generate-brief',
      label: 'Generate morning brief',
      group: 'Refresh',
      run: async () => { await api.post('/operating/today/generate'); queryClient.invalidateQueries({ queryKey: ['operating'] }); },
    },
    {
      id: 'generate-plan',
      label: 'Generate today’s plan',
      group: 'Refresh',
      run: async () => { await api.post('/operating/today/plan'); queryClient.invalidateQueries({ queryKey: ['operating'] }); },
    },
  ], [navigate, queryClient]);

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" role="dialog" aria-modal="true" aria-label="Command palette">
      <button aria-label="Close command palette" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-surface-raised) shadow-2xl">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          placeholder="Type a command or search…"
          className="w-full border-b border-(--color-border) bg-transparent px-4 py-3 text-sm text-(--color-text) outline-none"
        />
        <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-(--color-text-faint)">No matching commands.</li>}
          {filtered.map(c => (
            <li key={c.id}>
              <button
                onClick={async () => { await c.run(); onClose(); setQuery(''); }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-(--color-text-dim) hover:bg-(--color-accent)/10 hover:text-(--color-text)"
              >
                <span>{c.label}</span>
                <span className="text-xs text-(--color-text-faint)">{c.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
