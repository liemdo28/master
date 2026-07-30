// Phase 21 — Executive Operating System
// Business Health Cockpit Component

import React from 'react';
import type { DepartmentHealth } from './ExecutiveShell';
import { HealthBadge } from './HealthBadge';

interface BusinessHealthProps {
  departments: DepartmentHealth[];
}

export function BusinessHealth({ departments }: BusinessHealthProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-800';
      case 'warning':
        return 'from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-800';
      case 'critical':
        return 'from-red-500/10 to-red-500/5 border-red-200 dark:border-red-800';
      default:
        return 'from-slate-500/10 to-slate-500/5 border-slate-200 dark:border-slate-700';
    }
  };

  const getMetricColor = (trend: string, change: string) => {
    if (trend === 'up' || change.startsWith('+')) return 'text-emerald-600 dark:text-emerald-400';
    if (trend === 'down' || change.startsWith('-')) return 'text-red-600 dark:text-red-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Business Health
        </h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Live
          </span>
        </div>
      </div>

      {/* Health Grid - 3 columns on desktop, 2 on tablet, 1 on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className={`
              bg-gradient-to-br ${getStatusColor(dept.status)}
              rounded-2xl p-5 border backdrop-blur-sm
              hover:shadow-lg transition-all duration-200 cursor-pointer
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 dark:bg-white/10 rounded-xl flex items-center justify-center text-lg">
                  {dept.icon}
                </div>
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    {dept.name}
                  </h3>
                </div>
              </div>
              <HealthBadge status={dept.status} size="md" pulse />
            </div>

            {/* Metric */}
            <div className="mb-3">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {dept.metric}
              </p>
              <p className={`text-sm font-medium ${getMetricColor(dept.trend, dept.change)}`}>
                {dept.change}
                {dept.trend === 'up' && ' ↑'}
                {dept.trend === 'down' && ' ↓'}
              </p>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {dept.description}
            </p>

            {/* View Details Link */}
            <button className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              View Details →
            </button>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
          <span>Healthy</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
          <span>Warning</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full"></span>
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
          <span>Offline</span>
        </div>
      </div>
    </div>
  );
}
