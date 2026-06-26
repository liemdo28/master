import type { OssCategory, OssProject } from './types';

const now = () => new Date().toISOString();

const candidates: Record<OssCategory, Array<{ name: string; github: string; maintenance_cost: OssProject['maintenance_cost']; risk: OssProject['risk']; roi: number }>> = {
  Engineering: [
    { name: 'Qwen Coder', github: 'https://github.com/QwenLM/Qwen', maintenance_cost: 'medium', risk: 'medium', roi: 88 },
    { name: 'DeepSeek', github: 'https://github.com/deepseek-ai', maintenance_cost: 'medium', risk: 'medium', roi: 82 },
    { name: 'Kimi', github: 'https://github.com/MoonshotAI', maintenance_cost: 'medium', risk: 'unknown', roi: 78 },
    { name: 'OpenHands', github: 'https://github.com/All-Hands-AI/OpenHands', maintenance_cost: 'high', risk: 'medium', roi: 80 },
    { name: 'Aider', github: 'https://github.com/Aider-AI/aider', maintenance_cost: 'medium', risk: 'low', roi: 76 },
    { name: 'Continue', github: 'https://github.com/continuedev/continue', maintenance_cost: 'medium', risk: 'low', roi: 74 },
  ],
  Operator: [
    { name: 'Playwright', github: 'https://github.com/microsoft/playwright', maintenance_cost: 'low', risk: 'low', roi: 92 },
    { name: 'Browser Use', github: 'https://github.com/browser-use/browser-use', maintenance_cost: 'medium', risk: 'medium', roi: 84 },
    { name: 'OpenClaw', github: 'https://github.com/openclaw/openclaw', maintenance_cost: 'unknown', risk: 'unknown', roi: 65 },
    { name: 'Skyvern', github: 'https://github.com/Skyvern-AI/skyvern', maintenance_cost: 'high', risk: 'medium', roi: 78 },
    { name: 'Stagehand', github: 'https://github.com/browserbase/stagehand', maintenance_cost: 'medium', risk: 'medium', roi: 80 },
  ],
  Finance: [
    { name: 'DuckDB', github: 'https://github.com/duckdb/duckdb', maintenance_cost: 'low', risk: 'low', roi: 90 },
    { name: 'dbt', github: 'https://github.com/dbt-labs/dbt-core', maintenance_cost: 'medium', risk: 'low', roi: 82 },
    { name: 'Metabase', github: 'https://github.com/metabase/metabase', maintenance_cost: 'medium', risk: 'low', roi: 78 },
    { name: 'Superset', github: 'https://github.com/apache/superset', maintenance_cost: 'high', risk: 'medium', roi: 75 },
    { name: 'ERPNext', github: 'https://github.com/frappe/erpnext', maintenance_cost: 'high', risk: 'medium', roi: 72 },
  ],
  Marketing: [
    { name: 'PostHog', github: 'https://github.com/PostHog/posthog', maintenance_cost: 'medium', risk: 'medium', roi: 82 },
    { name: 'Mautic', github: 'https://github.com/mautic/mautic', maintenance_cost: 'medium', risk: 'medium', roi: 70 },
    { name: 'Airbyte', github: 'https://github.com/airbytehq/airbyte', maintenance_cost: 'high', risk: 'medium', roi: 76 },
    { name: 'Plausible', github: 'https://github.com/plausible/analytics', maintenance_cost: 'low', risk: 'low', roi: 74 },
  ],
  IT: [
    { name: 'Grafana', github: 'https://github.com/grafana/grafana', maintenance_cost: 'medium', risk: 'low', roi: 88 },
    { name: 'Prometheus', github: 'https://github.com/prometheus/prometheus', maintenance_cost: 'medium', risk: 'low', roi: 86 },
    { name: 'OpenObserve', github: 'https://github.com/openobserve/openobserve', maintenance_cost: 'medium', risk: 'medium', roi: 78 },
    { name: 'Portainer', github: 'https://github.com/portainer/portainer', maintenance_cost: 'low', risk: 'low', roi: 72 },
  ],
  Creative: [
    { name: 'ComfyUI', github: 'https://github.com/comfyanonymous/ComfyUI', maintenance_cost: 'medium', risk: 'medium', roi: 78 },
    { name: 'Fooocus', github: 'https://github.com/lllyasviel/Fooocus', maintenance_cost: 'medium', risk: 'medium', roi: 68 },
    { name: 'Open WebUI', github: 'https://github.com/open-webui/open-webui', maintenance_cost: 'medium', risk: 'medium', roi: 74 },
  ],
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getSeedCandidates(): OssProject[] {
  const stamp = now();
  return Object.entries(candidates).flatMap(([category, projects]) =>
    projects.map((project) => ({
      project_id: `OSS-${slug(project.name)}`,
      name: project.name,
      category: category as OssCategory,
      github: project.github,
      owner_division: category.toLowerCase(),
      status: 'Discovery',
      roi: project.roi,
      maintenance_cost: project.maintenance_cost,
      license: 'UNVERIFIED',
      risk: project.risk,
      evidence: [
        {
          type: 'registry',
          value: 'Seeded from MI_COMPANY_OS_MASTER_SPEC current candidates. License requires live audit before Pilot.',
          capturedAt: stamp,
        },
      ],
      createdAt: stamp,
      updatedAt: stamp,
    }))
  );
}
