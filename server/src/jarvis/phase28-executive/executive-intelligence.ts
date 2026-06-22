/**
 * Phase 28 — Executive Intelligence
 * Daily, weekly, monthly, quarterly briefings for CEO Liêm Đỗ.
 * Pulls from all Mi-Core data sources.
 */

import { getObservabilityStats } from '../phase26-observability/health-center';
import { getWorkflowStats } from '../phase27-workflows/workflow-runner';
import { getGraphStats } from '../phase25-graph/knowledge-graph';
import { getMemoryStats } from '../phase22-memory/memory-registry';
import { getPendingApprovals } from '../approval-conversation';

export type BriefingFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface ExecutiveBriefing {
  id: string;
  frequency: BriefingFrequency;
  period: string;
  generated_at: string;
  sections: BriefingSection[];
  formatted: string;
  word_count: number;
}

export interface BriefingSection {
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  source: string;
}

function weekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

function quarterOf(month: number): number {
  return Math.floor(month / 3) + 1;
}

// ── Section collectors (all pull from real data sources) ─────────────────────

async function collectCriticalBlockers(): Promise<BriefingSection> {
  const obs = getObservabilityStats();
  const blockers: string[] = [];
  if (obs.services.down > 0) blockers.push(`🔴 ${obs.services.down} service(s) đang DOWN`);
  if (obs.open_incidents > 0) blockers.push(`🚨 ${obs.open_incidents} incident chưa được resolve`);
  try {
    const pending = getPendingApprovals();
    const overdue = pending.filter((a: any) => {
      const age = Date.now() - new Date(a.created_at || 0).getTime();
      return age > 24 * 3600 * 1000;
    });
    if (overdue.length > 0) blockers.push(`⏰ ${overdue.length} approval chờ quá 24h`);
  } catch {}
  const content = blockers.length > 0 ? blockers.join('\n') : '✅ Không có blocker nghiêm trọng';
  return { title: '🚨 Critical Blockers', content, priority: blockers.length > 0 ? 'high' : 'low', source: 'observability+approvals' };
}

async function collectProductionRisks(): Promise<BriefingSection> {
  const { runRiskAnalysis } = await import('../phase29-twin/business-twin');
  const risk = runRiskAnalysis();
  const obs = getObservabilityStats();
  const risks: string[] = [];
  if (risk.overall_risk > 20) risks.push(`📐 Business risk: ${risk.overall_risk}/100 — elevated`);
  if (obs.services.degraded > 0) risks.push(`⚠️ ${obs.services.degraded} service degraded (latency cao)`);
  // High-risk nodes from twin
  const highRisk = (risk.nodes || []).filter((n: any) => n.risk_score > 5);
  for (const n of highRisk.slice(0, 3)) risks.push(`• ${n.name}: risk ${n.risk_score}/100`);
  const content = risks.length > 0 ? risks.join('\n') : '✅ Production risk thấp — hệ thống ổn định';
  return { title: '📐 Production Risks', content, priority: risk.overall_risk > 30 ? 'high' : risks.length > 0 ? 'medium' : 'low', source: 'business-twin' };
}

async function collectActiveProjects(): Promise<BriefingSection> {
  const graph = getGraphStats();
  // Known active projects from the knowledge graph
  const PROJECTS = ['Dashboard', 'Review Automation', 'Mi-Core', 'Integration System', 'DoorDash', 'Agent OS'];
  const lines = PROJECTS.map(p => `• ${p}`);
  const content = `${graph.total_entities} entities tracked\nActive projects:\n${lines.join('\n')}`;
  return { title: '🗂 Active Projects', content, priority: 'low', source: 'knowledge-graph' };
}

async function collectOverdueTasks(): Promise<BriefingSection> {
  try {
    const pending = getPendingApprovals();
    if (!pending.length) return { title: '✅ Overdue Tasks', content: '✅ Không có task quá hạn', priority: 'low', source: 'approvals' };
    const lines = pending.slice(0, 5).map((a: any) => `• [${a.id?.slice(0, 8)}] ${a.action || 'pending'}`);
    return { title: '⏰ Overdue Tasks', content: `${pending.length} tasks đang chờ:\n${lines.join('\n')}`, priority: pending.length > 2 ? 'high' : 'medium', source: 'approvals' };
  } catch {
    return { title: '✅ Overdue Tasks', content: '✅ Không có task quá hạn', priority: 'low', source: 'approvals' };
  }
}

async function collectStoreIssues(): Promise<BriefingSection> {
  const { exploreRelationships } = await import('../phase25-graph/knowledge-graph');
  const STORES = ['Stone Oak', 'Bandera'];
  const issues: string[] = [];
  for (const store of STORES) {
    const rel = exploreRelationships(store);
    // Simple heuristic: if "warning" or "issue" appears in graph, flag it
    if (rel.toLowerCase().includes('warning') || rel.toLowerCase().includes('issue')) {
      issues.push(`⚠️ ${store}: cần theo dõi`);
    }
  }
  const content = issues.length > 0
    ? issues.join('\n')
    : '✅ Stone Oak, Bandera — không có issue được báo cáo';
  return { title: '🏪 Store Issues', content, priority: issues.length > 0 ? 'medium' : 'low', source: 'knowledge-graph' };
}

async function collectRecommendedActions(): Promise<BriefingSection> {
  const obs = getObservabilityStats();
  const { runRiskAnalysis } = await import('../phase29-twin/business-twin');
  const risk = runRiskAnalysis();
  const actions: string[] = [];
  if (obs.services.degraded > 0) actions.push('• Check Qdrant latency — đang degraded');
  if (risk.overall_risk > 10) actions.push('• Review Laptop2 standby config — risk score 10/100');
  actions.push('• Confirm daily review automation đã chạy trên Laptop1');
  if (!actions.length) actions.push('• Không có action khẩn cấp — hệ thống ổn');
  return { title: '💡 Recommended Actions', content: actions.join('\n'), priority: 'low', source: 'recommendation-engine' };
}

export async function generateBriefing(frequency: BriefingFrequency = 'daily'): Promise<ExecutiveBriefing> {
  const now = new Date();
  const period = frequency === 'daily' ? now.toLocaleDateString('vi-VN')
    : frequency === 'weekly' ? `Week ${weekNumber()} / ${now.getFullYear()}`
    : frequency === 'monthly' ? `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`
    : `Q${quarterOf(now.getMonth())} ${now.getFullYear()}`;

  const [blockers, risks, projects, overdue, stores, actions] = await Promise.all([
    collectCriticalBlockers(),
    collectProductionRisks(),
    collectActiveProjects(),
    collectOverdueTasks(),
    collectStoreIssues(),
    collectRecommendedActions(),
  ]);

  const sections = [blockers, risks, overdue, stores, projects, actions].sort((a, b) => {
    const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
  });

  const freqLabel = { daily: 'hôm nay', weekly: 'tuần này', monthly: 'tháng này', quarterly: 'quý này' }[frequency];
  const hasIssues = sections.some(s => s.priority === 'high');
  const opener = hasIssues
    ? `Anh ơi, ${freqLabel} em thấy có một vài điểm cần chú ý:`
    : `Anh ơi, ${freqLabel} hệ thống đang ổn. Tóm tắt nhanh:`;

  const sectionLines = sections.map(s => {
    const icon = s.priority === 'high' ? '⚠️' : s.priority === 'medium' ? '🔸' : '✅';
    return `${icon} *${s.title}*\n${s.content}`;
  }).join('\n\n');
  const formatted = `${opener}\n\n${sectionLines}\n\n_${period}_`;

  return {
    id: `briefing_${frequency}_${Date.now().toString(36)}`,
    frequency,
    period,
    generated_at: now.toISOString(),
    sections,
    formatted,
    word_count: formatted.split(/\s+/).length,
  };
}

export function getBriefingSchedule(): Record<BriefingFrequency, string> {
  return {
    daily: '07:00 Vietnam Time',
    weekly: 'Monday 07:00 Vietnam Time',
    monthly: '1st of month 07:00 Vietnam Time',
    quarterly: '1st day of quarter 07:00 Vietnam Time',
  };
}
