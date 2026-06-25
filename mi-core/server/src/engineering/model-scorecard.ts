import * as fs from 'fs';
import * as path from 'path';
import { listTasks } from './engineering-queue';
import { listAvailableModels } from './model-registry';

const SCORECARD_PATH = path.join(process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core', 'MODEL_SCORECARD.md');

export interface ModelStats { id: string; name: string; dispatched: number; done: number; failed: number; success_rate: number; avg_score: number; domains: Record<string, number>; last_used?: string; }

export function computeScorecard(): ModelStats[] {
  const tasks = listTasks({ limit: 500 });
  const models = listAvailableModels();
  const stats: Record<string, ModelStats> = {};
  for (const m of models) stats[m.id] = { id: m.id, name: m.name, dispatched: 0, done: 0, failed: 0, success_rate: 0, avg_score: 0, domains: {} };
  const scores: Record<string, number[]> = {};
  for (const t of tasks) {
    const mid = t.selected_model; if (!mid || !stats[mid]) continue;
    stats[mid].dispatched++; if (t.status === 'DONE') stats[mid].done++; if (t.status === 'FAILED') stats[mid].failed++;
    if (t.review_score) (scores[mid] = scores[mid] || []).push(t.review_score);
    const cls = typeof t.classification === 'string' ? JSON.parse(t.classification) : (t.classification || {});
    const domain = cls.domain || 'general'; stats[mid].domains[domain] = (stats[mid].domains[domain] || 0) + 1;
    if (!stats[mid].last_used || t.created_at > stats[mid].last_used!) stats[mid].last_used = t.created_at;
  }
  for (const [mid, arr] of Object.entries(scores)) if (stats[mid] && arr.length) stats[mid].avg_score = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  for (const m of Object.values(stats)) m.success_rate = m.dispatched > 0 ? Math.round((m.done / m.dispatched) * 100) : 0;
  return Object.values(stats).sort((a, b) => b.dispatched - a.dispatched);
}

export function generateScorecardMd(): string {
  const stats = computeScorecard(); const models = listAvailableModels(); const now = new Date().toISOString().slice(0, 10);
  const rows = stats.map(s => { const top = Object.entries(s.domains).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([d])=>d).join(', ')||'—'; return `| ${s.name} | ${s.dispatched} | ${s.done} | ${s.failed} | ${s.dispatched>0?s.success_rate+'%':'—'} | ${s.avg_score>0?s.avg_score+'/100':'—'} | ${top} | ${s.last_used?.slice(0,10)||'—'} |`; });
  const defs = models.map(m => `| ${m.name} | ${m.cost} | ${m.speed} | ${m.max_context.toLocaleString()} | ${m.strengths.slice(0,3).join(', ')} |`);
  return `# Model Benchmark Scorecard\n> Generated: ${now} | Mi Engineering Division OS (Phase 34K)\n\n## Live Performance\n\n| Model | Dispatched | Done | Failed | Success% | Avg Review | Top Domains | Last Used |\n|-------|-----------|------|--------|----------|------------|-------------|----------|\n${rows.join('\n')}\n\n## Capabilities\n\n| Model | Cost | Speed | Max Context | Key Strengths |\n|-------|------|-------|-------------|---------------|\n${defs.join('\n')}\n`;
}

export function writeScorecardFile(): string {
  const md = generateScorecardMd(); fs.writeFileSync(SCORECARD_PATH, md, 'utf8'); return SCORECARD_PATH;
}
