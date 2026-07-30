// Phase 21 — Executive Operating System
// Health Badge Component

import React from 'react';

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'offline';

interface HealthBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function HealthBadge({ status, size = 'md', pulse = false }: HealthBadgeProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    offline: 'bg-slate-400',
  };

  const labels = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    offline: 'Offline',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`relative flex h-3 w-3 ${sizeClasses[size]}`}>
        {pulse && status === 'healthy' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        {pulse && status === 'warning' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        )}
        {pulse && status === 'critical' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${sizeClasses[size]} ${colors[status]}`}></span>
      </span>
      {size === 'lg' && (
        <span className={`text-sm font-medium ${
          status === 'healthy' ? 'text-emerald-400' :
          status === 'warning' ? 'text-amber-400' :
          status === 'critical' ? 'text-red-400' :
          'text-slate-400'
        }`}>
          {labels[status]}
        </span>
      )}
    </div>
  );
}
