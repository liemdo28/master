// Phase 21 — Executive Operating System
// TopBar Component

import React from 'react';
import type { NavigationLevel } from './ExecutiveShell';

interface TopBarProps {
  level: NavigationLevel;
  onLevelChange: (level: NavigationLevel) => void;
  developerMode: boolean;
  onDeveloperModeToggle: () => void;
}

export function TopBar({ level, onLevelChange, developerMode, onDeveloperModeToggle }: TopBarProps) {
  const levels: { key: NavigationLevel; label: string }[] = [
    { key: 'executive', label: 'Executive' },
    { key: 'business', label: 'Business' },
    { key: 'technical', label: 'Technical' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50">
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-xl font-semibold text-slate-900 dark:text-white hidden sm:block">
              Mi
            </span>
          </div>

          {/* Developer Mode Badge */}
          {developerMode && (
            <span className="px-2 py-1 text-xs font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
              [TECH]
            </span>
          )}
        </div>

        {/* Level Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          {levels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onLevelChange(key)}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${level === key
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* User Menu */}
        <div className="flex items-center gap-3">
          {/* Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Live
            </span>
          </div>

          {/* Settings */}
          <button
            onClick={onDeveloperModeToggle}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            title={developerMode ? 'Exit Developer Mode' : 'Developer Mode'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* User Avatar */}
          <button className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-medium text-sm">
            S
          </button>
        </div>
      </div>

      {/* Mobile Level Navigation */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 h-14">
        {levels.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onLevelChange(key)}
            className={`
              flex flex-col items-center gap-0.5 px-4 py-2 text-xs
              ${level === key
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 dark:text-slate-400'
              }
            `}
          >
            <span className="text-sm">{label}</span>
            {level === key && (
              <span className="w-6 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </header>
  );
}
