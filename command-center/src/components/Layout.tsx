import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api-client';
import type { ActionProposal } from '@/lib/types';
import { CommandPalette } from './CommandPalette';

export const NAV_ITEMS = [
  { to: '/today', label: 'Today', key: 'g t' },
  { to: '/goals', label: 'Goals', key: 'g g' },
  { to: '/approvals', label: 'Approvals', key: 'g a' },
  { to: '/actions', label: 'Actions', key: 'g x' },
  { to: '/governance', label: 'Governance', key: 'g v' },
  { to: '/plans', label: 'Plans', key: 'g l' },
  { to: '/delegations', label: 'Delegations', key: 'g d' },
  { to: '/projects', label: 'Projects', key: 'g p' },
  { to: '/tasks', label: 'Tasks', key: 'g k' },
  { to: '/knowledge', label: 'Knowledge', key: 'g n' },
  { to: '/memory', label: 'Memory', key: 'g m' },
  { to: '/calendar', label: 'Calendar', key: 'g c' },
  { to: '/inbox', label: 'Inbox', key: 'g i' },
  { to: '/coding', label: 'Coding', key: 'g d' },
  { to: '/health', label: 'Health', key: 'g h' },
  { to: '/reviews', label: 'Reviews', key: 'g r' },
  { to: '/operator', label: 'Operator', key: 'g o' },
  { to: '/authority', label: 'Authority', key: 'g y' },
  { to: '/settings', label: 'Settings', key: 'g s' },
] as const;

export function Layout() {
  const { logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['actions-nav-count'],
    queryFn: () => api.get<{ actions: ActionProposal[] }>('/actions'),
    refetchInterval: 30_000,
  });
  const pendingActions = (data?.actions ?? []).filter(action => ['WAITING_APPROVAL', 'APPROVED', 'EXECUTING'].includes(action.status)).length;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-full">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-(--color-accent) focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <nav aria-label="Primary" className="flex w-56 shrink-0 flex-col border-r border-(--color-border) bg-(--color-surface) p-3">
        <div className="mb-4 px-2 py-1">
          <span className="text-sm font-semibold tracking-wide text-(--color-text)">Mi Command Center</span>
        </div>
        <ul className="flex-1 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-(--color-accent)/15 text-(--color-accent) font-medium'
                      : 'text-(--color-text-dim) hover:bg-white/5 hover:text-(--color-text)'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.to === '/actions' && pendingActions > 0 ? (
                  <span className="float-right rounded bg-(--color-accent) px-1.5 text-xs text-white">{pendingActions}</span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-2 flex items-center justify-between rounded-md border border-(--color-border) px-2 py-1.5 text-xs text-(--color-text-faint) hover:border-(--color-accent)"
        >
          <span>Search / Commands</span>
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono">Ctrl K</kbd>
        </button>
        <button
          onClick={logout}
          className="rounded-md px-2 py-1.5 text-left text-sm text-(--color-text-faint) hover:bg-white/5 hover:text-(--color-text)"
        >
          Lock session
        </button>
      </nav>
      <main id="main-content" className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
