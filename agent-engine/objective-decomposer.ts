/**
 * Phase 20 — Objective Decomposer
 * Converts CEO objectives into structured task trees with department assignments.
 * 
 * Flow: receiveObjective → decomposeObjective → createTasks → assignDepartments
 */

export type Department = 
  | 'engineering' 
  | 'qa' 
  | 'infrastructure' 
  | 'finance' 
  | 'restaurant-intelligence' 
  | 'reporting'
  | 'executive-assistant';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'assigned' | 'in-progress' | 'evidence-collected' | 'qa-pending' | 'qa-passed' | 'qa-failed' | 'completed' | 'failed';

export interface DecomposedTask {
  id: string;
  title: string;
  description: string;
  department: Department;
  priority: TaskPriority;
  status: TaskStatus;
  evidence: EvidenceItem[];
  qaResult: QAResult | null;
  dependencies: string[];
  estimatedMinutes: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface EvidenceItem {
  id: string;
  type: 'file-scan' | 'route-audit' | 'log-check' | 'test-run' | 'health-check' | 'code-analysis' | 'config-audit';
  description: string;
  result: any;
  collectedAt: string;
}

export interface QAResult {
  passed: boolean;
  score: number;
  checks: { name: string; passed: boolean; detail: string }[];
  reviewedAt: string;
}

export interface ObjectiveDecomposition {
  id: string;
  objective: string;
  receivedAt: string;
  tasks: DecomposedTask[];
  status: 'decomposing' | 'executing' | 'qa' | 'reporting' | 'completed' | 'failed';
  report: string | null;
}

/**
 * Keyword-to-department routing map for autonomous department assignment.
 */
const DEPARTMENT_ROUTING: Record<string, Department[]> = {
  // Engineering-related
  'dashboard': ['engineering', 'qa', 'reporting'],
  'login': ['engineering', 'qa'],
  'auth': ['engineering', 'qa'],
  'fix': ['engineering', 'qa'],
  'bug': ['engineering', 'qa'],
  'code': ['engineering', 'qa'],
  'route': ['engineering', 'qa'],
  'api': ['engineering', 'qa'],
  'dead code': ['engineering', 'qa'],
  'test': ['engineering', 'qa'],
  'health check': ['engineering', 'qa'],
  'pm2': ['infrastructure', 'engineering'],
  'service': ['infrastructure'],
  'server': ['infrastructure'],
  'deploy': ['infrastructure', 'engineering'],
  
  // Business-related
  'restaurant': ['restaurant-intelligence', 'reporting'],
  'menu': ['restaurant-intelligence'],
  'competitor': ['restaurant-intelligence'],
  'sentiment': ['restaurant-intelligence'],
  'customer': ['restaurant-intelligence'],
  
  // Finance-related
  'finance': ['finance', 'reporting'],
  'cost': ['finance', 'reporting'],
  'budget': ['finance', 'reporting'],
  'revenue': ['finance', 'reporting'],
  'invoice': ['finance'],
  
  // Infrastructure
  'connectivity': ['infrastructure', 'finance'],
  'database': ['infrastructure'],
  'redis': ['infrastructure'],
  'cache': ['infrastructure'],
  
  // Reporting (always included)
  'report': ['reporting'],
  'audit': ['engineering', 'qa', 'reporting'],
  'brief': ['executive-assistant', 'reporting'],
  'summary': ['executive-assistant', 'reporting'],
};

/**
 * Task templates — pre-defined decomposition patterns for common objectives.
 */
const TASK_TEMPLATES: Record<string, (obj: string) => DecomposedTask[]> = {
  'audit-dashboard': (obj) => [
    {
      id: '', title: 'Investigate dashboard routes and structure',
      description: 'Scan all dashboard route files, identify active routes, check for broken imports',
      department: 'engineering', priority: 'high', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 5,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Check PM2 process status',
      description: 'Verify PM2 processes are running, check restart counts, memory usage',
      department: 'infrastructure', priority: 'high', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 3,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Audit Mi-Core health endpoints',
      description: 'Check health check routes, verify response codes, test connectivity',
      department: 'engineering', priority: 'high', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 5,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Scan for dead code and unused modules',
      description: 'Identify unreferenced files, unused exports, orphaned modules',
      department: 'engineering', priority: 'normal', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 8,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Check for failing tests',
      description: 'Run available test suites, collect results',
      department: 'qa', priority: 'high', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 10,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Identify missing health checks',
      description: 'Map all services and verify health check coverage',
      department: 'engineering', priority: 'normal', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 5,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Run QA validation',
      description: 'Quality assurance review of all findings',
      department: 'qa', priority: 'critical', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 5,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Generate executive report',
      description: 'Compile all findings into structured CEO report',
      department: 'reporting', priority: 'critical', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 3,
      startedAt: null, completedAt: null,
    },
  ],

  'default': (obj) => [
    {
      id: '', title: `Investigate: ${obj}`,
      description: `Analyze and gather evidence for: ${obj}`,
      department: 'engineering', priority: 'high', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 10,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: `Execute: ${obj}`,
      description: `Implement findings for: ${obj}`,
      department: 'engineering', priority: 'high', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 15,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'QA Review',
      description: 'Quality assurance of execution results',
      department: 'qa', priority: 'critical', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 5,
      startedAt: null, completedAt: null,
    },
    {
      id: '', title: 'Generate Report',
      description: 'Compile findings into structured report',
      department: 'reporting', priority: 'critical', status: 'pending',
      evidence: [], qaResult: null, dependencies: [], estimatedMinutes: 3,
      startedAt: null, completedAt: null,
    },
  ],
};

/**
 * Decompose an objective string into structured tasks with department assignments.
 */
export function decomposeObjective(objective: string): ObjectiveDecomposition {
  const id = `obj-${Date.now()}`;
  const normalizedObj = objective.toLowerCase().trim();
  
  // Try to match a task template
  let tasks: DecomposedTask[];
  
  if (normalizedObj.includes('dashboard') && (normalizedObj.includes('audit') || normalizedObj.includes('check') || normalizedObj.includes('attention'))) {
    tasks = TASK_TEMPLATES['audit-dashboard'](objective);
  } else {
    tasks = TASK_TEMPLATES['default'](objective);
  }
  
  // Assign IDs
  tasks = tasks.map((t, i) => ({
    ...t,
    id: `${id}-task-${i + 1}`,
  }));
  
  // Infer additional departments from keywords
  const inferredDepts = inferDepartments(normalizedObj);
  for (const task of tasks) {
    if (inferredDepts.includes(task.department) || inferredDepts.some(d => !tasks.some(t => t.department === d))) {
      // Already has good department coverage
    }
  }
  
  return {
    id,
    objective,
    receivedAt: new Date().toISOString(),
    tasks,
    status: 'decomposing',
    report: null,
  };
}

/**
 * Infer relevant departments from objective text.
 */
function inferDepartments(text: string): Department[] {
  const depts: Department[] = [];
  
  for (const [keywords, departments] of Object.entries(DEPARTMENT_ROUTING)) {
    if (text.includes(keywords)) {
      for (const dept of departments) {
        if (!depts.includes(dept)) depts.push(dept);
      }
    }
  }
  
  // Always include reporting in the flow
  if (!depts.includes('reporting')) depts.push('reporting');
  
  return depts;
}

/**
 * Generate decomposition summary for evidence tracking.
 */
export function summarizeDecomposition(decomp: ObjectiveDecomposition): string {
  const depts = [...new Set(decomp.tasks.map(t => t.department))];
  const totalEst = decomp.tasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  
  return [
    `Objective: ${decomp.objective}`,
    `Tasks: ${decomp.tasks.length}`,
    `Departments: ${depts.join(', ')}`,
    `Estimated time: ${totalEst} minutes`,
    `Task breakdown:`,
    ...decomp.tasks.map((t, i) => `  ${i + 1}. [${t.department}] ${t.title} (~${t.estimatedMinutes}min)`),
  ].join('\n');
}
