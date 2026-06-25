<<<<<<< HEAD
=======
/**
 * Phase 34K — Model Benchmark Scorecard
 * Generates MODEL_SCORECARD.md from live task history + benchmark results.
 */

>>>>>>> seo/phase-29-revenue-execution-loop
import * as fs from 'fs';
import * as path from 'path';
import { listTasks } from './engineering-queue';
import { listAvailableModels } from './model-registry';

<<<<<<< HEAD
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
=======
const SCORECARD_PATH = path.join(
  process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core',
  'MODEL_SCORECARD.md'
);

export interface ModelStats {
  id:           string;
  name:         string;
  dispatched:   number;
  done:         number;
  failed:       number;
  success_rate: number;
  avg_score:    number;
  domains:      Record<string, number>;
  last_used?:   string;
}

export function computeScorecard(): ModelStats[] {
  const tasks = listTasks(500);
  const models = listAvailableModels();

  const stats: Record<string, ModelStats> = {};
  for (const m of models) {
    stats[m.id] = {
      id: m.id, name: m.name,
      dispatched: 0, done: 0, failed: 0,
      success_rate: 0, avg_score: 0, domains: {},
    };
  }

  const scores: Record<string, number[]> = {};

  for (const t of tasks) {
    const mid = t.selected_model;
    if (!mid || !stats[mid]) continue;

    stats[mid].dispatched++;
    if (t.status === 'DONE')   stats[mid].done++;
    if (t.status === 'FAILED') stats[mid].failed++;
    if (t.review_score)        (scores[mid] = scores[mid] || []).push(t.review_score);

    const domain = t.classification?.domain || 'general';
    stats[mid].domains[domain] = (stats[mid].domains[domain] || 0) + 1;

    if (!stats[mid].last_used || t.created_at > stats[mid].last_used!) {
      stats[mid].last_used = t.created_at;
    }
  }

  for (const [mid, arr] of Object.entries(scores)) {
    if (stats[mid] && arr.length) {
      stats[mid].avg_score = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
  }

  for (const m of Object.values(stats)) {
    m.success_rate = m.dispatched > 0
      ? Math.round((m.done / m.dispatched) * 100)
      : 0;
  }

>>>>>>> seo/phase-29-revenue-execution-loop
  return Object.values(stats).sort((a, b) => b.dispatched - a.dispatched);
}

export function generateScorecardMd(): string {
<<<<<<< HEAD
  const stats = computeScorecard(); const models = listAvailableModels(); const now = new Date().toISOString().slice(0, 10);
  const rows = stats.map(s => { const top = Object.entries(s.domains).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([d])=>d).join(', ')||'—'; return `| ${s.name} | ${s.dispatched} | ${s.done} | ${s.failed} | ${s.dispatched>0?s.success_rate+'%':'—'} | ${s.avg_score>0?s.avg_score+'/100':'—'} | ${top} | ${s.last_used?.slice(0,10)||'—'} |`; });
  const defs = models.map(m => `| ${m.name} | ${m.cost} | ${m.speed} | ${m.max_context.toLocaleString()} | ${m.strengths.slice(0,3).join(', ')} |`);
  return `# Model Benchmark Scorecard\n> Generated: ${now} | Mi Engineering Division OS (Phase 34K)\n\n## Live Performance\n\n| Model | Dispatched | Done | Failed | Success% | Avg Review | Top Domains | Last Used |\n|-------|-----------|------|--------|----------|------------|-------------|----------|\n${rows.join('\n')}\n\n## Capabilities\n\n| Model | Cost | Speed | Max Context | Key Strengths |\n|-------|------|-------|-------------|---------------|\n${defs.join('\n')}\n`;
}

export function writeScorecardFile(): string {
  const md = generateScorecardMd(); fs.writeFileSync(SCORECARD_PATH, md, 'utf8'); return SCORECARD_PATH;
=======
  const stats    = computeScorecard();
  const models   = listAvailableModels();
  const now      = new Date().toISOString().slice(0, 10);

  const rows = stats.map(s => {
    const topDomains = Object.entries(s.domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([d]) => d)
      .join(', ') || '—';
    const score = s.avg_score > 0 ? `${s.avg_score}/100` : '—';
    const sr    = s.dispatched > 0 ? `${s.success_rate}%` : '—';
    return `| ${s.name} | ${s.dispatched} | ${s.done} | ${s.failed} | ${sr} | ${score} | ${topDomains} | ${s.last_used?.slice(0,10) || '—'} |`;
  });

  const modelDefs = models.map(m =>
    `| ${m.name} | ${m.cost} | ${m.speed} | ${m.max_context.toLocaleString()} | ${m.strengths.slice(0,3).join(', ')} |`
  );

  return `# Model Benchmark Scorecard
> Generated: ${now} | Mi Engineering Division OS (Phase 34K)

## Live Performance (from task history)

| Model | Dispatched | Done | Failed | Success% | Avg Review | Top Domains | Last Used |
|-------|-----------|------|--------|----------|------------|-------------|-----------|
${rows.join('\n')}

## Model Capabilities

| Model | Cost | Speed | Max Context | Key Strengths |
|-------|------|-------|-------------|---------------|
${modelDefs.join('\n')}

## Routing Logic

- **qwen-coder** → Node/TS bugfixes, API work, small features (fast + cheap)
- **deepseek** → Analytics, SQL, data pipelines, Python
- **kimi** → Large-repo analysis, research, documentation
- **claude** → Architecture, security review, complex refactors
- **gpt** → Full-stack features, UI, product work
- **human-dev** → P0 production incidents, compliance, ambiguous requirements

## Notes

- Success rate = DONE / total dispatched
- Avg Review = mean score/100 from review-engine (5 checks × 20pts)
- Escalate-to-human threshold: P0 + is_production OR complexity=critical
`;
}

export function writeScorecardFile(): string {
  const md = generateScorecardMd();
  fs.writeFileSync(SCORECARD_PATH, md, 'utf8');
  return SCORECARD_PATH;
>>>>>>> seo/phase-29-revenue-execution-loop
}
