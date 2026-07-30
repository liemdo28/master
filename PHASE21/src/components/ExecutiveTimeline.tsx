// Phase 21 — Executive Operating System
// Executive Timeline Component

import React from 'react';
import type { TimelineEvent } from './ExecutiveShell';

interface ExecutiveTimelineProps {
  events?: TimelineEvent[];
}

export function ExecutiveTimeline({ events = defaultEvents }: ExecutiveTimelineProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'workflow':
        return (
          <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'approval':
        return (
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'sync':
        return (
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900/30 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        );
      case 'report':
        return (
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const groupByDate = (events: TimelineEvent[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: TimelineEvent[] } = {
      today: [],
      yesterday: [],
      older: [],
    };

    events.forEach(event => {
      const eventDate = new Date(event.timestamp);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate.getTime() === today.getTime()) {
        groups.today.push(event);
      } else if (eventDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(event);
      } else {
        groups.older.push(event);
      }
    });

    return groups;
  };

  const grouped = groupByDate(events);

  const renderGroup = (title: string, items: TimelineEvent[]) => {
    if (items.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h3 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium mb-4">
          {title}
        </h3>
        <div className="space-y-4">
          {items.map((event, index) => (
            <div key={event.id} className="flex gap-4">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                {getEventIcon(event.type)}
                {index < items.length - 1 && (
                  <div className="w-px h-full bg-slate-200 dark:bg-slate-700 mt-2" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {event.title}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      {event.description}
                    </p>
                    {event.url && (
                      <button className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1">
                        View Details →
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Activity Timeline
        </h2>
        <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          View All →
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
        {renderGroup('Today', grouped.today)}
        {renderGroup('Yesterday', grouped.yesterday)}
        {renderGroup('Earlier', grouped.older)}
      </div>
    </div>
  );
}

// Demo data
const defaultEvents: TimelineEvent[] = [
  { id: 't1', timestamp: new Date().toISOString(), type: 'workflow', title: 'DoorDash optimized', description: 'Campaign #1 budget adjusted +$200' },
  { id: 't2', timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'workflow', title: 'Review replied', description: '3 new reviews responded (avg 2h response)' },
  { id: 't3', timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'report', title: 'SEO crawl finished', description: '13 pages audited, 2 issues found' },
  { id: 't4', timestamp: new Date(Date.now() - 10800000).toISOString(), type: 'sync', title: 'QB synced', description: '47 transactions imported' },
  { id: 't5', timestamp: new Date(Date.now() - 14400000).toISOString(), type: 'message', title: 'Daily brief sent', description: 'To: Sen, Dev1, Dev2 via WhatsApp' },
  { id: 't6', timestamp: new Date(Date.now() - 86400000).toISOString(), type: 'report', title: 'SEO report generated', description: '9 keywords tracked, 169 issues found' },
  { id: 't7', timestamp: new Date(Date.now() - 93600000).toISOString(), type: 'workflow', title: 'Campaign Budget Review completed', description: '3 campaigns analyzed, 1 underperforming' },
];
