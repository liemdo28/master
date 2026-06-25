export interface TaskClassification {
  domain:      string;
  language:    string;
  framework:   string;
  complexity:  'low' | 'medium' | 'high' | 'critical';
  task_type:   'bugfix' | 'feature' | 'refactor' | 'review' | 'test' | 'deploy' | 'general';
  is_p0:       boolean;
  is_production: boolean;
  keywords:    string[];
}

const LANGUAGE_MAP: Record<string, string[]> = {
  typescript: ['typescript', 'ts', '.ts', 'tsx'],
  javascript: ['javascript', 'js', 'node', 'nodejs', 'express', 'react', 'vue'],
  python:     ['python', 'py', 'django', 'flask', 'fastapi'],
  sql:        ['sql', 'sqlite', 'postgres', 'mysql', 'query', 'database', 'db'],
  bash:       ['bash', 'shell', 'sh', 'script', 'cli'],
  go:         ['golang', ' go '],
};

const FRAMEWORK_MAP: Record<string, string[]> = {
  express:  ['express', 'router', 'middleware'],
  react:    ['react', 'component', 'jsx', 'tsx', 'hook'],
  pm2:      ['pm2', 'ecosystem', 'process manager'],
  sqlite:   ['sqlite', 'better-sqlite3', 'database'],
  playwright: ['playwright', 'browser', 'e2e'],
};

const DOMAIN_MAP: Record<string, string[]> = {
  auth:        ['auth', 'login', 'token', 'jwt', 'session', 'permission'],
  api:         ['api', 'endpoint', 'route', 'rest', 'http', 'request', 'response'],
  database:    ['database', 'db', 'query', 'migration', 'schema', 'sqlite'],
  ui:          ['dashboard', 'ui', 'frontend', 'html', 'css', 'widget'],
  deployment:  ['deploy', 'pm2', 'server', 'production', 'restart', 'ecosystem'],
  testing:     ['test', 'spec', 'unit', 'integration', 'e2e', 'playwright'],
  security:    ['security', 'vulnerability', 'xss', 'injection', 'encrypt'],
  performance: ['performance', 'slow', 'timeout', 'memory', 'optimize', 'cache'],
  integration: ['whatsapp', 'webhook', 'connector', 'integration', 'sync'],
};

const COMPLEXITY_SIGNALS: Record<string, string[]> = {
  critical: ['p0', 'production down', 'critical', 'emergency', 'urgent', 'outage', 'data loss'],
  high:     ['architecture', 'refactor', 'migration', 'breaking change', 'multi-service'],
  medium:   ['feature', 'add', 'implement', 'create', 'build'],
  low:      ['fix', 'bug', 'typo', 'update', 'minor', 'patch', 'docs'],
};

export function classifyTask(objective: string): TaskClassification {
  const lower = objective.toLowerCase();
  const keywords: string[] = [];

  // Language
  let language = 'typescript';
  for (const [lang, patterns] of Object.entries(LANGUAGE_MAP)) {
    if (patterns.some(p => lower.includes(p))) { language = lang; break; }
  }

  // Framework
  let framework = 'express';
  for (const [fw, patterns] of Object.entries(FRAMEWORK_MAP)) {
    if (patterns.some(p => lower.includes(p))) { framework = fw; break; }
  }

  // Domain
  let domain = 'api';
  for (const [dom, patterns] of Object.entries(DOMAIN_MAP)) {
    if (patterns.some(p => lower.includes(p))) {
      domain = dom;
      keywords.push(...patterns.filter(p => lower.includes(p)));
      break;
    }
  }

  // Complexity
  let complexity: TaskClassification['complexity'] = 'medium';
  for (const [level, signals] of Object.entries(COMPLEXITY_SIGNALS)) {
    if (signals.some(s => lower.includes(s))) {
      complexity = level as TaskClassification['complexity'];
      break;
    }
  }

  // Task type
  let task_type: TaskClassification['task_type'] = 'general';
  if (/fix|bug|error|crash|broken/.test(lower))       task_type = 'bugfix';
  else if (/add|create|build|implement|new/.test(lower)) task_type = 'feature';
  else if (/refactor|clean|reorganize|rename/.test(lower)) task_type = 'refactor';
  else if (/review|audit|check|analyze/.test(lower))    task_type = 'review';
  else if (/test|spec|coverage/.test(lower))            task_type = 'test';
  else if (/deploy|release|publish|ship/.test(lower))   task_type = 'deploy';

  const is_p0        = /p0|production down|critical|emergency|outage/.test(lower);
  const is_production = /production|prod |live |customer|revenue|down/.test(lower);

  return { domain, language, framework, complexity, task_type, is_p0, is_production, keywords };
}
