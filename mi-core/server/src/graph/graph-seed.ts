/**
 * Graph Seed — Phase 14
 * Seeds the Mi project ownership + dependency graph with known entities.
 * Idempotent — safe to call on every boot.
 */

import { upsertEntity, upsertEdge } from './graph-db';

export function seedGraph(): void {
  // ── Entities: Owners ────────────────────────────────────────────────────────

  upsertEntity({ id: 'owner:hoang', name: 'Hoang Le (CEO)', type: 'owner', description: 'CEO and sole decision maker', metadata: { email: 'hoang.d.le@gmail.com', role: 'CEO' } });
  upsertEntity({ id: 'team:dev', name: 'Dev Team', type: 'team', description: 'Mi development team', metadata: { members: ['hoang'] } });

  // ── Entities: Projects ──────────────────────────────────────────────────────

  upsertEntity({ id: 'project:dashboard', name: 'Dashboard', type: 'project', description: 'dashboard.bakudanramen.com — main CEO ops interface', metadata: { url: 'https://dashboard.bakudanramen.com', status: 'production' } });
  upsertEntity({ id: 'project:mi-core', name: 'Mi-Core', type: 'project', description: 'Central AI operating backend — port 4001', metadata: { port: 4001, status: 'production' } });
  upsertEntity({ id: 'project:whatsapp-gateway', name: 'WhatsApp AI Gateway', type: 'project', description: 'CEO WhatsApp command channel', metadata: { status: 'production' } });
  upsertEntity({ id: 'project:review-automation', name: 'Review Automation', type: 'project', description: 'mi-review-approvals — code review pipeline', metadata: { status: 'production' } });
  upsertEntity({ id: 'project:knowledge-universe', name: 'Knowledge Universe', type: 'project', description: 'SQLite FTS5 knowledge base — 8000+ docs', metadata: { status: 'production' } });
  upsertEntity({ id: 'project:visibility', name: 'Visibility Layer', type: 'project', description: 'Food safety + project connector visibility', metadata: { status: 'production' } });
  upsertEntity({ id: 'project:antigravity', name: 'Antigravity Gateway', type: 'project', description: 'External API gateway layer', metadata: { status: 'production' } });
  upsertEntity({ id: 'project:jarvis', name: 'Jarvis', type: 'project', description: 'Executive personality + proactive monitor', metadata: { status: 'production' } });

  // ── Entities: Services ──────────────────────────────────────────────────────

  upsertEntity({ id: 'service:pm2', name: 'PM2 Process Manager', type: 'service', description: 'Process orchestrator for all Node.js services', metadata: { critical: true } });
  upsertEntity({ id: 'service:gstack', name: 'GStack Pipeline', type: 'service', description: 'Full execution pipeline — Dev3 Operating Backend', metadata: { status: 'production' } });
  upsertEntity({ id: 'service:skill-registry', name: 'Skill Registry V2', type: 'service', description: 'AgentSkill discovery + trust scoring', metadata: { phase: 11 } });
  upsertEntity({ id: 'service:pm-agent', name: 'PM Agent', type: 'service', description: 'Requirement analysis + scope + risk before execution', metadata: { phase: 13 } });
  upsertEntity({ id: 'service:qa-engine', name: 'QA Certification Engine', type: 'service', description: '5-gate QA certification', metadata: { phase: 6 } });
  upsertEntity({ id: 'service:evidence-engine', name: 'Evidence Engine', type: 'service', description: 'Per-WO evidence file collection', metadata: { phase: 6 } });
  upsertEntity({ id: 'service:whatsapp-client', name: 'WhatsApp Client', type: 'service', description: 'WhatsApp Business API session', metadata: { critical: true } });
  upsertEntity({ id: 'service:model-router', name: 'Model Router', type: 'service', description: 'Routes AI requests to correct model provider', metadata: {} });

  // ── Entities: Stores ────────────────────────────────────────────────────────

  upsertEntity({ id: 'store:sqlite-knowledge', name: 'Knowledge SQLite DB', type: 'store', description: 'FTS5 knowledge base — 8000+ indexed docs', metadata: { path: 'mi-core/data/knowledge.db' } });
  upsertEntity({ id: 'store:sqlite-qb', name: 'QuickBooks DB', type: 'store', description: 'Financial data store', metadata: { path: 'mi-core/data/qb-agent.db' } });
  upsertEntity({ id: 'store:skills-registry', name: 'Skills Registry JSON', type: 'store', description: 'AgentSkill definitions + metrics', metadata: { path: '.local-agent-global/skills/registry.json' } });
  upsertEntity({ id: 'store:evidence-dir', name: 'Evidence Directory', type: 'store', description: 'Per-WO evidence files', metadata: { path: '.local-agent-global/evidence/' } });
  upsertEntity({ id: 'store:graph-db', name: 'Graph Database', type: 'store', description: 'Ownership + dependency graph', metadata: { path: '.local-agent-global/graph/graph.db' } });

  // ── Entities: Repositories ──────────────────────────────────────────────────

  upsertEntity({ id: 'repo:master', name: 'E:/Project/Master', type: 'repository', description: 'Mono-repo: all Mi projects', metadata: { branch: 'main' } });

  // ── Edges: Ownership ────────────────────────────────────────────────────────

  const owns = (owner: string, target: string, weight = 10) => upsertEdge({ from_id: owner, to_id: target, relationship: 'owner_of', weight, metadata: {} });
  owns('owner:hoang', 'project:dashboard');
  owns('owner:hoang', 'project:mi-core');
  owns('owner:hoang', 'project:whatsapp-gateway');
  owns('owner:hoang', 'project:review-automation');
  owns('owner:hoang', 'project:knowledge-universe');
  owns('owner:hoang', 'project:visibility');
  owns('owner:hoang', 'project:antigravity');
  owns('owner:hoang', 'project:jarvis');
  owns('team:dev', 'service:gstack');
  owns('team:dev', 'service:skill-registry');
  owns('team:dev', 'service:pm-agent');
  owns('team:dev', 'service:qa-engine');

  const responsible = (owner: string, target: string) => upsertEdge({ from_id: owner, to_id: target, relationship: 'responsible_for', weight: 8, metadata: {} });
  responsible('owner:hoang', 'store:sqlite-knowledge');
  responsible('owner:hoang', 'store:skills-registry');
  responsible('owner:hoang', 'store:evidence-dir');

  // ── Edges: Dependencies ─────────────────────────────────────────────────────

  const dep = (from: string, to: string, weight = 7, meta: Record<string,unknown> = {}) =>
    upsertEdge({ from_id: from, to_id: to, relationship: 'depends_on', weight, metadata: meta });

  // Dashboard depends on mi-core (hard dependency — api calls)
  dep('project:dashboard', 'project:mi-core', 9, { type: 'api', endpoint: '/api/*' });
  // Dashboard depends on visibility layer
  dep('project:dashboard', 'project:visibility', 6, { type: 'data' });
  // Review Automation depends on mi-core
  dep('project:review-automation', 'project:mi-core', 8, { type: 'api', endpoint: '/api/mi/review-approvals' });
  // WhatsApp gateway depends on mi-core
  dep('project:whatsapp-gateway', 'project:mi-core', 9, { type: 'api', critical: true });
  // Jarvis depends on mi-core
  dep('project:jarvis', 'project:mi-core', 8, { type: 'internal' });
  // Knowledge Universe is internal to mi-core
  dep('project:mi-core', 'project:knowledge-universe', 5, { type: 'internal' });
  // Antigravity depends on mi-core
  dep('project:antigravity', 'project:mi-core', 7, { type: 'api' });
  // GStack depends on skill-registry + evidence-engine
  dep('service:gstack', 'service:skill-registry', 9, { type: 'internal' });
  dep('service:gstack', 'service:evidence-engine', 8, { type: 'internal' });
  dep('service:gstack', 'service:pm-agent', 7, { type: 'internal' });
  dep('service:gstack', 'service:qa-engine', 8, { type: 'internal' });
  // All projects depend on PM2
  dep('project:mi-core', 'service:pm2', 10, { type: 'process', critical: true });
  dep('project:dashboard', 'service:pm2', 10, { type: 'process', critical: true });
  dep('project:whatsapp-gateway', 'service:pm2', 9, { type: 'process' });
  // WhatsApp gateway depends on WhatsApp client
  dep('project:whatsapp-gateway', 'service:whatsapp-client', 9, { type: 'external', critical: true });
  // Stores
  dep('project:knowledge-universe', 'store:sqlite-knowledge', 10, { type: 'storage' });
  dep('service:skill-registry', 'store:skills-registry', 9, { type: 'storage' });
  dep('service:evidence-engine', 'store:evidence-dir', 9, { type: 'storage' });
  dep('project:mi-core', 'store:graph-db', 3, { type: 'storage', optional: true });

  // ── Edges: Contains ─────────────────────────────────────────────────────────

  const contains = (parent: string, child: string) => upsertEdge({ from_id: parent, to_id: child, relationship: 'contains', weight: 5, metadata: {} });
  contains('project:mi-core', 'service:gstack');
  contains('project:mi-core', 'service:skill-registry');
  contains('project:mi-core', 'service:pm-agent');
  contains('project:mi-core', 'service:qa-engine');
  contains('project:mi-core', 'service:evidence-engine');
  contains('project:mi-core', 'service:model-router');
  contains('project:mi-core', 'project:knowledge-universe');
  contains('project:mi-core', 'project:jarvis');
  contains('repo:master', 'project:mi-core');
  contains('repo:master', 'project:dashboard');
  contains('repo:master', 'project:review-automation');

  // ── Edges: Supports ─────────────────────────────────────────────────────────

  upsertEdge({ from_id: 'service:pm2', to_id: 'project:mi-core', relationship: 'supports', weight: 10, metadata: { critical: true } });
  upsertEdge({ from_id: 'service:pm2', to_id: 'project:whatsapp-gateway', relationship: 'supports', weight: 9, metadata: {} });
  upsertEdge({ from_id: 'service:model-router', to_id: 'project:jarvis', relationship: 'supports', weight: 7, metadata: {} });
}
