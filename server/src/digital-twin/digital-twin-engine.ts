/**
 * Digital Twin Engine — Phase 24
 * Simulates what happens when key entities fail or change.
 * Answers: "Nếu PM2 chết?", "Nếu Dev1 nghỉ?", "Nếu Dashboard fail?"
 * Uses Phase 14 graph topology + Phase 15 memory for impact modeling.
 */

import path from 'path';
import fs from 'fs';

const GRAPH_DB = path.join(
  process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core',
  '.local-agent-global/graph/graph.db'
);
const MEM_DB = path.join(
  process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core',
  '.local-agent-global/operational-memory/memory.db'
);

export interface TwinEntity {
  id: string;
  name: string;
  type: string;
  criticality_score: number;
  dependents: string[];
  dependencies: string[];
}

export interface SimulationResult {
  scenario: string;
  entity_name: string;
  entity_type: string;
  direct_impact: string[];
  cascade_impact: string[];
  affected_count: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recovery_complexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  estimated_downtime_hours: number;
  mitigation_vi: string[];
  simulation_vi: string;
}

// ── Load graph topology ───────────────────────────────────────────────────────

function loadGraph(): { entities: any[]; edges: any[] } {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(GRAPH_DB, { readonly: true });
    const entities = db.prepare('SELECT * FROM entities').all();
    const edges = db.prepare('SELECT * FROM edges').all();
    db.close();
    return { entities, edges };
  } catch { return { entities: [], edges: [] }; }
}

// ── Blast radius calculation ──────────────────────────────────────────────────

function getBlastRadius(entityId: string, edges: any[], visited = new Set<string>()): string[] {
  if (visited.has(entityId)) return [];
  visited.add(entityId);
  const directDeps = edges.filter(e => e.to_id === entityId && e.relationship === 'depends_on').map(e => e.from_id);
  const cascade = directDeps.flatMap(id => getBlastRadius(id, edges, visited));
  return [...directDeps, ...cascade];
}

// ── Simulation engine ─────────────────────────────────────────────────────────

export function simulateFailure(entityName: string): SimulationResult {
  const { entities, edges } = loadGraph();

  const entity = entities.find(e =>
    e.name.toLowerCase().includes(entityName.toLowerCase()) ||
    e.id.toLowerCase().includes(entityName.toLowerCase())
  );

  if (!entity) {
    return {
      scenario: `Failure of "${entityName}"`,
      entity_name: entityName,
      entity_type: 'unknown',
      direct_impact: [],
      cascade_impact: [],
      affected_count: 0,
      severity: 'LOW',
      recovery_complexity: 'SIMPLE',
      estimated_downtime_hours: 0,
      mitigation_vi: [`Không tìm thấy entity "${entityName}" trong graph. Kiểm tra lại tên.`],
      simulation_vi: `Không thể mô phỏng — entity không tồn tại trong graph topology.`,
    };
  }

  const blastIds = getBlastRadius(entity.id, edges);
  const entityMap = new Map(entities.map((e: any) => [e.id, e.name]));
  const directDeps = edges.filter(e => e.to_id === entity.id && e.relationship === 'depends_on')
    .map(e => entityMap.get(e.from_id) || e.from_id);
  const cascade = [...new Set(blastIds.map(id => entityMap.get(id) || id))]
    .filter(name => !directDeps.includes(name));

  const affectedCount = new Set([...directDeps, ...cascade]).size;
  const severity: SimulationResult['severity'] =
    affectedCount >= 5 ? 'CRITICAL' : affectedCount >= 3 ? 'HIGH' : affectedCount >= 1 ? 'MEDIUM' : 'LOW';
  const complexity: SimulationResult['recovery_complexity'] =
    entity.type === 'service' ? 'MODERATE' : entity.type === 'project' ? 'COMPLEX' : 'SIMPLE';
  const downtime = severity === 'CRITICAL' ? 4 : severity === 'HIGH' ? 2 : 0.5;

  const mitigation: string[] = [];
  if (severity === 'CRITICAL' || severity === 'HIGH') {
    mitigation.push(`Thiết lập redundancy cho ${entity.name} — hiện là SPOF với ${directDeps.length} hệ thống phụ thuộc`);
    mitigation.push(`Tạo runbook khôi phục ${entity.name} trong < ${downtime}h`);
    mitigation.push(`Backup/failover mechanism cho ${entity.name}`);
  } else {
    mitigation.push(`${entity.name} có ít dependency — rủi ro thấp`);
    mitigation.push(`Duy trì monitoring thông thường`);
  }

  const impactSummary = affectedCount === 0 ? 'không có hệ thống nào bị ảnh hưởng'
    : `${directDeps.length} hệ thống trực tiếp + ${cascade.length} cascade`;

  const simulation_vi = [
    `🔴 Kịch bản: ${entity.name} (${entity.type}) bị lỗi`,
    ``,
    `📊 Tác động: ${impactSummary}`,
    directDeps.length > 0 ? `   Trực tiếp: ${directDeps.slice(0, 5).join(', ')}` : '',
    cascade.length > 0 ? `   Cascade: ${cascade.slice(0, 5).join(', ')}` : '',
    ``,
    `⏱ Ước tính downtime: ~${downtime}h`,
    `🔧 Độ phức tạp khôi phục: ${complexity}`,
    `⚠️ Severity: ${severity}`,
  ].filter(Boolean).join('\n');

  return {
    scenario: `Failure of ${entity.name}`,
    entity_name: entity.name,
    entity_type: entity.type,
    direct_impact: directDeps,
    cascade_impact: cascade,
    affected_count: affectedCount,
    severity,
    recovery_complexity: complexity,
    estimated_downtime_hours: downtime,
    mitigation_vi: mitigation,
    simulation_vi,
  };
}

// ── Owner absence simulation ──────────────────────────────────────────────────

export interface OwnerAbsenceResult {
  owner_role: string;
  tasks_at_risk: string[];
  blockers_unaddressed: number;
  coverage_vi: string;
  recommendation_vi: string;
}

export function simulateOwnerAbsence(role: string): OwnerAbsenceResult {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(MEM_DB, { readonly: true });

    const ROLE_MAP: Record<string, string[]> = {
      dev1: ['developer', 'engineering_manager'],
      qa: ['qa_agent', 'qa'],
      pm: ['product_manager'],
    };
    const roles = ROLE_MAP[role.toLowerCase()] || [role];
    const ph = roles.map(() => '?').join(',');

    const recent = db.prepare(
      `SELECT action_type, COUNT(*) as c FROM owner_actions WHERE agent_role IN (${ph}) AND ts >= ?
       GROUP BY action_type ORDER BY c DESC LIMIT 5`
    ).all(...roles, new Date(Date.now() - 7 * 86_400_000).toISOString()) as any[];

    const openBlockers = db.prepare(
      `SELECT COUNT(*) as c FROM incidents WHERE resolved=0 AND agent_role IN (${ph})`
    ).get(...roles) as any;

    db.close();

    const tasks = recent.map(r => `${r.action_type} (${r.c}x/week)`);
    const blockerCount = openBlockers?.c || 0;

    const displayRole = { dev1: 'Dev1', qa: 'QA Agent', pm: 'PM Agent' }[role.toLowerCase()] || role;

    return {
      owner_role: displayRole,
      tasks_at_risk: tasks,
      blockers_unaddressed: blockerCount,
      coverage_vi: tasks.length === 0
        ? `${displayRole} chưa có hoạt động gần đây — impact thấp`
        : `${displayRole} đang phụ trách: ${tasks.slice(0, 3).map(t => t.split(' ')[0]).join(', ')}`,
      recommendation_vi: blockerCount > 0
        ? `${blockerCount} blocker sẽ không được xử lý. Cần assign lại cho agent khác.`
        : `Workload của ${displayRole} có thể được phân bổ lại mà không ảnh hưởng nghiêm trọng.`,
    };
  } catch {
    return { owner_role: role, tasks_at_risk: [], blockers_unaddressed: 0, coverage_vi: 'Không có dữ liệu', recommendation_vi: 'Cần thêm dữ liệu lịch sử' };
  }
}

// ── Get all twin entities ──────────────────────────────────────────────────────

export function getAllTwinEntities(): TwinEntity[] {
  const { entities, edges } = loadGraph();
  return entities.map(e => {
    const dependents = edges.filter(ed => ed.to_id === e.id && ed.relationship === 'depends_on')
      .map(ed => entities.find((ent: any) => ent.id === ed.from_id)?.name || ed.from_id);
    const dependencies = edges.filter(ed => ed.from_id === e.id && ed.relationship === 'depends_on')
      .map(ed => entities.find((ent: any) => ent.id === ed.to_id)?.name || ed.to_id);
    const score = Math.min(100, dependents.length * 15 + dependencies.length * 5);
    return { id: e.id, name: e.name, type: e.type, criticality_score: score, dependents, dependencies };
  }).sort((a, b) => b.criticality_score - a.criticality_score);
}
