// Phase 21 — Executive Operating System
// Bottom Navigation Component (Mobile)

import React from 'react';
import type { NavigationLevel } from './ExecutiveShell';

interface BottomNavProps {
  level: NavigationLevel;
  currentView: string;
  onViewChange: (view: string) => void;
  notificationCount?: number;
}

export function BottomNav({ level, currentView, onViewChange, notificationCount = 0 }: BottomNavProps) {
  const tabs = [
    { id: 'mission', label: 'Home', icon: 'home' },
    { id: 'health', label: 'Health', icon: 'shield' },
    { id: 'insights', label: 'Insights', icon: 'lightning' },
    { id: 'approvals', label: 'Approvals', icon: 'check', badge: notificationCount },
  ];

  const getIcon = (icon: string, isActive: boolean) => {
    const color = isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400';
    const strokeWidth = isActive ? 2.5 : 2;

    switch (icon) {
      case 'home':
        return (
          <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'shield':
        return (
          <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'lightning':
        return (
          <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'check':
        return (
          <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Mobile Bottom Nav - Fixed at bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 safe-area-bottom">
        {/* Haptic feedback indicator line */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
        
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => {
            const isActive = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`
                  flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl
                  transition-all duration-200 active:scale-95
                  ${isActive 
                    ? 'text-indigo-600 dark:text-indigo-400' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }
                `}
              >
                {/* Icon with optional badge */}
                <div className="relative">
                  {getIcon(tab.icon, isActive)}
                  {tab.badge && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                
                {/* Label */}
                <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {tab.label}
                </span>
                
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute -bottom-2 w-1 h-1 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Safe area padding for notch devices */}
        <div 
          className="h-[env(safe-area-inset-bottom)] bg-white dark:bg-slate-900"
          style={{ height: 'env(safe-area-inset-bottom)' }}
        />
      </nav>

      {/* Spacer to prevent content from being hidden behind bottom nav */}
      <div className="md:hidden h-20" />
    </>
  );
}
