// Phase 21 — Executive Operating System
// Connector Health Grid Component

import React from 'react';

interface Connector {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'offline';
  lastSync?: string;
  error?: string;
}

interface ConnectorHealthProps {
  connectors?: Connector[];
}

export function ConnectorHealth({ connectors = defaultConnectors }: ConnectorHealthProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-slate-400';
    }
  };

  const getCardBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Connector Health
        </h2>
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
            <span>Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-slate-400 rounded-full" />
            <span>Offline</span>
          </div>
        </div>
      </div>

      {/* Connector Grid - 4 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {connectors.map((connector) => (
          <div
            key={connector.id}
            className={`${getCardBg(connector.status)} border rounded-xl p-4 hover:shadow-md transition-all duration-200 cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {connector.name}
              </span>
              <span className={`w-3 h-3 ${getStatusColor(connector.status)} rounded-full ${
                connector.status === 'healthy' ? 'animate-pulse' : ''
              }`} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {connector.status === 'offline' ? (
                connector.error || 'Connection lost'
              ) : (
                `Last sync: ${formatLastSync(connector.lastSync)}`
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Demo data
const defaultConnectors: Connector[] = [
  { id: 'whatsapp', name: 'WhatsApp', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'openai', name: 'OpenAI', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'claude', name: 'Claude', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'gemini', name: 'Gemini', status: 'warning', lastSync: new Date(Date.now() - 600000).toISOString() },
  { id: 'quickbooks', name: 'QuickBooks', status: 'offline', error: 'Desktop offline' },
  { id: 'toast', name: 'Toast', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'doordash', name: 'DoorDash', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'gbp', name: 'GBP', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'gsc', name: 'GSC', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'ga4', name: 'GA4', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'asana', name: 'Asana', status: 'healthy', lastSync: new Date().toISOString() },
  { id: 'n8n', name: 'n8n', status: 'healthy', lastSync: new Date().toISOString() },
];
