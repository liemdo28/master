// Phase 21 — Executive Operating System
// Executive Landing Screen (5-Second Hero)

import React, { useState, useEffect } from 'react';
import type { ExecutiveState, Mission, Insight, Approval } from './ExecutiveShell';
import { MissionItem } from './MissionItem';
import { InsightCard } from './InsightCard';
import { ApprovalCard } from './ApprovalCard';
import { HealthBadge } from './HealthBadge';

interface ExecutiveLandingProps {
  data: ExecutiveState | null;
  onNavigate: (view: string) => void;
}

export function ExecutiveLanding({ data, onNavigate }: ExecutiveLandingProps) {
  const [typedText, setTypedText] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Typing effect for greeting
  useEffect(() => {
    if (!data?.greeting?.message) return;

    const fullText = data.greeting.message;
    let index = 0;
    setTypedText('');

    const timer = setInterval(() => {
      if (index < fullText.length) {
        setTypedText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 40);

    return () => clearInterval(timer);
  }, [data?.greeting?.message]);

  // Calculate mission counts
  const missionCounts = data?.missions?.reduce(
    (acc, m) => {
      if (m.state !== 'completed' && m.state !== 'skipped') {
        acc[m.priority]++;
        acc.total++;
      }
      return acc;
    },
    { critical: 0, important: 0, normal: 0, total: 0 }
  ) || { critical: 0, important: 0, normal: 0, total: 0 };

  // Get top insight
  const topInsight = data?.insights?.find(i => !i.dismissed);
  const pendingApprovals = data?.approvals?.length || 0;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getGreetingPrefix = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Late night';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* AI Greeting Section - Hero of the 5-Second View */}
      <section className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white mb-1">
              {getGreetingPrefix()}, Sen.
            </h1>
            <p className="text-slate-600 dark:text-slate-400 font-mono text-sm min-h-[1.5rem]">
              {typedText}
              <span className="animate-pulse">|</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="text-sm font-mono">{formatTime(currentTime)}</span>
            <button
              onClick={() => window.location.reload()}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Revenue</p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">+12%</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Orders</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">847</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Reviews</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">+15</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tasks</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{missionCounts.total}</p>
          </div>
        </div>
      </section>

      {/* Main Executive Grid - 2 Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Company Health Card */}
        <section
          onClick={() => onNavigate('health')}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-medium">Company Health</span>
            </div>
            <HealthBadge status={data?.greeting?.status || 'healthy'} size="lg" pulse />
          </div>
          <p className="text-white/90 text-sm mb-4">All systems nominal</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-white/60">Revenue</p>
              <p className="text-xl font-bold">+12%</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <p className="text-xs text-white/60">Campaign</p>
              <p className="text-sm">DoorDash A</p>
            </div>
          </div>
        </section>

        {/* Today's Mission Card */}
        <section
          onClick={() => onNavigate('mission')}
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <span className="font-medium text-slate-900 dark:text-white">Today's Mission</span>
            </div>
            <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              Open Plan →
            </button>
          </div>

          {/* Mission Priority Bars */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Critical</span>
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{missionCounts.critical}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(missionCounts.critical * 10, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Important</span>
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{missionCounts.important}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(missionCounts.important * 5, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Normal</span>
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{missionCounts.normal}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Est. {missionCounts.total * 2} min to complete
          </p>
        </section>

        {/* AI Recommendation Card */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-medium">AI Recommendation</span>
            </div>
            <button
              onClick={() => onNavigate('insights')}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              View All →
            </button>
          </div>

          {topInsight ? (
            <>
              <h3 className="text-lg font-medium mb-2">"{topInsight.title}"</h3>
              <p className="text-sm text-slate-400 mb-4">{topInsight.recommendation}</p>

              {/* Confidence Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Confidence</span>
                  <span>{topInsight.confidence}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      topInsight.confidence >= 90 ? 'bg-emerald-500' :
                      topInsight.confidence >= 70 ? 'bg-emerald-400' :
                      topInsight.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${topInsight.confidence}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium transition-colors">
                  Apply
                </button>
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
                  Details
                </button>
                <button className="px-4 py-2 bg-transparent hover:bg-slate-700 rounded-lg text-sm text-slate-400 transition-colors">
                  Dismiss
                </button>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">No active recommendations</p>
          )}
        </section>

        {/* Pending Approvals Card */}
        <section
          onClick={() => onNavigate('approvals')}
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-medium text-slate-900 dark:text-white">Pending Approvals</span>
            </div>
            {pendingApprovals > 0 && (
              <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
                {pendingApprovals}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {pendingApprovals > 0 ? (
              <>
                {pendingApprovals} item{pendingApprovals > 1 ? 's' : ''} require{pendingApprovals === 1 ? 's' : ''} your attention
              </>
            ) : (
              'All caught up!'
            )}
          </p>

          {pendingApprovals > 0 && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Est. {pendingApprovals * 2} min to review
              </p>
              <button className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                Review Now →
              </button>
            </>
          )}
        </section>
      </div>

      {/* Critical Issues Section */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center text-red-600 dark:text-red-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="font-medium text-slate-900 dark:text-white">Critical Issues</span>
        </div>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          None
        </p>
      </section>
    </div>
  );
}
