/**
 * Mi Company OS — Source Inventory
 * Classifies every tool/model/package in the system.
 * No-bloat rule: ACTIVE | SHADOW | INSTALLED_NOT_USED | BROKEN | DEPRECATED | REMOVE
 */

export type SourceClass = 'ACTIVE' | 'SHADOW' | 'INSTALLED_NOT_USED' | 'BROKEN' | 'DEPRECATED' | 'REMOVE';

export interface SourceEntry {
  id: string;
  name: string;
  type: 'model' | 'tool' | 'package' | 'service' | 'db';
  class: SourceClass;
  used_by: string[];           // dept ids that use this
  last_seen?: string;          // ISO date
  removal_reason?: string;
  notes?: string;
}

export const SOURCE_INVENTORY: SourceEntry[] = [
  // ── AI Models ──────────────────────────────────────────────────────────────
  { id: 'qwen3-14b',     name: 'qwen3:14b',              type: 'model', class: 'ACTIVE',            used_by: ['dispatch', 'finance', 'rd', 'competitive-intel', 'investment-fp'] },
  { id: 'qwen3-8b',      name: 'qwen3:8b',               type: 'model', class: 'ACTIVE',            used_by: ['executive-assistant', 'report-center', 'library', 'restaurant-intelligence', 'marketing', 'website-studio', 'video-studio', 'crm', 'hr'] },
  { id: 'gemma3-12b',    name: 'gemma3:12b',             type: 'model', class: 'ACTIVE',            used_by: ['qa'] },
  { id: 'qwen25-coder',  name: 'qwen2.5-coder:7b',       type: 'model', class: 'ACTIVE',            used_by: ['engineering'] },
  { id: 'qwen3-1.7b',   name: 'qwen3:1.7b',             type: 'model', class: 'DEPRECATED',       used_by: [], removal_reason: 'REMOVED 2026-06-18: Too small. No department uses it.', last_seen: '2026-06-18' },
  { id: 'deepseek-r1-14b', name: 'deepseek-r1:14b',    type: 'model', class: 'DEPRECATED',       used_by: [], removal_reason: 'REMOVED 2026-06-18: High VRAM. qwen3:14b covers same cases.', last_seen: '2026-06-18' },

  // ── Core Tools (Phase 14-25) ──────────────────────────────────────────────
  { id: 'gstack',        name: 'GStack Runtime',          type: 'tool',  class: 'ACTIVE',           used_by: ['dispatch'] },
  { id: 'intent-router', name: 'Intent Router',           type: 'tool',  class: 'ACTIVE',           used_by: ['dispatch'] },
  { id: 'jarvis-core',   name: 'Jarvis Core (Ph30)',       type: 'tool',  class: 'ACTIVE',           used_by: ['dispatch'] },
  { id: 'coo-v4',        name: 'COO Orchestrator v4',     type: 'tool',  class: 'ACTIVE',           used_by: ['dispatch', 'marketing', 'engineering'] },
  { id: 'approval-gate', name: 'Approval Gate (Ph20)',    type: 'tool',  class: 'ACTIVE',           used_by: ['finance', 'tax-compliance', 'marketing', 'engineering', 'hr'] },
  { id: 'council',       name: 'Council (Ph21)',          type: 'tool',  class: 'ACTIVE',           used_by: ['rd'] },
  { id: 'evidence-store',name: 'Evidence Store',          type: 'db',    class: 'ACTIVE',           used_by: ['qa', 'dispatch', 'report-center'] },
  { id: 'qa-gate',       name: 'QA Gate',                 type: 'tool',  class: 'ACTIVE',           used_by: ['qa'] },
  { id: 'task-intel',    name: 'Task Intelligence (Ph16)',type: 'tool',  class: 'ACTIVE',           used_by: ['executive-assistant'] },
  { id: 'op-memory',     name: 'Operational Memory (Ph15)',type: 'db',   class: 'ACTIVE',           used_by: ['executive-assistant', 'crm', 'hr'] },
  { id: 'exec-brief',    name: 'Executive Briefing (Ph17)',type: 'tool', class: 'ACTIVE',           used_by: ['report-center'] },
  { id: 'strat-mem',     name: 'Strategic Memory (Ph18)', type: 'tool',  class: 'ACTIVE',           used_by: ['report-center', 'investment-fp'] },
  { id: 'agenview',      name: 'AgenView (Ph19)',         type: 'tool',  class: 'ACTIVE',           used_by: ['report-center'] },
  { id: 'autonomous',    name: 'Autonomous Engine (Ph20)',type: 'tool',  class: 'ACTIVE',           used_by: ['technical-operations'] },
  { id: 'self-improve',  name: 'Self-Improve (Ph22)',     type: 'tool',  class: 'ACTIVE',           used_by: ['qa'] },
  { id: 'health-intel',  name: 'Health Intel (Ph23)',     type: 'tool',  class: 'ACTIVE',           used_by: ['executive-assistant'] },
  { id: 'digital-twin',  name: 'Digital Twin (Ph24)',     type: 'tool',  class: 'ACTIVE',           used_by: ['technical-operations'] },
  { id: 'graph',         name: 'Graph Layer (Ph14)',      type: 'db',    class: 'ACTIVE',           used_by: ['dispatch'] },
  { id: 'nodes',         name: 'Node Registry (Ph6/7)',   type: 'tool',  class: 'ACTIVE',           used_by: ['technical-operations'] },

  // ── External Services ─────────────────────────────────────────────────────
  { id: 'toast',         name: 'Toast POS Connector',     type: 'service', class: 'ACTIVE',         used_by: ['restaurant-intelligence'] },
  { id: 'doordash-agent',name: 'DoorDash Agent',         type: 'service', class: 'ACTIVE',         used_by: ['restaurant-intelligence'] },
  { id: 'food-safety',   name: 'Food Safety Gateway',     type: 'service', class: 'ACTIVE',         used_by: ['restaurant-intelligence'] },
  { id: 'quickbooks',    name: 'QuickBooks Runtime',      type: 'service', class: 'ACTIVE',         used_by: ['finance', 'tax-compliance'] },
  { id: 'asana',         name: 'Asana Connector',         type: 'service', class: 'ACTIVE',         used_by: ['executive-assistant'] },
  { id: 'visibility',    name: 'Visibility Connector',    type: 'service', class: 'ACTIVE',         used_by: ['report-center', 'restaurant-intelligence'] },
  { id: 'knowledge-fed', name: 'Knowledge Federation',   type: 'service', class: 'ACTIVE',         used_by: ['library', 'rd', 'competitive-intel', 'hr', 'website-studio'] },
  { id: 'knowledge-db',  name: 'Knowledge DB',            type: 'db',    class: 'ACTIVE',           used_by: ['library'] },
  { id: 'playwright-mcp',name: 'Playwright MCP',          type: 'tool',  class: 'ACTIVE',           used_by: ['technical-operations', 'competitive-intel', 'website-studio'] },
  { id: 'browser-op',    name: 'Browser Operator',        type: 'tool',  class: 'ACTIVE',           used_by: ['technical-operations', 'competitive-intel', 'website-studio'] },
  { id: 'twenty-crm',    name: 'Twenty CRM',              type: 'service', class: 'PLANNED',        used_by: ['crm'], notes: 'Not yet connected. CRM dept is PLANNED.' },
  { id: 'qdrant',        name: 'Qdrant Vector DB',        type: 'service', class: 'PLANNED',        used_by: ['library'], notes: 'Library dept is PLANNED. Qdrant install pending.' },
  { id: 'outline',       name: 'Outline Wiki',            type: 'service', class: 'PLANNED',        used_by: ['library'], notes: 'Library dept is PLANNED.' },
  { id: 'paperless-ngx', name: 'Paperless-NGX',          type: 'service', class: 'INSTALLED_NOT_USED', used_by: ['tax-compliance'], notes: 'Installed but tax-compliance dept not yet active.' },

  // ── Creative Pipeline ─────────────────────────────────────────────────────
  { id: 'rest-creative', name: 'Restaurant Creative Engine', type: 'tool', class: 'ACTIVE',        used_by: ['marketing', 'brand-creative'] },
  { id: 'comfyui',       name: 'ComfyUI',                 type: 'service', class: 'ACTIVE',         used_by: ['brand-creative', 'video-studio'] },
  { id: 'wan-video',     name: 'Wan Video Model',          type: 'model', class: 'PLANNED',         used_by: ['video-studio'], notes: 'Video studio is PLANNED.' },
  { id: 'hunyuan-video', name: 'Hunyuan Video',           type: 'model', class: 'PLANNED',         used_by: ['video-studio'], notes: 'Video studio is PLANNED.' },
  { id: 'ltx-video',     name: 'LTX Video',               type: 'model', class: 'PLANNED',         used_by: ['video-studio'], notes: 'Video studio is PLANNED.' },
  { id: 'flux',          name: 'Flux Workflow',           type: 'tool',  class: 'ACTIVE',           used_by: ['brand-creative'] },

  // ── AI Coding Agents ─────────────────────────────────────────────────────
  { id: 'ai-dev-agent',  name: 'AI Developer Agent',      type: 'tool',  class: 'ACTIVE',           used_by: ['engineering'] },
  { id: 'aider',         name: 'Aider',                   type: 'tool',  class: 'ACTIVE',           used_by: ['engineering'] },
  { id: 'openhands',     name: 'OpenHands',               type: 'tool',  class: 'ACTIVE',           used_by: ['engineering'] },
  { id: 'agent-coding',  name: 'Agent Coding API Keys',   type: 'service', class: 'ACTIVE',         used_by: ['engineering'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getRemoveCandidates(): SourceEntry[] {
  return SOURCE_INVENTORY.filter(s => s.class === 'REMOVE' || s.class === 'BROKEN' || s.class === 'DEPRECATED');
}

export function getActiveSources(): SourceEntry[] {
  return SOURCE_INVENTORY.filter(s => s.class === 'ACTIVE');
}

export function getUnusedSources(): SourceEntry[] {
  return SOURCE_INVENTORY.filter(s => s.class === 'INSTALLED_NOT_USED' || s.class === 'SHADOW');
}

export function getSourcesByDept(deptId: string): SourceEntry[] {
  return SOURCE_INVENTORY.filter(s => s.used_by.includes(deptId));
}

export function sourceInventorySummary(): string {
  const counts: Record<SourceClass, number> = {
    ACTIVE: 0, SHADOW: 0, INSTALLED_NOT_USED: 0, BROKEN: 0, DEPRECATED: 0, REMOVE: 0,
  };
  for (const s of SOURCE_INVENTORY) counts[s.class]++;

  const lines = [
    `Source Inventory — ${SOURCE_INVENTORY.length} total`,
    `  ACTIVE:             ${counts.ACTIVE}`,
    `  PLANNED:            ${SOURCE_INVENTORY.filter(s => s.class === 'PLANNED' as unknown as SourceClass).length}`,
    `  INSTALLED_NOT_USED: ${counts.INSTALLED_NOT_USED}`,
    `  SHADOW:             ${counts.SHADOW}`,
    `  BROKEN:             ${counts.BROKEN}`,
    `  DEPRECATED:         ${counts.DEPRECATED}`,
    `  REMOVE:             ${counts.REMOVE}`,
  ];

  const remove = getRemoveCandidates();
  if (remove.length) {
    lines.push('', 'Remove candidates:');
    for (const r of remove) {
      lines.push(`  - ${r.name}: ${r.removal_reason || r.notes || ''}`);
    }
  }

  return lines.join('\n');
}
