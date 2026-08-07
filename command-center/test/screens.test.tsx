import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';

// jsdom reports 0 for element dimensions, so @tanstack/react-virtual would compute
// zero visible rows; render every item instead so the virtualized TasksPage list is
// actually testable, matching what a real browser (verified manually — see
// PHASE5E_ACCEPTANCE.md) renders.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => opts.count * opts.estimateSize(),
    getVirtualItems: () => Array.from({ length: opts.count }, (_, index) => ({
      index, start: index * opts.estimateSize(), size: opts.estimateSize(), key: index,
    })),
  }),
}));

import { TodayPage } from '@/routes/TodayPage';
import { PlanPage } from '@/routes/PlanPage';
import { ApprovalsPage } from '@/routes/ApprovalsPage';
import { GoalsPage } from '@/routes/GoalsPage';
import { ProjectsPage } from '@/routes/ProjectsPage';
import { TasksPage } from '@/routes/TasksPage';
import { KnowledgePage } from '@/routes/KnowledgePage';
import { MemoryPage } from '@/routes/MemoryPage';
import { CalendarPage } from '@/routes/CalendarPage';
import { InboxPage } from '@/routes/InboxPage';
import { CodingPage } from '@/routes/CodingPage';
import { HealthPage } from '@/routes/HealthPage';
import { ReviewsPage } from '@/routes/ReviewsPage';

const FIXTURES: Record<string, unknown> = {
  '/operating/today': {
    id: 'opbrief-1', date: '2026-08-07', timezone: 'UTC', version: 1,
    facts: ['1 active goal(s).'], meetings: [], deadlines: [], activeGoals: [],
    priorityTasks: [], pendingApprovals: [], followUps: [], projectHealth: [], serviceHealth: [],
    relevantMemory: [], relevantKnowledge: [], knowledgeCitations: [], focusWindows: [],
    blockers: [], risks: [], suggestions: [], unknowns: [], confirmationRequests: [],
    conflicts: [], evidenceReferences: [], generatedAt: '2026-08-07T00:00:00Z', refreshedAt: null,
  },
  '/operating/today/plan': {
    id: 'plan-1', date: '2026-08-07', timezone: 'UTC', briefId: 'opbrief-1',
    objective: 'Test objective', selectedGoals: [], selectedTasks: [], proposedOrder: [],
    dependencies: [], focusBlocks: [], meetings: [], requiredApprovals: [], risks: [],
    successCriteria: [], evidenceReferences: [], status: 'DRAFT', version: 1,
    createdAt: '2026-08-07T00:00:00Z', updatedAt: '2026-08-07T00:00:00Z',
  },
  '/operating/approvals': { approvals: [{ id: 'a1', sourceType: 'TASK_RUNTIME', sourceId: 't1', title: 'Do the thing', reason: 'awaiting approval', riskLevel: 'low', projectId: 'mi-core', goalId: null, requestedAt: '2026-08-07T00:00:00Z', expiresAt: null, evidenceReferences: ['task:t1'] }] },
  '/goals': { goals: [{ id: 'goal-1', title: 'Ship it', description: '', category: 'general', priority: 1, status: 'ACTIVE', targetDate: null, completedAt: null, projectIds: ['mi-core'], parentGoalId: null, successCriteria: [], constraints: [], createdAt: '', updatedAt: '' }] },
  '/projects': { total: 1, projects: [{ id: 'mi-core', displayName: 'Mi Core', mapStatus: 'FRESH' }] },
  '/task-runtime/tasks': [{ id: 'task-1', userRequest: 'Do a thing', projectId: 'mi-core', status: 'READY', approvalState: 'not-required', createdAt: '', updatedAt: '', completedAt: null, resultSummary: null, parentTaskId: null }],
  '/knowledge?includeInactive=true': { knowledge: [{ id: 'k1', kind: 'preference', title: 'Prefers mornings', summary: 'summary', status: 'NEEDS_CONFIRMATION', createdAt: '', updatedAt: '' }] },
  '/intelligence/status': { status: 'NOT_CONFIGURED', grantedScopes: [] },
  '/intelligence/follow-ups?limit=30': { followUps: [] },
  '/coding/engines': { engines: [{ id: 'e1', label: 'Local LLM', purpose: 'test', status: 'ACTIVE', repositoryScale: true }], activeEngineId: 'e1' },
  '/coding/model-roles': { modelRoles: { coding_primary: 'qwen3:8b' } },
  '/coding/model-health': { endpoint: 'http://x', installedModels: ['qwen3:8b'], residentModels: [], modelRoles: {}, healthy: true },
  '/operating/service-health': { serviceHealth: [{ service: 'Mi Core', status: 'HEALTHY', lastCheck: '', reason: null, evidenceReference: 'service:mi-core' }] },
  '/personal/integrity': { integrityCheck: 'ok', foreignKeyViolations: [], schemaVersion: 6 },
};

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn((path: string) => {
      if (path in FIXTURES) return Promise.resolve(FIXTURES[path]);
      if (path.startsWith('/operating/today/review')) return Promise.reject(Object.assign(new Error('not found'), { status: 404 }));
      if (path.startsWith('/operating/week')) return Promise.reject(Object.assign(new Error('not found'), { status: 404 }));
      return Promise.resolve({});
    }),
    post: vi.fn(() => Promise.resolve({})),
    patch: vi.fn(() => Promise.resolve({})),
    del: vi.fn(() => Promise.resolve({})),
  },
  ApiError: class ApiError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } },
  UnauthorizedError: class UnauthorizedError extends Error {},
  setUnauthorizedHandler: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe('Command Center screens', () => {
  it('Today renders the morning brief', async () => {
    renderWithProviders(<TodayPage />);
    await waitFor(() => expect(screen.getByText(/1 active goal/i)).toBeInTheDocument());
  });

  it('Plan shows the "does not execute tasks" banner', async () => {
    renderWithProviders(<PlanPage />);
    await waitFor(() => expect(screen.getByText(/does not execute tasks/i)).toBeInTheDocument());
  });

  it('Approvals marks a Task Runtime item as read-only, no approve button', async () => {
    renderWithProviders(<ApprovalsPage />);
    await waitFor(() => expect(screen.getByText('Do the thing')).toBeInTheDocument());
    expect(screen.getByText(/Task Runtime has no safe, idempotent "approve" API/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
  });

  it('Goals renders a goal with its status', async () => {
    renderWithProviders(<GoalsPage />);
    await waitFor(() => expect(screen.getByText('Ship it')).toBeInTheDocument());
  });

  it('Projects renders a project with map status', async () => {
    renderWithProviders(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText('Mi Core')).toBeInTheDocument());
  });

  it('Tasks renders a task row, no execute button anywhere on the list', async () => {
    renderWithProviders(<TasksPage />);
    await waitFor(() => expect(screen.getByText('Do a thing')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^(run|execute|start)$/i })).not.toBeInTheDocument();
  });

  it('Knowledge search screen renders without a query submitted', async () => {
    renderWithProviders(<KnowledgePage />);
    expect(screen.getByPlaceholderText(/search knowledge/i)).toBeInTheDocument();
  });

  it('Memory shows a NEEDS_CONFIRMATION record with confirm/dismiss controls', async () => {
    renderWithProviders(<MemoryPage />);
    await waitFor(() => expect(screen.getByText('Prefers mornings')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('Calendar shows the read-only banner and NOT_CONFIGURED state honestly', async () => {
    renderWithProviders(<CalendarPage />);
    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());
  });

  it('Inbox shows the read-only banner and NOT_CONFIGURED state honestly', async () => {
    renderWithProviders(<InboxPage />);
    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());
  });

  it('Coding renders engines and never shows a run/deploy control', async () => {
    renderWithProviders(<CodingPage />);
    await waitFor(() => expect(screen.getByText('Local LLM')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /run|push|merge|deploy/i })).not.toBeInTheDocument();
  });

  it('Health renders service, integrity and connector status', async () => {
    renderWithProviders(<HealthPage />);
    await waitFor(() => expect(screen.getByText('Mi Core')).toBeInTheDocument());
    expect(screen.getByText(/schema version: v6/i)).toBeInTheDocument();
  });

  it('Reviews handles a missing daily review honestly, offers to generate it', async () => {
    renderWithProviders(<ReviewsPage />);
    await waitFor(() => expect(screen.getByText(/no end-of-day review/i)).toBeInTheDocument());
  });
});
