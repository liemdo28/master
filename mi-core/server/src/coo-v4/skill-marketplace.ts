/**
 * Domain H — AgentSkill Marketplace
 * Versioned skill registry with reliability scores, trust scores, execution history.
 * Skills are the atomic capabilities that agents expose.
 */

import fs   from 'fs';
import path from 'path';
import type { Skill, SkillExecution, AgentDomain } from './types';

const GLOBAL_DIR = process.env.MI_CORE_ROOT
  ? path.join(process.env.MI_CORE_ROOT, '.local-agent-global')
  : 'D:/Project/Master/.local-agent-global';
const STORE_PATH = path.join(GLOBAL_DIR, 'coo-v4', 'skills.json');

// ── Persistence ────────────────────────────────────────────────────────────

function load(): Skill[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return getBuiltinSkills();
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch { return getBuiltinSkills(); }
}

function save(skills: Skill[]): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(skills, null, 2));
}

// ── Built-in skill catalogue ───────────────────────────────────────────────

function getBuiltinSkills(): Skill[] {
  const now = new Date().toISOString();
  const skill = (
    id: string, name: string, version: string, description: string,
    agent: AgentDomain, inputs: Record<string,string>, outputs: Record<string,string>,
    tags: string[],
  ): Skill => ({
    id, name, version, description, agent,
    input_schema: inputs, output_schema: outputs,
    reliability: 90, trust_score: 85, executions: 0, failures: 0, avg_duration_ms: 0,
    tags, enabled: true, registered_at: now,
  });

  return [
    // Domain D — AI Developer
    skill('ai_dev.read_source',    'Read Source Code',   '1.0', 'Read and understand source files', 'ai_developer',
      { path: 'string', pattern: 'string?' }, { content: 'string', summary: 'string' }, ['code', 'read']),
    skill('ai_dev.modify_source',  'Modify Source Code', '1.0', 'Apply code changes via patch', 'ai_developer',
      { path: 'string', changes: 'string', reason: 'string' }, { diff: 'string', applied: 'boolean' }, ['code', 'write']),
    skill('ai_dev.run_tests',      'Run Tests',          '1.0', 'Execute test suite and return results', 'ai_developer',
      { project: 'string', test_cmd: 'string?' }, { passed: 'number', failed: 'number', output: 'string' }, ['test', 'qa']),
    skill('ai_dev.create_patch',   'Create Patch',       '1.0', 'Create a git patch from changes', 'ai_developer',
      { description: 'string', files: 'string[]' }, { patch_path: 'string', diff: 'string' }, ['code', 'git']),

    // Domain E — SWE Agent (bug fix)
    skill('swe.diagnose_bug',    'Diagnose Bug',    '1.0', 'Analyze error and trace root cause', 'swe_agent',
      { error: 'string', context: 'string?' }, { root_cause: 'string', fix_suggestion: 'string' }, ['bug', 'debug']),
    skill('swe.fix_bug',         'Fix Bug',         '1.0', 'Apply bug fix to source', 'swe_agent',
      { bug_description: 'string', file: 'string' }, { fixed: 'boolean', diff: 'string' }, ['bug', 'fix']),

    // Domain F — Aider (code review / refactor)
    skill('aider.review',        'Code Review',     '1.0', 'Review code for quality issues', 'code_reviewer',
      { path: 'string', focus: 'string?' }, { findings: 'string[]', score: 'number' }, ['review', 'quality']),
    skill('aider.refactor',      'Refactor Code',   '1.0', 'Improve code structure', 'code_reviewer',
      { path: 'string', goal: 'string' }, { diff: 'string', improvements: 'string[]' }, ['refactor', 'quality']),

    // Domain G — Production Gate
    skill('gate.security_review','Security Review', '1.0', 'Check for OWASP top 10 vulnerabilities', 'code_gate',
      { code: 'string', language: 'string' }, { pass: 'boolean', issues: 'string[]', severity: 'string' }, ['security', 'gate']),
    skill('gate.logic_review',   'Logic Review',    '1.0', 'Verify business logic correctness', 'code_gate',
      { code: 'string', spec: 'string' }, { pass: 'boolean', issues: 'string[]' }, ['logic', 'gate']),

    // Domain J — Browser
    skill('browser.navigate',    'Navigate URL',    '1.0', 'Open a URL in Playwright', 'browser',
      { url: 'string' }, { title: 'string', screenshot: 'string?' }, ['browser', 'playwright']),
    skill('browser.fill_form',   'Fill Form',       '1.0', 'Fill and submit a web form', 'browser',
      { url: 'string', fields: 'object', submit: 'boolean?' }, { success: 'boolean', response: 'string' }, ['browser', 'form']),
    skill('browser.login',       'Login to Site',   '1.0', 'Authenticate to a web service', 'browser',
      { url: 'string', username: 'string', password: 'string' }, { session: 'string', success: 'boolean' }, ['browser', 'auth']),
    skill('browser.upload',      'Upload File',     '1.0', 'Upload a file via browser', 'browser',
      { url: 'string', file_path: 'string', field: 'string' }, { success: 'boolean' }, ['browser', 'upload']),
    skill('browser.screenshot',  'Take Screenshot', '1.0', 'Capture page screenshot', 'browser',
      { url: 'string' }, { image_path: 'string' }, ['browser', 'capture']),

    // Domain K — Computer Use
    skill('computer.open_app',   'Open Application','1.0', 'Launch a desktop application', 'computer',
      { app_name: 'string' }, { success: 'boolean' }, ['desktop', 'app']),
    skill('computer.run_excel',  'Run Excel Task',  '1.0', 'Execute operation in Excel/Sheets', 'computer',
      { file: 'string', operation: 'string', data: 'object?' }, { result: 'object' }, ['excel', 'desktop']),
    skill('computer.quickbooks', 'QuickBooks Op',   '1.0', 'Interact with QuickBooks', 'computer',
      { operation: 'string', params: 'object' }, { result: 'object' }, ['quickbooks', 'accounting']),

    // Domain L — Google Workspace
    skill('workspace.sheets_read',  'Read Sheets',   '1.0', 'Read data from Google Sheets', 'workspace',
      { sheet_id: 'string', range: 'string' }, { data: 'array', headers: 'array' }, ['sheets', 'read']),
    skill('workspace.sheets_write', 'Write Sheets',  '1.0', 'Write data to Google Sheets', 'workspace',
      { sheet_id: 'string', range: 'string', data: 'array' }, { updated: 'number' }, ['sheets', 'write']),
    skill('workspace.drive_upload', 'Upload Drive',  '1.0', 'Upload file to Google Drive', 'workspace',
      { file_path: 'string', folder_id: 'string?' }, { file_id: 'string', url: 'string' }, ['drive', 'upload']),
    skill('workspace.gmail_send',   'Send Gmail',    '1.0', 'Send email via Gmail', 'workspace',
      { to: 'string', subject: 'string', body: 'string' }, { message_id: 'string' }, ['gmail', 'email']),
    skill('workspace.docs_create',  'Create Doc',    '1.0', 'Create Google Doc', 'workspace',
      { title: 'string', content: 'string' }, { doc_id: 'string', url: 'string' }, ['docs', 'create']),

    // Domain M — Bookkeeper
    skill('bookkeeper.categorize', 'Categorize Transaction', '1.0', 'Categorize a financial transaction', 'bookkeeper',
      { amount: 'number', description: 'string', date: 'string' }, { category: 'string', confidence: 'number' }, ['bookkeeping', 'classify']),
    skill('bookkeeper.reconcile',  'Reconcile Account',      '1.0', 'Match bank transactions to books', 'bookkeeper',
      { account: 'string', period: 'string' }, { matched: 'number', unmatched: 'number', discrepancies: 'array' }, ['reconcile', 'finance']),
    skill('bookkeeper.find_dups',  'Find Duplicates',        '1.0', 'Detect duplicate transactions', 'bookkeeper',
      { account: 'string', date_range: 'string' }, { duplicates: 'array', total_amount: 'number' }, ['bookkeeping', 'audit']),

    // Domain N — Accountant
    skill('accountant.pl',         'Generate P&L',       '1.0', 'Generate Profit & Loss statement', 'accountant',
      { period: 'string', store: 'string?' }, { revenue: 'number', expenses: 'number', profit: 'number', report: 'string' }, ['pl', 'finance']),
    skill('accountant.balance',    'Balance Sheet',      '1.0', 'Generate balance sheet', 'accountant',
      { date: 'string' }, { assets: 'number', liabilities: 'number', equity: 'number', report: 'string' }, ['balance', 'finance']),
    skill('accountant.month_end',  'Month End Close',    '1.0', 'Execute month-end close procedures', 'accountant',
      { month: 'string', year: 'string' }, { adjustments: 'array', closed: 'boolean' }, ['month_end', 'finance']),

    // Domain O — CFO
    skill('cfo.forecast',          'Cash Flow Forecast', '1.0', 'Forecast cash flow for period', 'cfo',
      { months: 'number' }, { forecast: 'array', risk_flags: 'array', summary: 'string' }, ['forecast', 'finance']),
    skill('cfo.store_analysis',    'Store Analysis',     '1.0', 'Analyze store performance', 'cfo',
      { store: 'string', period: 'string' }, { revenue: 'number', trends: 'array', recommendation: 'string' }, ['store', 'analysis']),
    skill('cfo.recommendation',    'Business Rec',       '1.0', 'Generate CFO business recommendations', 'cfo',
      { context: 'string' }, { recommendations: 'array', priority: 'string' }, ['cfo', 'strategy']),

    // Domain P — Tax
    skill('tax.prepare_package',   'Prepare Tax Package','1.0', 'Compile documents for tax filing', 'tax',
      { year: 'string', type: 'string' }, { documents: 'array', checklist: 'array', ready: 'boolean' }, ['tax', 'prepare']),
    skill('tax.fill_form',         'Fill Tax Form',      '1.0', 'Fill a tax form (requires approval)', 'tax',
      { form_type: 'string', data: 'object' }, { filled: 'boolean', preview_url: 'string' }, ['tax', 'form']),

    // Domain Q — Marketing Factory
    skill('marketing.create_flyer','Create Flyer',       '1.0', 'Generate marketing flyer (ComfyUI)', 'marketing',
      { template: 'string', content: 'object' }, { image_path: 'string', preview: 'string' }, ['flyer', 'design']),
    skill('marketing.create_video','Create Video',       '1.0', 'Generate marketing video (Wan/Hunyuan)', 'marketing',
      { script: 'string', style: 'string', duration: 'number?' }, { video_path: 'string' }, ['video', 'reel']),
    skill('marketing.seo_article', 'Write SEO Article',  '1.0', 'Create SEO-optimized article', 'marketing',
      { topic: 'string', keywords: 'string[]', length: 'number?' }, { article: 'string', word_count: 'number' }, ['seo', 'content']),
    skill('marketing.voiceover',   'Voiceover',          '1.0', 'Generate Vietnamese voiceover (OpenVoice)', 'marketing',
      { text: 'string', voice: 'string?' }, { audio_path: 'string', duration: 'number' }, ['voice', 'audio']),

    // Domain R — Website
    skill('website.publish_post',  'Publish Blog Post',  '1.0', 'Publish post to WordPress', 'website',
      { title: 'string', content: 'string', category: 'string?' }, { post_id: 'string', url: 'string' }, ['wordpress', 'publish']),
    skill('website.update_page',   'Update Page',        '1.0', 'Update a WordPress page', 'website',
      { page_id: 'string', content: 'string' }, { success: 'boolean', url: 'string' }, ['wordpress', 'update']),
    skill('website.seo_optimize',  'SEO Optimize',       '1.0', 'Optimize page for search engines', 'website',
      { url: 'string', keywords: 'string[]' }, { score: 'number', changes: 'array' }, ['seo', 'optimize']),

    // Domain S — Social Media
    skill('social.post_facebook',  'Post to Facebook',   '1.0', 'Publish to Facebook page', 'social',
      { content: 'string', image: 'string?', schedule: 'string?' }, { post_id: 'string', url: 'string' }, ['facebook', 'social']),
    skill('social.post_instagram', 'Post to Instagram',  '1.0', 'Publish to Instagram', 'social',
      { caption: 'string', image: 'string', hashtags: 'string[]?' }, { post_id: 'string' }, ['instagram', 'social']),
    skill('social.post_tiktok',    'Post to TikTok',     '1.0', 'Upload video to TikTok', 'social',
      { video_path: 'string', caption: 'string' }, { video_id: 'string' }, ['tiktok', 'social']),
    skill('social.schedule',       'Schedule Posts',     '1.0', 'Schedule social media posts', 'social',
      { posts: 'array', schedule: 'object' }, { scheduled: 'number', failed: 'number' }, ['social', 'schedule']),

    // Domain X — Self Improvement
    skill('self.detect_failures',  'Detect Bad Skills',  '1.0', 'Find under-performing skills', 'self_improve',
      { period_days: 'number?' }, { bad_skills: 'array', slow_skills: 'array' }, ['analysis', 'improve']),
    skill('self.recommend',        'Recommend Upgrades', '1.0', 'Suggest skill improvements', 'self_improve',
      { findings: 'array' }, { recommendations: 'array', priority: 'string[]' }, ['improve', 'recommend']),
  ];
}

// ── Registry API ───────────────────────────────────────────────────────────

let _cache: Skill[] | null = null;
function skills(): Skill[] {
  if (!_cache) _cache = load();
  return _cache;
}
function persist() { if (_cache) save(_cache); }

export function getAllSkills(): Skill[] { return skills(); }
export function getEnabledSkills(): Skill[] { return skills().filter(s => s.enabled); }

export function getSkill(id: string): Skill | undefined {
  return skills().find(s => s.id === id);
}

export function findSkills(query: string, agent?: AgentDomain): Skill[] {
  const q = query.toLowerCase();
  return skills().filter(s =>
    s.enabled &&
    (agent ? s.agent === agent : true) &&
    (s.name.toLowerCase().includes(q) ||
     s.description.toLowerCase().includes(q) ||
     s.tags.some(t => t.includes(q)))
  ).sort((a, b) => b.trust_score - a.trust_score);
}

export function registerSkill(skill: Omit<Skill, 'executions' | 'failures' | 'avg_duration_ms' | 'registered_at'>): Skill {
  const existing = getSkill(skill.id);
  if (existing) {
    Object.assign(existing, { ...skill, executions: existing.executions, failures: existing.failures });
    persist();
    return existing;
  }
  const newSkill: Skill = {
    ...skill, executions: 0, failures: 0, avg_duration_ms: 0,
    registered_at: new Date().toISOString(),
  };
  skills().push(newSkill);
  persist();
  return newSkill;
}

export function recordExecution(exec: SkillExecution): void {
  const skill = getSkill(exec.skill_id);
  if (!skill) return;
  skill.executions++;
  if (!exec.success) skill.failures++;
  const prev_avg = skill.avg_duration_ms;
  skill.avg_duration_ms = Math.round(
    (prev_avg * (skill.executions - 1) + exec.duration_ms) / skill.executions
  );
  // Recalculate trust score: success_rate * reliability baseline
  const success_rate = skill.executions > 0 ? ((skill.executions - skill.failures) / skill.executions) : 1;
  skill.trust_score = Math.round(success_rate * 100);
  persist();
}

export function getSkillStats() {
  const all = skills();
  return {
    total: all.length,
    enabled: all.filter(s => s.enabled).length,
    avg_trust: Math.round(all.reduce((s, sk) => s + sk.trust_score, 0) / Math.max(all.length, 1)),
    by_agent: Object.fromEntries(
      [...new Set(all.map(s => s.agent))].map(a => [a, all.filter(s => s.agent === a).length])
    ),
    low_trust: all.filter(s => s.trust_score < 50 && s.executions >= 5).map(s => s.id),
  };
}

export function upgradeSkillVersion(id: string, newVersion: string, changes: Partial<Skill>): Skill | undefined {
  const skill = getSkill(id);
  if (!skill) return;
  const upgraded: Skill = { ...skill, ...changes, version: newVersion, executions: 0, failures: 0, registered_at: new Date().toISOString() };
  skills().push({ ...upgraded, id: `${id}@${newVersion}` });
  Object.assign(skill, changes, { version: newVersion });
  persist();
  return skill;
}
