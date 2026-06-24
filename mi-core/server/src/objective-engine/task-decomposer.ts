/**
 * Phase 25A — Task Decomposer
 * Decomposes an objective into a structured task list with department assignments,
 * dependencies, and per-task execution plans. No human decomposition required.
 */

import type {
  ObjectiveTask,
  IntentAnalysis,
  Goal,
  Department,
  TaskPriority,
} from './types';

// ── Task template per intent category ───────────────────────────────────────

interface TaskTemplate {
  title: string;
  description: string;
  department: Department;
  priority: TaskPriority;
  estimatedMinutes: number;
}

const TRAFFIC_GROWTH_TASKS: TaskTemplate[] = [
  { title: 'Run full SEO technical audit',                  description: 'Indexing, sitemap, robots.txt, canonical tags, broken links, redirects, duplicate content, page speed, mobile usability, CWV, image alt text', department: 'seo',             priority: 'critical', estimatedMinutes: 15 },
  { title: 'Identify content opportunities',                 description: 'Scan SEO analytics for high-impressions-low-CTR pages and keywords ranking positions 4-15',  department: 'content',         priority: 'high',     estimatedMinutes: 20 },
  { title: 'Check 404 spike and broken links',                description: 'Run 404 audit and broken-link detection; produce replacement plan',                         department: 'web-engineering', priority: 'high',     estimatedMinutes: 10 },
  { title: 'Validate schema markup across all pages',         description: 'Restaurant schema, breadcrumbs, FAQ schema; ensure Google rich-result eligibility',            department: 'seo',             priority: 'high',     estimatedMinutes: 10 },
  { title: 'Audit review signals (GBP, Yelp, TripAdvisor)',   description: 'Volume, average rating, response rate, sentiment trend; identify review gaps',                  department: 'review-management', priority: 'high',   estimatedMinutes: 10 },
  { title: 'Generate landing pages for top-converting terms', description: 'Create 3-5 SEO-optimized landing pages targeting primary + long-tail keywords',              department: 'content',         priority: 'high',     estimatedMinutes: 30 },
  { title: 'Strengthen internal linking',                     description: 'Map silo structure, ensure every new page has 3-5 contextual internal links',                  department: 'content',         priority: 'normal',   estimatedMinutes: 15 },
  { title: 'Pull and analyze GSC data',                       description: 'Search performance, queries, pages, devices, countries; identify quick-win queries',           department: 'analytics',       priority: 'high',     estimatedMinutes: 10 },
  { title: 'Check local-map pack performance',                description: 'GBP rankings for primary keywords, NAP consistency, photo coverage, citation count',          department: 'local-seo',       priority: 'high',     estimatedMinutes: 10 },
  { title: 'Configure weekly monitoring & alerting',          description: 'Set up GSC daily delta, ranking position changes, traffic drop alerts in dashboard',          department: 'analytics',       priority: 'normal',   estimatedMinutes: 10 },
  { title: 'QA review of all SEO deliverables',               description: 'Verify evidence completeness, schema validity, content uniqueness, no broken pages',          department: 'seo',             priority: 'critical', estimatedMinutes: 10 },
  { title: 'Generate executive weekly report',                description: 'Compile metrics before/after, deltas, recommendations, next-week plan',                       department: 'reporting',       priority: 'critical', estimatedMinutes: 10 },
];

const REVENUE_GROWTH_TASKS: TaskTemplate[] = [
  { title: 'Pull revenue baseline from accounting',            description: 'MTD revenue, AOV, top SKUs, repeat-customer share',                                            department: 'finance',         priority: 'critical', estimatedMinutes: 10 },
  { title: 'Analyze order funnel drop-offs',                    description: 'GA4 checkout funnel, cart-abandonment, payment failures',                                       department: 'analytics',       priority: 'high',     estimatedMinutes: 15 },
  { title: 'Audit pricing and menu-mix',                        description: 'Contribution margin per item, price elasticity, upsell attach rate',                            department: 'finance',         priority: 'high',     estimatedMinutes: 15 },
  { title: 'Launch promotional campaign via marketing',         description: 'Email + SMS + GBP post; track attribution to revenue',                                          department: 'marketing',       priority: 'high',     estimatedMinutes: 20 },
  { title: 'Build retargeting list for high-intent visitors',   description: 'GSC + GA4 audience; serve customized offer via ads',                                            department: 'marketing',       priority: 'normal',   estimatedMinutes: 15 },
  { title: 'Operationalize owner reporting on revenue delta',   description: 'Daily revenue vs. forecast, owner-hourly breakdown',                                            department: 'finance',         priority: 'normal',   estimatedMinutes: 10 },
  { title: 'QA & executive weekly report',                      description: 'Verify revenue numbers, sign-off, post to dashboard',                                            department: 'reporting',       priority: 'critical', estimatedMinutes: 10 },
];

const BRAND_EXPANSION_TASKS: TaskTemplate[] = [
  { title: 'Market & competitor research for new location',     description: 'Foot-traffic, demographics, competitor footprint, demand signals',                              department: 'marketing',       priority: 'high',     estimatedMinutes: 30 },
  { title: 'Operational readiness checklist',                   description: 'Permits, staff, vendors, equipment, training, soft-open plan',                                  department: 'operations',      priority: 'high',     estimatedMinutes: 30 },
  { title: 'Pre-launch SEO + GBP setup',                       description: 'Location pages, schema, GBP profile, citations, photos',                                       department: 'seo',             priority: 'high',     estimatedMinutes: 30 },
  { title: 'Launch content + PR plan',                         description: 'Press release, social, blog, email announcement',                                               department: 'content',         priority: 'high',     estimatedMinutes: 30 },
  { title: 'Local SEO + reviews seeding',                      description: 'Review request flow, response rate monitoring',                                                 department: 'review-management', priority: 'normal', estimatedMinutes: 15 },
  { title: 'QA & launch report',                                description: 'Verify pre-launch checklist, traffic ramp, review count, dashboard sign-off',                    department: 'reporting',       priority: 'critical', estimatedMinutes: 10 },
];

const DEFAULT_TASKS: TaskTemplate[] = [
  { title: 'Investigate objective context',                     description: 'Gather data and constraints related to the objective',                                          department: 'operations',      priority: 'high',     estimatedMinutes: 15 },
  { title: 'Design action plan',                                description: 'Break the objective into department-owned deliverables',                                        department: 'operations',      priority: 'high',     estimatedMinutes: 15 },
  { title: 'Execute plan',                                      description: 'Coordinate departments and run the work',                                                       department: 'operations',      priority: 'high',     estimatedMinutes: 30 },
  { title: 'QA validation',                                     description: 'Verify each deliverable against success criteria',                                              department: 'operations',      priority: 'critical', estimatedMinutes: 10 },
  { title: 'Generate executive report',                         description: 'Compile before/after, recommendations, next steps',                                             department: 'reporting',       priority: 'critical', estimatedMinutes: 10 },
];

const TEMPLATE_MAP: Record<string, TaskTemplate[]> = {
  'traffic-growth':         TRAFFIC_GROWTH_TASKS,
  'revenue-growth':         REVENUE_GROWTH_TASKS,
  'brand-expansion':        BRAND_EXPANSION_TASKS,
  'operational-optimization': DEFAULT_TASKS,
  'risk-mitigation':        DEFAULT_TASKS,
  'compliance':             DEFAULT_TASKS,
  'customer-experience':    DEFAULT_TASKS,
  'technology-upgrade':     DEFAULT_TASKS,
};

// ── Main function ────────────────────────────────────────────────────────────

export function decomposeObjective(
  objectiveId: string,
  intent: IntentAnalysis,
  goal: Goal,
  departments: Department[],
): ObjectiveTask[] {
  const templates = TEMPLATE_MAP[intent.category] || DEFAULT_TASKS;

  return templates.map((t, i) => {
    const id = `${objectiveId}-task-${String(i + 1).padStart(3, '0')}`;
    return {
      id,
      objectiveId,
      title: t.title,
      description: t.description,
      department: t.department,
      priority: t.priority,
      status: 'pending',
      estimatedMinutes: t.estimatedMinutes,
      dependencies: i === 0 ? [] : [`${objectiveId}-task-${String(i).padStart(3, '0')}`],
      subtasks: [],
      evidence: [],
      qaResult: null,
      result: null,
      startedAt: null,
      completedAt: null,
    };
  });
}
