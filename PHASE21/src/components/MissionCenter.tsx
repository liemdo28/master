// Phase 21 — Executive Operating System
// Mission Center Component

import React from 'react';
import type { Mission } from './ExecutiveShell';

interface MissionCenterProps {
  missions: Mission[];
}

export function MissionCenter({ missions }: MissionCenterProps) {
  // Calculate mission counts
  const missionCounts = missions.reduce(
    (acc, m) => {
      if (m.state !== 'completed' && m.state !== 'skipped') {
        acc[m.priority]++;
        acc.total++;
      }
      return acc;
    },
    { critical: 0, important: 0, normal: 0, total: 0 }
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'important': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'in_progress':
        return (
          <span className="w-5 h-5 border-2 border-indigo-500 rounded-full animate-pulse" />
        );
      case 'delegated':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        );
      case 'skipped':
        return (
          <span className="w-5 h-5 text-slate-400 line-through">—</span>
        );
      default:
        return (
          <span className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded-full" />
        );
    }
  };

  const formatDue = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMs < 0) return 'Overdue';
    if (diffHours < 1) return 'Due soon';
    if (diffHours < 24) return `Due in ${diffHours}h`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Today's Mission
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {missionCounts.total} task{missionCounts.total !== 1 ? 's' : ''} remaining
          </p>
        </div>
        <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors">
          Open Plan →
        </button>
      </div>

      {/* Mission Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Critical */}
        <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-200 dark:border-red-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {missionCounts.critical}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Critical</p>
          <div className="w-full bg-red-200 dark:bg-red-900/30 rounded-full h-1.5 mt-3">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(missionCounts.critical * 10, 100)}%` }}
            />
          </div>
        </div>

        {/* Important */}
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="w-3 h-3 bg-amber-500 rounded-full" />
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {missionCounts.important}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Important</p>
          <div className="w-full bg-amber-200 dark:bg-amber-900/30 rounded-full h-1.5 mt-3">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(missionCounts.important * 5, 100)}%` }}
            />
          </div>
        </div>

        {/* Normal */}
        <div className="bg-gradient-to-br from-slate-500/10 to-slate-500/5 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="w-3 h-3 bg-slate-400 rounded-full" />
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {missionCounts.normal}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Normal</p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-3">
            <div
              className="bg-slate-400 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(missionCounts.normal * 2, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Estimated Time */}
      <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-indigo-700 dark:text-indigo-300">
          Estimated completion time: <strong>{missionCounts.total * 2} minutes</strong>
        </span>
      </div>

      {/* Mission List */}
      <div className="space-y-3">
        {missions.map((mission) => (
          <div
            key={mission.id}
            className={`
              bg-white dark:bg-slate-800 rounded-xl p-4 border transition-all duration-200
              ${mission.state === 'completed' ? 'border-emerald-200 dark:border-emerald-800 opacity-60' : 'border-slate-200 dark:border-slate-700'}
              ${mission.state === 'in_progress' ? 'border-indigo-500 shadow-lg' : ''}
              hover:shadow-md cursor-pointer
            `}
          >
            <div className="flex items-start gap-4">
              {/* Checkbox */}
              <div className="mt-0.5">
                {getStateIcon(mission.state)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {/* Priority Badge */}
                  <span className={`w-2 h-2 ${getPriorityColor(mission.priority)} rounded-full`} />
                  <span className={`text-xs font-medium ${
                    mission.priority === 'critical' ? 'text-red-600 dark:text-red-400' :
                    mission.priority === 'important' ? 'text-amber-600 dark:text-amber-400' :
                    'text-slate-500 dark:text-slate-400'
                  }`}>
                    {mission.priority.toUpperCase()}
                  </span>
                </div>

                <h3 className={`font-medium text-slate-900 dark:text-white mb-1 ${
                  mission.state === 'skipped' ? 'line-through text-slate-400' : ''
                }`}>
                  {mission.title}
                </h3>

                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {mission.description}
                </p>

                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{mission.department}</span>
                  <span>•</span>
                  <span>{formatDue(mission.due)}</span>
                  <span>•</span>
                  <span>Est. {mission.estimatedMinutes} min</span>
                </div>
              </div>

              {/* Actions */}
              {mission.state === 'pending' && (
                <div className="flex gap-1">
                  <button className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    Skip
                  </button>
                  <button className="px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                    Do Now
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
