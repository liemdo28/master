/**
 * Phase 34B — Task Classifier
 * Analyzes a plain-text objective and extracts structured classification.
 */

export interface TaskClassification {
  domain:      string;
  language:    string;
  framework:   string;
  complexity:  'low' | 'medium' | 'high' | 'critical';
  task_type:   string;
  is_p0:       boolean;
  is_production: boolean;
  keywords:    string[];
}

// ── Keyword maps ──────────────────────────────────────────────────────────────

const LANGUAGE_SIGNALS: Record<string, string[]> = {
  typescript:  ['typescript', 'ts', '.ts', 'tsx'],
  javascript:  ['javascript', 'js', 'node', 'nodejs', 'express', 'react', 'vue', 'next'],
  python:      ['python', 'py', 'django', 'flask', 'fastapi', 'pandas', 'numpy'],
  sql:         ['sql', 'query', 'database', 'postgres', 'mysql', 'sqlite', 'db'],
  php:         ['php', 'laravel', 'wordpress', 'blade'],
  go:          ['golang', 'go '],
  swift:       ['swift', 'ios', 'xcode'],
  kotlin:      ['kotlin', 'android'],
};

const FRAMEWORK_SIGNALS: Record<string, string[]> = {
  laravel:     ['laravel', 'blade', 'artisan', 'eloquent'],
  express:     ['express', 'expressjs', 'middleware', 'route'],
  react:       ['react', 'jsx', 'tsx', 'component', 'hook'],
  nextjs:      ['next.js', 'nextjs', 'next ', 'getserversideprops', 'getstaticprops'],
  'pm2':       ['pm2', 'ecosystem', 'process manager'],
  playwright:  ['playwright', 'e2e', 'end-to-end'],
  sqlite:      ['sqlite', 'better-sqlite', 'wal'],
};

const DOMAIN_SIGNALS: Record<string, string[]> = {
  dashboard:   ['dashboard', 'agenview', 'liveboard', 'ui', 'panel'],
  api:         ['api', 'endpoint', 'route', 'rest', 'graphql', 'webhook'],
  database:    ['database', 'schema', 'migration', 'query', 'index'],
  auth:        ['auth', 'login', 'token', 'jwt', 'session', 'permission', 'rbac'],
  deployment:  ['deploy', 'pm2', 'docker', 'ci', 'pipeline', 'release'],
  seo:         ['seo', 'meta', 'sitemap', 'canonical', 'keyword'],
  analytics:   ['analytics', 'ga4', 'tracking', 'event', 'metric'],
  integration: ['integration', 'connector', 'sync', 'webhook', 'sftp'],
  bugfix:      ['bug', 'fix', 'broken', 'error', 'crash', 'fail', '500', '404'],
  feature:     ['add', 'build', 'create', 'implement', 'new feature'],
  refactor:    ['refactor', 'cleanup', 'optimize', 'improve', 'restructure'],
};

const COMPLEXITY_SIGNALS: Record<'high' | 'critical', string[]> = {
  critical: ['p0', 'critical', 'production down', 'outage', 'urgent', 'hotfix'],
  high:     ['architecture', 'migration', 'refactor entire', 'security', 'multi-file', 'performance'],
};

// ── Classifier ────────────────────────────────────────────────────────────────

export function classifyTask(objective: string): TaskClassification {
  const lower = objective.toLowerCase();
  const words = lower.split(/\s+/);

  // Language detection
  let language = 'typescript';
  for (const [lang, signals] of Object.entries(LANGUAGE_SIGNALS)) {
    if (signals.some(s => lower.includes(s))) {
      language = lang;
      break;
    }
  }

  // Framework detection
  let framework = 'unknown';
  for (const [fw, signals] of Object.entries(FRAMEWORK_SIGNALS)) {
    if (signals.some(s => lower.includes(s))) {
      framework = fw;
      break;
    }
  }

  // Domain detection (first match wins)
  let domain = 'general';
  for (const [dom, signals] of Object.entries(DOMAIN_SIGNALS)) {
    if (signals.some(s => lower.includes(s))) {
      domain = dom;
      break;
    }
  }

  // Complexity
  let complexity: TaskClassification['complexity'] = 'low';
  if (COMPLEXITY_SIGNALS.critical.some(s => lower.includes(s))) {
    complexity = 'critical';
  } else if (COMPLEXITY_SIGNALS.high.some(s => lower.includes(s))) {
    complexity = 'high';
  } else if (words.length > 15 || lower.includes('multi') || lower.includes('entire')) {
    complexity = 'medium';
  }

  // Task type
  let task_type = 'feature';
  if (lower.match(/\b(fix|bug|broken|error|crash)\b/)) task_type = 'bugfix';
  else if (lower.match(/\b(refactor|cleanup|optimize)\b/)) task_type = 'refactor';
  else if (lower.match(/\b(review|audit|analyze|check)\b/)) task_type = 'review';
  else if (lower.match(/\b(test|spec|coverage)\b/)) task_type = 'testing';
  else if (lower.match(/\b(deploy|release|ship)\b/)) task_type = 'deployment';
  else if (lower.match(/\b(add|build|create|implement|new)\b/)) task_type = 'feature';

  const is_p0 = complexity === 'critical' || lower.includes('p0');
  const is_production = lower.includes('prod') || lower.includes('live') || is_p0;

  // Extract keywords (unique meaningful words)
  const stopwords = new Set(['the', 'a', 'an', 'is', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'fix', 'bug']);
  const keywords = words.filter(w => w.length > 3 && !stopwords.has(w)).slice(0, 8);

  return { domain, language, framework, complexity, task_type, is_p0, is_production, keywords };
}
