import type { OssGlobalRegistry } from '../types';

const PROJECTS = [
  ['Qwen Coder', 'Engineering', 'approved', 'engineering-division', 87, ['ollama', 'provider-executor']],
  ['DeepSeek', 'Engineering', 'candidate', 'engineering-division', 74, ['benchmark-suite']],
  ['Kimi', 'Engineering', 'candidate', 'engineering-division', 68, ['model-mapping']],
  ['OpenHands', 'Engineering', 'candidate', 'engineering-division', 72, ['sandbox']],
  ['Aider', 'Engineering', 'approved', 'engineering-division', 81, ['git']],
  ['Continue', 'Engineering', 'approved', 'engineering-division', 79, ['ide']],
  ['Playwright', 'Operator', 'approved', 'operator-runtime', 92, ['browser']],
  ['Browser Use', 'Operator', 'candidate', 'operator-runtime', 76, ['browser', 'llm']],
  ['Stagehand', 'Operator', 'candidate', 'operator-runtime', 70, ['browser']],
  ['Skyvern', 'Operator', 'candidate', 'operator-runtime', 65, ['browser']],
  ['OpenClaw', 'Operator', 'pilot', 'operator-runtime', 71, ['local-lab']],
  ['n8n', 'Workflow', 'approved', 'workflow-fabric', 86, ['cron', 'webhook']],
  ['Temporal', 'Workflow', 'candidate', 'workflow-fabric', 80, ['durable-workflows']],
  ['Langflow', 'Workflow', 'candidate', 'workflow-fabric', 67, ['llm-flows']],
  ['Flowise', 'Workflow', 'candidate', 'workflow-fabric', 66, ['llm-flows']],
  ['DuckDB', 'Data', 'approved', 'data-platform', 90, ['local-warehouse']],
  ['dbt', 'Data', 'candidate', 'data-platform', 78, ['warehouse']],
  ['Airbyte', 'Data', 'candidate', 'data-platform', 75, ['connectors']],
  ['Meltano', 'Data', 'candidate', 'data-platform', 73, ['connectors']],
  ['Metabase', 'Data', 'candidate', 'data-platform', 77, ['dashboard']],
  ['Superset', 'Data', 'candidate', 'data-platform', 69, ['dashboard']],
  ['PostHog', 'Marketing', 'candidate', 'marketing-intelligence', 77, ['events']],
  ['Matomo', 'Marketing', 'candidate', 'marketing-intelligence', 72, ['analytics']],
  ['Plausible', 'Marketing', 'candidate', 'marketing-intelligence', 70, ['analytics']],
  ['Mautic', 'Marketing', 'candidate', 'marketing-intelligence', 68, ['campaigns']],
  ['Mixpost', 'Marketing', 'candidate', 'marketing-intelligence', 73, ['social']],
  ['Postiz', 'Marketing', 'candidate', 'marketing-intelligence', 71, ['social']],
  ['ComfyUI', 'Creative', 'approved', 'creative-division', 84, ['image']],
  ['Fooocus', 'Creative', 'candidate', 'creative-division', 65, ['image']],
  ['Penpot', 'Creative', 'candidate', 'creative-division', 76, ['design']],
  ['FFmpeg', 'Creative', 'approved', 'creative-division', 91, ['video']],
  ['Blender', 'Creative', 'candidate', 'creative-division', 75, ['3d']],
  ['Uptime Kuma', 'IT', 'candidate', 'it-operations', 82, ['monitoring']],
  ['Grafana', 'IT', 'candidate', 'it-operations', 79, ['metrics']],
  ['Prometheus', 'IT', 'candidate', 'it-operations', 80, ['metrics']],
  ['OpenObserve', 'IT', 'candidate', 'it-operations', 74, ['logs']],
  ['Kopia', 'IT', 'candidate', 'it-operations', 78, ['backup']],
  ['Restic', 'IT', 'candidate', 'it-operations', 77, ['backup']],
] as const;

export function buildOssGlobalRegistry(): OssGlobalRegistry {
  const projects = PROJECTS.map(([name, category, lifecycle, owner, score, dependencies]) => ({
    name,
    category,
    lifecycle,
    owner,
    score,
    dependencies: [...dependencies],
  }));
  return {
    generatedAt: new Date().toISOString(),
    projects,
    categories: Array.from(new Set(projects.map(p => p.category))),
  };
}

export function buildOssLifecycleDashboard() {
  const registry = buildOssGlobalRegistry();
  const byLifecycle: Record<string, number> = {};
  for (const project of registry.projects) {
    byLifecycle[project.lifecycle] = (byLifecycle[project.lifecycle] || 0) + 1;
  }
  return {
    generatedAt: registry.generatedAt,
    categories: registry.categories.length,
    projects: registry.projects.length,
    byLifecycle,
    rule: 'candidate -> approved -> pilot -> production requires owner, scorecard, security/license evidence, and CEO approval.',
  };
}

export function buildOssGlobalScorecard() {
  const registry = buildOssGlobalRegistry();
  return {
    generatedAt: registry.generatedAt,
    averageScore: Math.round(registry.projects.reduce((sum, p) => sum + p.score, 0) / registry.projects.length),
    topProjects: registry.projects.slice().sort((a, b) => b.score - a.score).slice(0, 8),
    blockedProduction: registry.projects.filter(p => p.lifecycle !== 'production').length,
    truthWarning: 'Scores are local governance scores; production promotion still needs live license/security review.',
  };
}

export function buildOssDependencyMap() {
  const registry = buildOssGlobalRegistry();
  return {
    generatedAt: registry.generatedAt,
    edges: registry.projects.flatMap(p => p.dependencies.map(dep => ({ from: p.name, to: dep }))),
    owners: Array.from(new Set(registry.projects.map(p => p.owner))),
  };
}
