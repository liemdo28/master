// Phase 21 — Executive Operating System
// Main Shell Component

import React, { useState, useEffect } from 'react';
import { TopBar } from './TopBar';
import { SideNav } from './SideNav';
import { BottomNav } from './BottomNav';
import { ExecutiveLanding } from './ExecutiveLanding';
import { BusinessHealth } from './BusinessHealth';
import { MissionCenter } from './MissionCenter';
import { AIInsights } from './AIInsights';
import { ApprovalCenter } from './ApprovalCenter';
import { ProjectHealth } from './ProjectHealth';
import { ConnectorHealth } from './ConnectorHealth';
import { ExecutiveTimeline } from './ExecutiveTimeline';
import { DepartmentView } from './DepartmentView';
import { TechnicalView } from './TechnicalView';

export type NavigationLevel = 'executive' | 'business' | 'technical';

export interface ExecutiveState {
  greeting: {
    time: 'morning' | 'afternoon' | 'evening' | 'night';
    message: string;
    status: 'healthy' | 'warning' | 'critical';
  };
  health: DepartmentHealth[];
  missions: Mission[];
  insights: Insight[];
  approvals: Approval[];
  timeline: TimelineEvent[];
}

export interface DepartmentHealth {
  id: string;
  name: string;
  icon: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  metric: string;
  change: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

export interface Mission {
  id: string;
  title: string;
  priority: 'critical' | 'important' | 'normal';
  department: string;
  due: string;
  estimatedMinutes: number;
  description?: string;
  state: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'delegated';
}

export interface Insight {
  id: string;
  type: 'revenue' | 'marketing' | 'operational' | 'customer' | 'financial';
  title: string;
  rootCause: string;
  recommendation: string;
  impact: string;
  confidence: number;
  dismissed: boolean;
}

export interface Approval {
  id: string;
  title: string;
  department: string;
  requestedBy: string;
  requestedAt: string;
  priority: 'high' | 'medium' | 'low';
  current: string;
  requested: string;
  change: string;
  reason: string;
  evidence: Evidence[];
}

export interface Evidence {
  type: 'report' | 'chart' | 'discussion';
  title: string;
  url: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'workflow' | 'error' | 'approval' | 'sync' | 'report' | 'message';
  title: string;
  description: string;
  url?: string;
}

export function ExecutiveShell() {
  const [level, setLevel] = useState<NavigationLevel>('executive');
  const [currentView, setCurrentView] = useState<string>('mission');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [executiveData, setExecutiveData] = useState<ExecutiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);

  // Check URL for technical view
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'technical') {
      setDeveloperMode(true);
      setLevel('technical');
    }
  }, []);

  // Fetch executive data
  useEffect(() => {
    const fetchExecutiveData = async () => {
      try {
        const res = await fetch('/api/executive/snapshot');
        const data = await res.json();
        setExecutiveData(data.executive);
      } catch (err) {
        console.error('Failed to fetch executive data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutiveData();
    const interval = setInterval(fetchExecutiveData, 30000); // 30s refresh

    return () => clearInterval(interval);
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'health.update':
          setExecutiveData(prev => prev ? {
            ...prev,
            health: prev.health.map(d =>
              d.id === data.department ? { ...d, status: data.status } : d
            )
          } : null);
          break;
        case 'mission.complete':
          setExecutiveData(prev => prev ? {
            ...prev,
            missions: prev.missions.map(m =>
              m.id === data.mission_id ? { ...m, state: 'completed' } : m
            )
          } : null);
          break;
        case 'approval.required':
          // Refetch approvals
          fetch('/api/executive/approvals')
            .then(res => res.json())
            .then(data => {
              setExecutiveData(prev => prev ? { ...prev, approvals: data.items } : null);
            });
          break;
      }
    };

    return () => ws.close();
  }, []);

  const renderContent = () => {
    if (loading && !executiveData) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 font-mono text-sm">Loading executive view...</p>
          </div>
        </div>
      );
    }

    // Check if Technical View should be shown (hidden by default)
    if (level === 'technical' && !developerMode) {
      return <TechnicalView onExit={() => setLevel('executive')} />;
    }

    switch (level) {
      case 'executive':
        return (
          <>
            {currentView === 'mission' && <ExecutiveLanding data={executiveData} onNavigate={setCurrentView} />}
            {currentView === 'health' && <BusinessHealth departments={executiveData?.health || []} />}
            {currentView === 'insights' && <AIInsights insights={executiveData?.insights || []} />}
            {currentView === 'approvals' && <ApprovalCenter approvals={executiveData?.approvals || []} />}
          </>
        );

      case 'business':
        return <DepartmentView view={currentView} data={executiveData} />;

      case 'technical':
        return <TechnicalView onExit={() => setLevel('executive')} />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <TopBar
        level={level}
        onLevelChange={setLevel}
        developerMode={developerMode}
        onDeveloperModeToggle={() => setDeveloperMode(!developerMode)}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <SideNav
          level={level}
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view);
            if (level !== 'executive' && view) {
              setLevel('executive');
            }
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content */}
        <main className={`
          flex-1 transition-all duration-300
          ${sidebarCollapsed ? 'ml-16' : 'ml-60'}
          pt-16
          pb-20 md:pb-0
        `}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        level={level}
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          setMobileMenuOpen(false);
        }}
        notificationCount={executiveData?.approvals.filter(a => a).length || 0}
      />
    </div>
  );
}
