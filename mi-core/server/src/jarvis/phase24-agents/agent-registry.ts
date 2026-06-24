/**
 * Phase 24 — Agent Ecosystem
 * Specialized agents: PM, Finance, Store, Dev, Knowledge, Node.
 * Each agent has capabilities, routing rules, and a health state.
 */

export type AgentStatus = 'active' | 'idle' | 'degraded' | 'offline';

export interface AgentCapability {
  id: string;
  description: string;
  trigger_patterns: string[];  // regex patterns on normalized input
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  mode: 'local' | 'external';
  endpoint?: string;
  handled_count: number;
  last_active?: string;
}

const AGENTS: Agent[] = [
  {
    id: 'pm-agent',
    name: 'PM Agent',
    description: 'Project management: roadmap, sprint, blockers, tasks, milestones',
    status: 'active',
    mode: 'local',
    handled_count: 0,
    capabilities: [
      { id: 'roadmap', description: 'Show project roadmap', trigger_patterns: ['roadmap', 'lo trinh', 'ke hoach'] },
      { id: 'sprint', description: 'Sprint status', trigger_patterns: ['sprint', 'iteration'] },
      { id: 'blockers', description: 'List blockers', trigger_patterns: ['blocker', 'bi tac', 'van de'] },
      { id: 'tasks', description: 'Task management', trigger_patterns: ['task', 'cong viec', 'nhiem vu'] },
    ],
  },
  {
    id: 'finance-agent',
    name: 'Finance Agent',
    description: 'Revenue, payroll, invoices, QuickBooks, DoorDash earnings',
    status: 'active',
    mode: 'local',
    handled_count: 0,
    capabilities: [
      { id: 'revenue', description: 'Revenue overview', trigger_patterns: ['revenue', 'doanh thu', 'thu nhap'] },
      { id: 'payroll', description: 'Payroll status', trigger_patterns: ['payroll', 'luong', 'tra luong'] },
      { id: 'invoice', description: 'Invoice lookup', trigger_patterns: ['invoice', 'hoa don'] },
    ],
  },
  {
    id: 'store-agent',
    name: 'Store Agent',
    description: 'Restaurant operations: staffing, food safety, reviews, performance',
    status: 'active',
    mode: 'local',
    handled_count: 0,
    capabilities: [
      { id: 'ops', description: 'Store operations', trigger_patterns: ['cua hang', 'store', 'stone oak', 'bandera', 'bakudan'] },
      { id: 'reviews', description: 'Customer reviews', trigger_patterns: ['review', 'danh gia', 'feedback'] },
      { id: 'food-safety', description: 'Food safety status', trigger_patterns: ['food safety', 'an toan thuc pham'] },
    ],
  },
  {
    id: 'dev-agent',
    name: 'Dev Agent',
    description: 'Code, deployment, GitHub, CI/CD, technical tasks',
    status: 'active',
    mode: 'local',
    handled_count: 0,
    capabilities: [
      { id: 'deploy', description: 'Deployment status', trigger_patterns: ['deploy', 'release', 'build'] },
      { id: 'github', description: 'GitHub status', trigger_patterns: ['github', 'commit', 'pr', 'pull request'] },
      { id: 'bugs', description: 'Bug tracking', trigger_patterns: ['bug', 'error', 'loi', 'fix'] },
    ],
  },
  {
    id: 'knowledge-agent',
    name: 'Knowledge Agent',
    description: 'Search docs, files, reports, memory across all sources',
    status: 'active',
    mode: 'local',
    handled_count: 0,
    capabilities: [
      { id: 'search', description: 'Knowledge search', trigger_patterns: ['tim', 'search', 'where', 'dau', 'o dau'] },
      { id: 'recall', description: 'Memory recall', trigger_patterns: ['nho', 'recall', 'truoc day', 'lich su'] },
      { id: 'summarize', description: 'Summarize content', trigger_patterns: ['tom tat', 'summary', 'tóm tắt'] },
    ],
  },
  {
    id: 'node-agent',
    name: 'Node Agent',
    description: 'Remote node control: status, restart, logs, health monitoring',
    status: 'idle',
    mode: 'external',
    endpoint: 'http://localhost:3221/api',  // mi-node-agent on Laptop1
    handled_count: 0,
    capabilities: [
      { id: 'status', description: 'Node health status', trigger_patterns: ['laptop', 'node', 'may', 'server'] },
      { id: 'restart', description: 'Restart a service', trigger_patterns: ['restart', 'reboot', 'khoi dong'] },
      { id: 'logs', description: 'Fetch logs', trigger_patterns: ['log', 'nhat ky'] },
    ],
  },
];

export function getAllAgents(): Agent[] { return AGENTS; }

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find(a => a.id === id);
}

export function routeToAgent(input: string): Agent | null {
  const normalized = input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const agent of AGENTS) {
    if (agent.status === 'offline') continue;
    for (const cap of agent.capabilities) {
      if (cap.trigger_patterns.some(p => new RegExp(p, 'i').test(normalized))) {
        agent.handled_count++;
        agent.last_active = new Date().toISOString();
        return agent;
      }
    }
  }
  return null;
}

export function getAgentHealth(): Record<string, AgentStatus> {
  const health: Record<string, AgentStatus> = {};
  for (const a of AGENTS) health[a.id] = a.status;
  return health;
}

export function formatAgentEcosystemForWhatsApp(): string {
  const lines = AGENTS.map(a => {
    const icon = a.status === 'active' ? '✅' : a.status === 'idle' ? '⏸' : a.status === 'degraded' ? '🟡' : '🔴';
    return `${icon} *${a.name}* (${a.mode}) — ${a.description.slice(0, 60)}`;
  });
  const active = AGENTS.filter(a => a.status === 'active').length;
  return `🤖 *Agent Ecosystem — ${active}/${AGENTS.length} active*\n\n${lines.join('\n')}`;
}
