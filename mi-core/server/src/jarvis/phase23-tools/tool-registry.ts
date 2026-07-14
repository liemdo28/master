/**
 * Phase 23 — Tool Registry
 * Every tool is registered, permissioned, and health-checked.
 */

export type RiskLevel = 0 | 1 | 2 | 3;  // 0=safe, 1=low, 2=medium, 3=high

export interface RegisteredTool {
  id: string;
  name: string;
  description: string;
  owner: string;
  category: 'communication' | 'storage' | 'compute' | 'business' | 'monitoring' | 'automation';
  risk: RiskLevel;
  approval_required: boolean;
  permissions: string[];
  endpoint?: string;
  health?: 'healthy' | 'degraded' | 'offline' | 'unknown';
  last_health_check?: string;
  enabled: boolean;
}

const TOOLS: RegisteredTool[] = [
  { id: 'gmail.search', name: 'Gmail Search', description: 'Search CEO emails', owner: 'google', category: 'communication', risk: 0, approval_required: false, permissions: ['gmail.read'], health: 'unknown', enabled: true },
  { id: 'gmail.send', name: 'Gmail Send', description: 'Send email on CEO behalf', owner: 'google', category: 'communication', risk: 2, approval_required: true, permissions: ['gmail.send'], health: 'unknown', enabled: true },
  { id: 'drive.search', name: 'Drive Search', description: 'Search Google Drive files', owner: 'google', category: 'storage', risk: 0, approval_required: false, permissions: ['drive.read'], health: 'unknown', enabled: true },
  { id: 'drive.create', name: 'Drive Create', description: 'Create file in Google Drive', owner: 'google', category: 'storage', risk: 1, approval_required: false, permissions: ['drive.write'], health: 'unknown', enabled: true },
  { id: 'excel.create', name: 'Excel Create', description: 'Disabled pending safe Excel writer replacement', owner: 'mi-core', category: 'automation', risk: 0, approval_required: false, permissions: [], health: 'offline', enabled: false },
  { id: 'node.status', name: 'Node Status', description: 'Check node health', owner: 'mi-core', category: 'monitoring', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
  { id: 'node.restart', name: 'Node Restart', description: 'Restart a remote node', owner: 'mi-core', category: 'compute', risk: 3, approval_required: true, permissions: ['node.admin'], health: 'unknown', enabled: true },
  { id: 'project.deploy', name: 'Project Deploy', description: 'Deploy a project update', owner: 'mi-core', category: 'compute', risk: 3, approval_required: true, permissions: ['node.admin', 'deploy'], health: 'unknown', enabled: false },
  { id: 'project.logs', name: 'Project Logs', description: 'Fetch project logs', owner: 'mi-core', category: 'monitoring', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
  { id: 'project.logs.clear', name: 'Clear Logs', description: 'Clear project logs', owner: 'mi-core', category: 'compute', risk: 2, approval_required: true, permissions: ['node.admin'], health: 'healthy', enabled: true },
  { id: 'doordash.status', name: 'DoorDash Status', description: 'Check DoorDash campaign health', owner: 'doordash', category: 'business', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
  { id: 'doordash.revenue', name: 'DoorDash Revenue', description: 'Fetch DoorDash revenue data', owner: 'doordash', category: 'business', risk: 0, approval_required: false, permissions: ['finance.read'], health: 'unknown', enabled: true },
  { id: 'quickbooks.invoice', name: 'QB Invoice', description: 'Fetch QuickBooks invoices', owner: 'quickbooks', category: 'business', risk: 0, approval_required: false, permissions: ['finance.read'], health: 'unknown', enabled: false },
  { id: 'whatsapp.send', name: 'WhatsApp Send', description: 'Send outbound WhatsApp message', owner: 'mi-core', category: 'communication', risk: 1, approval_required: false, permissions: ['whatsapp.send'], health: 'healthy', enabled: true },
  { id: 'knowledge.search', name: 'Knowledge Search', description: 'Search indexed knowledge base', owner: 'mi-core', category: 'automation', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
  { id: 'memory.store', name: 'Memory Store', description: 'Store a memory entry', owner: 'mi-core', category: 'automation', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
  { id: 'memory.recall', name: 'Memory Recall', description: 'Recall memory entries', owner: 'mi-core', category: 'automation', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
  { id: 'workflow.run', name: 'Workflow Run', description: 'Execute an approved workflow', owner: 'mi-core', category: 'automation', risk: 2, approval_required: true, permissions: ['workflow.exec'], health: 'healthy', enabled: true },
  { id: 'review.summary', name: 'Review Summary', description: 'Summarize customer reviews', owner: 'mi-core', category: 'business', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
  { id: 'store.ops', name: 'Store Ops', description: 'Check store operational status', owner: 'mi-core', category: 'business', risk: 0, approval_required: false, permissions: [], health: 'healthy', enabled: true },
];

export function getAllTools(): RegisteredTool[] {
  return TOOLS;
}

export function getToolById(id: string): RegisteredTool | undefined {
  return TOOLS.find(t => t.id === id);
}

export function getToolsByCategory(category: RegisteredTool['category']): RegisteredTool[] {
  return TOOLS.filter(t => t.category === category);
}

export function getDangerousTools(): RegisteredTool[] {
  return TOOLS.filter(t => t.risk >= 2);
}

export function getToolHealth(): { healthy: number; degraded: number; offline: number; unknown: number } {
  const counts = { healthy: 0, degraded: 0, offline: 0, unknown: 0 };
  for (const t of TOOLS) {
    if (t.health) counts[t.health]++;
    else counts.unknown++;
  }
  return counts;
}

export function formatToolRegistryForWhatsApp(): string {
  const enabled = TOOLS.filter(t => t.enabled);
  const byCategory: Record<string, string[]> = {};
  for (const t of enabled) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    const risk = ['🟢', '🟡', '🟠', '🔴'][t.risk];
    byCategory[t.category].push(`${risk} ${t.id}${t.approval_required ? ' ⚠️' : ''}`);
  }
  const lines = Object.entries(byCategory).map(([cat, tools]) =>
    `*${cat.toUpperCase()}*\n${tools.join('\n')}`
  );
  return `🔧 *Tool Registry — ${enabled.length} tools*\n\n${lines.join('\n\n')}\n\n⚠️ = requires approval`;
}

export function searchTools(query: string): RegisteredTool[] {
  const q = query.toLowerCase();
  return TOOLS.filter(t =>
    t.id.includes(q) || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );
}
