// Phase 21 — Executive Operating System
// AI Insights Component

import React from 'react';
import type { Insight } from './ExecutiveShell';

interface AIInsightsProps {
  insights: Insight[];
}

export function AIInsights({ insights }: AIInsightsProps) {
  const activeInsights = insights.filter(i => !i.dismissed);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'revenue': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'marketing': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'operational': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'customer': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'financial': return 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400';
      default: return 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-emerald-500';
    if (confidence >= 70) return 'bg-emerald-400';
    if (confidence >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          AI Insights
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {activeInsights.length} active insight{activeInsights.length !== 1 ? 's' : ''}
        </span>
      </div>

      {activeInsights.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 text-center">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            All Clear!
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            No active recommendations right now. Everything looks good.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeInsights.map((insight) => (
            <div
              key={insight.id}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTypeColor(insight.type)}`}>
                      {insight.type}
                    </span>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Title */}
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
                "{insight.title}"
              </h3>

              {/* Sections */}
              <div className="space-y-4">
                {/* Root Cause */}
                <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Root Cause
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {insight.rootCause}
                  </p>
                </div>

                {/* Recommendation */}
                <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Recommendation
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {insight.recommendation}
                  </p>
                </div>

                {/* Impact */}
                <div className="pb-4 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Impact
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {insight.impact}
                  </p>
                </div>

                {/* Confidence */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Confidence
                    </p>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {insight.confidence}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${getConfidenceColor(insight.confidence)}`}
                      style={{ width: `${insight.confidence}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Apply
                </button>
                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors">
                  Details
                </button>
                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm transition-colors">
                  Watch
                </button>
                <button className="px-4 py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 rounded-lg text-sm transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
