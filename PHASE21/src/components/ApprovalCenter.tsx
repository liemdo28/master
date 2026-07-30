// Phase 21 — Executive Operating System
// Approval Center Component

import React from 'react';
import type { Approval } from './ExecutiveShell';

interface ApprovalCenterProps {
  approvals: Approval[];
}

export function ApprovalCenter({ approvals }: ApprovalCenterProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'medium': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      default: return 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Pending Approvals
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {approvals.length} item{approvals.length !== 1 ? 's' : ''} require your attention
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-full">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Est. {approvals.length * 2} min to review
          </span>
        </div>
      </div>

      {approvals.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 text-center">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            All Caught Up!
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            No pending approvals. Great job staying on top of things.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-white">
                      {approval.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {approval.department} • {formatTimeAgo(approval.requestedAt)}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(approval.priority)}`}>
                  {approval.priority}
                </span>
              </div>

              {/* Change Comparison */}
              <div className="flex items-center gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <div className="flex-1 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {approval.current}
                  </p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Requested</p>
                  <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                    {approval.requested}
                  </p>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {approval.change}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Reason
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  "{approval.reason}"
                </p>
              </div>

              {/* Evidence */}
              {approval.evidence && approval.evidence.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Evidence
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {approval.evidence.map((ev, idx) => (
                      <button
                        key={idx}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
                      >
                        {ev.type === 'report' && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        {ev.type === 'chart' && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        )}
                        {ev.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Approve
                </button>
                <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Reject
                </button>
                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors">
                  Delegate
                </button>
                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors">
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
