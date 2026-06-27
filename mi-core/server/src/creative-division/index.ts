/**
 * Phase 6 — Creative Division
 * Video, Image, Design, Content Assets
 */
import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';

export interface CreativeAsset {
  id: string;
  type: 'video' | 'image' | 'flyer' | 'banner' | 'social_post' | 'article';
  brand: string;
  status: 'draft' | 'approved' | 'published' | 'archived';
  generatedAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
  platform: string | null;
  path: string | null;
}

export interface CreativePipeline {
  name: string;
  tool: string;
  status: 'active' | 'needs_config' | 'down';
  outputTypes: string[];
}

export interface CreativeDashboard {
  status: 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED';
  assets: CreativeAsset[];
  pipelines: CreativePipeline[];
  warnings: string[];
}

export function getCreativePipelines(): CreativePipeline[] {
  return [
    { name: 'Restaurant Creative Engine', tool: 'ComfyUI + Flux', status: 'active', outputTypes: ['image', 'flyer'] },
    { name: 'Video Generation', tool: 'Wan/Hunyuan', status: 'needs_config', outputTypes: ['video', 'reel'] },
    { name: 'SEO Article Writer', tool: 'Ollama/Qwen', status: 'active', outputTypes: ['article'] },
    { name: 'Voiceover', tool: 'OpenVoice', status: 'needs_config', outputTypes: ['audio'] },
    { name: 'Social Media Scheduler', tool: 'Mixpost', status: 'needs_config', outputTypes: ['social_post'] },
  ];
}

export function getCreativeAssets(): CreativeAsset[] {
  return [
    { id: 'CRE-001', type: 'flyer', brand: 'bakudan', status: 'draft', generatedAt: '2026-06-26T10:00:00Z', approvedBy: null, publishedAt: null, platform: null, path: null },
    { id: 'CRE-002', type: 'article', brand: 'bakudan', status: 'draft', generatedAt: '2026-06-26T11:00:00Z', approvedBy: null, publishedAt: null, platform: null, path: '.local-agent-global/seo-drafts/bakudan-tonkotsu-20260626.md' },
    { id: 'CRE-003', type: 'article', brand: 'raw_sushi', status: 'draft', generatedAt: '2026-06-26T11:05:00Z', approvedBy: null, publishedAt: null, platform: null, path: '.local-agent-global/seo-drafts/rawsushi-omakase-20260626.md' },
    { id: 'CRE-004', type: 'video', brand: 'bakudan', status: 'draft', generatedAt: null, approvedBy: null, publishedAt: null, platform: null, path: null },
    { id: 'CRE-005', type: 'social_post', brand: 'bakudan', status: 'draft', generatedAt: null, approvedBy: null, publishedAt: null, platform: 'instagram', path: null },
  ];
}

export function buildCreativeDashboard(): CreativeDashboard {
  const assets = getCreativeAssets();
  const pipelines = getCreativePipelines();
  const warnings: string[] = [];
  if (pipelines.some(p => p.status === 'down')) warnings.push('Some creative pipelines are down.');
  if (pipelines.some(p => p.status === 'needs_config')) warnings.push('Some creative pipelines need configuration (WAN_API_URL, OPENVOICE_URL, Mixpost).');
  if (assets.every(a => a.status === 'draft')) warnings.push('No creative assets are approved or published yet.');
  const status = warnings.length > 0 ? 'PARTIAL' : 'OPERATIONAL';
  return { status, assets, pipelines, warnings };
}

export function runCreativeBootstrap() {
  const objective = createRegisteredObjective('Phase 6 Creative Division', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Creative Division Engines',
    description: 'Video, Image, Design, and Content Asset Pipeline.',
    division: 'creative',
    owner: 'creative-division',
    approvalRequired: 'none',
  });
  const dashboard = buildCreativeDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `creative-division:assets:${dashboard.assets.length};pipelines:${dashboard.pipelines.length};status:${dashboard.status}`,
    capturedAt: new Date().toISOString(),
  });
  return { objective, task, dashboard };
}

export { buildCreativeDashboard as buildDashboard };