/**
 * Self-Improvement Engine — Phase 22
 * Mi learns from its own execution history.
 * Tracks: which skills work best, which workflows succeed, which owners perform highest.
 */

import path from 'path';

const MEM_DB = path.join(
  process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core',
  '.local-agent-global/operational-memory/memory.db'
);

function getDb() {
  const Database = require('better-sqlite3');
  return new Database(MEM_DB, { readonly: true });
}

export interface SkillEffectiveness {
  skill_id: string;
  total_uses: number;
  pass_rate: number;
  avg_duration_ms: number;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  recommendation: string;
}

export interface WorkflowPattern {
  action_sequence: string;     // e.g. "source_scan → qa_sweep → certify"
  success_rate: number;
  occurrence_count: number;
  avg_confidence: number;
}

export interface OwnerPerformance {
  agent_role: string;
  total_actions: number;
  pass_rate: number;
  specialization: string;      // top action_type
  load_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'OVERLOADED';
}

export interface ImprovementInsight {
  type: 'skill' | 'workflow' | 'owner';
  priority: 'high' | 'medium' | 'low';
  insight_vi: string;
  action_vi: string;
  data: Record<string, unknown>;
}

export interface SelfImprovementReport {
  generated_at: string;
  period_days: number;
  top_skills: SkillEffectiveness[];
  top_workflows: WorkflowPattern[];
  owner_performance: OwnerPerformance[];
  insights: ImprovementInsight[];
  improvement_score: number;    // 0-100 overall system self-improvement index
}

function isoAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// ── Skill effectiveness ───────────────────────────────────────────────────────

export function getSkillEffectiveness(days = 30): SkillEffectiveness[] {
  try {
    const db = getDb();
    // action_type maps roughly to skill_id
    const rows = db.prepare(`
      SELECT action_type as skill_id,
             COUNT(*) as total,
             SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END) as passed,
             AVG(duration_ms) as avg_ms
      FROM owner_actions WHERE ts >= ?
      GROUP BY action_type ORDER BY total DESC LIMIT 10
    `).all(isoAgo(days)) as any[];

    // Get prior period for trend
    const prior = db.prepare(`
      SELECT action_type, SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END)*100/COUNT(*) as rate
      FROM owner_actions WHERE ts >= ? AND ts < ?
      GROUP BY action_type
    `).all(isoAgo(days * 2), isoAgo(days)) as any[];
    db.close();

    const priorMap: Record<string, number> = {};
    for (const r of prior) priorMap[r.action_type] = r.rate;

    return rows.map(r => {
      const rate = r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0;
      const prev = priorMap[r.skill_id] ?? rate;
      const trend: SkillEffectiveness['trend'] =
        rate - prev >= 10 ? 'IMPROVING' : rate - prev <= -10 ? 'DEGRADING' : 'STABLE';
      const recommendation = rate >= 85 ? 'Excellent — consider promoting to CERTIFIED'
        : rate >= 70 ? 'Good — monitor for edge cases'
        : rate >= 50 ? 'Needs improvement — review failure patterns'
        : 'Critical — investigate root cause';
      return { skill_id: r.skill_id, total_uses: r.total, pass_rate: rate,
        avg_duration_ms: Math.round(r.avg_ms || 0), trend, recommendation };
    });
  } catch { return []; }
}

// ── Workflow patterns ─────────────────────────────────────────────────────────

export function getWorkflowPatterns(days = 30): WorkflowPattern[] {
  try {
    const db = getDb();
    // Group by work_order_id to find sequences
    const wos = db.prepare(`
      SELECT work_order_id, GROUP_CONCAT(action_type, ' → ') as sequence,
             SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END)*100/COUNT(*) as rate,
             COUNT(DISTINCT work_order_id) as count
      FROM owner_actions WHERE ts >= ? AND work_order_id IS NOT NULL
      GROUP BY work_order_id
    `).all(isoAgo(days)) as any[];
    db.close();

    // Aggregate by sequence pattern
    const patterns: Record<string, { success: number; total: number; count: number }> = {};
    for (const wo of wos) {
      const seq = (wo.sequence || '').slice(0, 80);
      if (!patterns[seq]) patterns[seq] = { success: 0, total: 0, count: 0 };
      patterns[seq].total++;
      if (wo.rate >= 75) patterns[seq].success++;
      patterns[seq].count++;
    }

    return Object.entries(patterns)
      .filter(([_, v]) => v.total >= 1)
      .map(([seq, v]) => ({
        action_sequence: seq,
        success_rate: Math.round((v.success / v.total) * 100),
        occurrence_count: v.count,
        avg_confidence: Math.round((v.success / v.total) * 100),
      }))
      .sort((a, b) => b.success_rate - a.success_rate || b.occurrence_count - a.occurrence_count)
      .slice(0, 5);
  } catch { return []; }
}

// ── Owner performance ─────────────────────────────────────────────────────────

export function getOwnerPerformance(days = 30): OwnerPerformance[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT agent_role,
             COUNT(*) as total,
             SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END) as passed
      FROM owner_actions WHERE ts >= ?
      GROUP BY agent_role ORDER BY total DESC
    `).all(isoAgo(days)) as any[];

    const results: OwnerPerformance[] = [];
    for (const r of rows) {
      const rate = r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0;
      const top = db.prepare(`SELECT action_type FROM owner_actions WHERE agent_role=? AND ts>=? GROUP BY action_type ORDER BY COUNT(*) DESC LIMIT 1`).get(r.agent_role, isoAgo(days)) as any;
      const load: OwnerPerformance['load_level'] = r.total >= 60 ? 'OVERLOADED' : r.total >= 30 ? 'HIGH' : r.total >= 10 ? 'MEDIUM' : 'LOW';
      results.push({ agent_role: r.agent_role, total_actions: r.total, pass_rate: rate, specialization: top?.action_type || 'N/A', load_level: load });
    }
    db.close();
    return results;
  } catch { return []; }
}

// ── Insight generation ────────────────────────────────────────────────────────

export function generateInsights(skills: SkillEffectiveness[], owners: OwnerPerformance[]): ImprovementInsight[] {
  const insights: ImprovementInsight[] = [];

  // Skill insights
  for (const s of skills) {
    if (s.trend === 'DEGRADING') {
      insights.push({ type: 'skill', priority: 'high',
        insight_vi: `Skill "${s.skill_id}" đang giảm hiệu quả (${s.pass_rate}%)`,
        action_vi: `Xem lại pattern thất bại của "${s.skill_id}" trong 30 ngày qua`,
        data: { skill: s.skill_id, rate: s.pass_rate, trend: s.trend } });
    }
    if (s.pass_rate >= 90 && s.total_uses >= 10) {
      insights.push({ type: 'skill', priority: 'low',
        insight_vi: `Skill "${s.skill_id}" hoạt động xuất sắc (${s.pass_rate}%)`,
        action_vi: `Xem xét promote "${s.skill_id}" lên CERTIFIED để tự động hóa hoàn toàn`,
        data: { skill: s.skill_id, rate: s.pass_rate } });
    }
  }

  // Owner insights
  for (const o of owners) {
    if (o.load_level === 'OVERLOADED') {
      insights.push({ type: 'owner', priority: 'high',
        insight_vi: `${o.agent_role} có ${o.total_actions} actions — đang OVERLOADED`,
        action_vi: `Phân tán task sang agent khác hoặc optimize workflow của ${o.agent_role}`,
        data: { role: o.agent_role, total: o.total_actions } });
    }
    if (o.pass_rate < 60 && o.total_actions >= 5) {
      insights.push({ type: 'owner', priority: 'medium',
        insight_vi: `${o.agent_role} pass rate thấp: ${o.pass_rate}%`,
        action_vi: `Review skill set và training data của ${o.agent_role}`,
        data: { role: o.agent_role, rate: o.pass_rate } });
    }
  }

  return insights.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
}

// ── Main report ────────────────────────────────────────────────────────────────

export function generateSelfImprovementReport(days = 30): SelfImprovementReport {
  const skills = getSkillEffectiveness(days);
  const workflows = getWorkflowPatterns(days);
  const owners = getOwnerPerformance(days);
  const insights = generateInsights(skills, owners);

  const avgSkillRate = skills.length > 0
    ? Math.round(skills.reduce((s, k) => s + k.pass_rate, 0) / skills.length) : 0;
  const avgOwnerRate = owners.length > 0
    ? Math.round(owners.reduce((s, o) => s + o.pass_rate, 0) / owners.length) : 0;
  const improvementScore = Math.round((avgSkillRate + avgOwnerRate) / 2);

  return {
    generated_at: new Date().toISOString(),
    period_days: days,
    top_skills: skills.slice(0, 5),
    top_workflows: workflows,
    owner_performance: owners,
    insights,
    improvement_score: improvementScore,
  };
}
