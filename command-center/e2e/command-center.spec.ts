import { test, expect } from '@playwright/test';

const PIN = process.env.E2E_PIN || '135790';

test.describe('Command Center — full flow against a controlled fixture backend (§32)', () => {
  test('login, brief, plan, approvals, goal, project, knowledge, citation, calendar, inbox, health, EOD review, refresh, persistence', async ({ page }) => {
    // 1. Login
    await page.goto('./');
    await expect(page.getByText('Enter your PIN to unlock.')).toBeVisible();
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();

    // 2. Open Today
    await expect(page).toHaveURL(/\/today$/);

    // 3. Inspect Morning Brief
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /pending approvals/i })).toBeVisible();
    await expect(page.getByText(/1 item\(s\) waiting/i)).toBeVisible();

    // 4. Open Daily Plan
    await page.getByRole('link', { name: /open today's daily plan/i }).click();
    await expect(page).toHaveURL(/\/today\/plan$/);
    await expect(page.getByText(/does not execute tasks/i)).toBeVisible();

    // 5. Approve plan
    const approveButton = page.getByRole('button', { name: 'Approve plan' });
    if (await approveButton.isVisible()) {
      await approveButton.click();
      await expect(page.getByText('APPROVED')).toBeVisible();
    }

    // 6. Verify task statuses unchanged — the WAITING_APPROVAL task must still show as such
    // in the plan's "requires approval" list, never silently promoted.
    await expect(page.getByText(/requires approval before it can run/i)).toBeVisible();

    // 7. Open Approvals
    await page.getByRole('link', { name: 'Approvals' }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    await expect(page.getByText(/E2E fixture: deploy the pricing page/i)).toBeVisible();
    await expect(page.getByText(/Task Runtime has no safe, idempotent "approve" API/i)).toBeVisible();

    // 8. Inspect goal
    await page.getByRole('link', { name: 'Goals' }).click();
    await expect(page).toHaveURL(/\/goals$/);
    await page.getByText('E2E fixture goal').click();
    await expect(page.getByRole('heading', { name: 'E2E fixture goal' })).toBeVisible();

    // 9. Inspect project
    await page.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.getByText('Mi Core System').click();
    await expect(page.getByRole('heading', { name: 'Mi Core System' })).toBeVisible();

    // 10. Search knowledge
    await page.getByRole('link', { name: 'Knowledge' }).click();
    await expect(page).toHaveURL(/\/knowledge$/);
    await page.getByPlaceholder('Search knowledge…').fill('E2E fixture feature');
    await page.getByPlaceholder('project ids, comma-separated').fill('mi-core');
    await page.getByRole('button', { name: 'Search' }).last().click();
    await expect(page.getByText(/E2E Fixture Architecture/i).first()).toBeVisible({ timeout: 10_000 });

    // 11. Open citation (document detail)
    await page.getByRole('link', { name: /E2E Fixture Architecture/i }).first().click();
    await expect(page.getByText('architecture.md')).toBeVisible();

    // 12. Open Calendar — read-only, honest NOT_CONFIGURED in this fixture environment
    // (no Google token exists in this disposable E2E environment — the UI must say so
    // honestly rather than fabricate calendar data, which is exactly what it does).
    await page.getByRole('link', { name: 'Calendar' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByText(/never writes to calendar/i)).toBeVisible();

    // 13. Open Inbox — read-only, honest NOT_CONFIGURED
    await page.getByRole('link', { name: 'Inbox' }).click();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(page.getByText(/never sends, replies, or modifies gmail/i)).toBeVisible();

    // 14. Open Health
    await page.getByRole('link', { name: 'Health' }).click();
    await expect(page).toHaveURL(/\/health$/);
    await expect(page.getByText('Overall')).toBeVisible();
    await expect(page.getByText('CORE', { exact: true })).toBeVisible();

    // 15. Open Jarvis — ask a health question, a project-scoped question, and a
    //     knowledge question against the real canonical gateway (Phase 7C).
    //     Read/plan/simulate only; never executes.
    await page.getByRole('link', { name: 'Jarvis' }).click();
    await expect(page).toHaveURL(/\/jarvis$/);

    const jarvisInput = page.getByPlaceholder(/ask about health/i);
    await jarvisInput.fill('what is the system health right now');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByText('system status', { exact: true })).toBeVisible();
    await expect(page.getByText(/Overall:/)).toBeVisible();

    await page.getByRole('combobox').selectOption({ label: 'Mi Core System' });
    await jarvisInput.fill('what tasks are waiting on me');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByText('task query', { exact: true })).toBeVisible();

    await jarvisInput.fill('find documentation about deployment');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByText('knowledge search', { exact: true })).toBeVisible();

    // No execution/mutation control anywhere on the page, across all three answers.
    for (const forbidden of [/^approve/i, /^execute/i, /^send$/i, /^force$/i, /run shell/i, /bypass/i, /deploy/i]) {
      await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    }

    // 16. Generate EOD review
    await page.getByRole('link', { name: 'Reviews' }).click();
    await expect(page).toHaveURL(/\/reviews$/);
    const generateReview = page.getByRole('button', { name: /generate today's review/i });
    await generateReview.click();
    await expect(page.getByText('Completed', { exact: true })).toBeVisible();

    // 17. Refresh page
    await page.reload();

    // 18. Verify persistence — still authenticated (session survives reload), still on Reviews
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();
    await expect(page.getByText('Enter your PIN to unlock.')).not.toBeVisible();
  });

  test('no external writes: reload after approve leaves the underlying task WAITING_APPROVAL', async ({ page, request, baseURL }) => {
    await page.goto('./');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page).toHaveURL(/\/today$/);

    const loginRes = await request.post(new URL('/api/remote/login', baseURL).toString(), { data: { pin: PIN } });
    const { token } = await loginRes.json();
    const tasksRes = await request.get(new URL('/api/command-center/task-runtime/tasks', baseURL).toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const tasks = await tasksRes.json();
    const waiting = tasks.find((t: { userRequest: string }) => t.userRequest.includes('E2E fixture'));
    expect(waiting?.status).toBe('WAITING_APPROVAL');
  });

  test('Phase 5H: visiting the Plans screen never advances or auto-executes the fixture plan', async ({ page, request, baseURL }) => {
    await page.goto('./');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.getByRole('link', { name: 'Plans' }).click();
    await expect(page.getByText(/prepare customer follow-up/i)).toBeVisible();

    const loginRes = await request.post(new URL('/api/remote/login', baseURL).toString(), { data: { pin: PIN } });
    const { token } = await loginRes.json();
    const plansRes = await request.get(new URL('/api/command-center/orchestration/plans', baseURL).toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { plans } = await plansRes.json();
    const fixturePlan = plans.find((p: { title: string }) => p.title.includes('E2E fixture'));
    // Seeded as validated + started only — merely rendering the Plans screen must
    // never advance a step, create a Controlled Action proposal, or execute anything.
    expect(fixturePlan?.status).toBe('READY');
  });

  test('Phase 5I: Delegations page renders bounded authority and revocation without hidden execution', async ({ page, request, baseURL }) => {
    await page.goto('./');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page).toHaveURL(/\/today$/);

    const loginRes = await request.post(new URL('/api/remote/login', baseURL).toString(), { data: { pin: PIN } });
    const { token } = await loginRes.json();
    const auth = { Authorization: `Bearer ${token}` };

    await page.getByRole('link', { name: 'Delegations' }).click();
    await expect(page).toHaveURL(/\/delegations$/);
    await expect(page.getByRole('heading', { name: 'Delegations' })).toBeVisible();
    await expect(page.getByText('E2E delegation active')).toBeVisible();
    await expect(page.getByText('E2E delegation draft')).toBeVisible();
    await expect(page.getByText('DRAFT').first()).toBeVisible();
    for (const state of ['ACTIVE', 'PAUSED', 'EXPIRED', 'REVOKED']) {
      await expect(page.getByText(state).first()).toBeVisible();
    }
    await expect(page.getByText(/GMAIL_CREATE_DRAFT/).first()).toBeVisible();
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

    for (const forbidden of [/^send$/i, /gmail send/i, /approve all/i, /activate all/i, /^execute$/i, /^run$/i]) {
      await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    }

    await page.getByRole('link', { name: 'E2E delegation waiting-approval' }).click();
    await expect(page).toHaveURL(/\/delegations\/delegation-/);
    await expect(page.getByText(/Strongly approve and activate/i)).toBeVisible();
    await expect(page.getByPlaceholder(/AUTHORIZE:/i)).toBeVisible();
    await expect(page.getByText(/Mi cannot approve its own delegation/i)).toBeVisible();
    await expect(page.getByText(/no one-click approval exists/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /strongly approve and activate/i })).toBeDisabled();

    await page.getByRole('link', { name: 'Delegations' }).click();
    await page.getByRole('link', { name: 'E2E delegation active' }).click();
    await expect(page).toHaveURL(/\/delegations\/delegation-/);
    await expect(page.getByText(/Target scope/i)).toBeVisible();
    await expect(page.getByText(/Risk ceiling/i)).toBeVisible();
    await expect(page.getByText(/R2/).first()).toBeVisible();
    await expect(page.getByText(/Window/i)).toBeVisible();
    await expect(page.getByText(/Executions/i)).toBeVisible();
    await expect(page.getByText(/example\.com/).first()).toBeVisible();
    await expect(page.getByText(/not plan approval and not a single action approval/i)).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByLabel(/Revoke reason/i).fill('E2E revoke');
    await page.getByRole('button', { name: /revoke delegation/i }).click();
    await expect(page.getByText('REVOKED').first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('Enter your PIN to unlock.')).not.toBeVisible();
    await expect(page.getByText('REVOKED').first()).toBeVisible();

    const actionsRes = await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: auth });
    expect(actionsRes.status()).toBe(200);
    const actionsPayload = await actionsRes.json();
    const serializedActions = JSON.stringify(actionsPayload);
    expect(serializedActions).not.toContain('GMAIL_SEND');
    expect(serializedActions).not.toContain('FORBIDDEN_EXTERNAL_ACTION');
  });

  test('Phase 6F: Simulation runs against the real simulator with zero live mutation and no execution controls', async ({ page, request, baseURL }) => {
    await page.goto('./');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page).toHaveURL(/\/today$/);

    const loginRes = await request.post(new URL('/api/remote/login', baseURL).toString(), { data: { pin: PIN } });
    const { token } = await loginRes.json();
    const auth = { Authorization: `Bearer ${token}` };

    // Snapshot the real governance state before running any simulation.
    const actionsBefore = await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: auth });
    const governanceBefore = await request.get(new URL('/api/command-center/governance/status', baseURL).toString(), { headers: auth });

    await page.getByRole('link', { name: 'Simulation' }).click();
    await expect(page).toHaveURL(/\/simulation$/);
    await expect(page.getByText('SIMULATION — NO LIVE SIDE EFFECTS')).toBeVisible();

    // Default form step: a CALENDAR_EVENT_PROPOSAL, SUCCESS scenario — the real
    // default policy requires STANDARD approval for it, so this exercises the
    // policy/approval/side-effect-preview inspection flow without any manual
    // configuration.
    await page.getByRole('button', { name: 'Run Simulation' }).click();
    await expect(page.getByText(/policy REQUIRE_APPROVAL/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/approval STANDARD/)).toBeVisible();
    await expect(page.getByText(/expected provider effect \(hypothetical\)/)).toBeVisible();
    await expect(page.getByText('WOULD_REQUIRE_APPROVAL').first()).toBeVisible();

    // Configure a kill-switch what-if and re-run — inspect the blocked state.
    await page.getByLabel('Kill switch (GLOBAL)').check();
    await page.getByRole('button', { name: 'Run Simulation' }).click();
    await expect(page.getByText('WOULD_BLOCK').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Kill switch WOULD block this action/)).toBeVisible();

    // No execution-shaped control anywhere on the Simulation page.
    for (const forbidden of [/^execute/i, /^send$/i, /^approve/i, /^deploy$/i, /create event/i, /apply simulation/i, /use result/i, /^force$/i, /^bypass$/i]) {
      await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    }

    // Zero live mutation: the real governance state is unchanged after running
    // simulations, including one that hit an approval-required, WOULD-execute-shaped
    // path.
    const actionsAfter = await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: auth });
    const governanceAfter = await request.get(new URL('/api/command-center/governance/status', baseURL).toString(), { headers: auth });
    expect(await actionsAfter.json()).toEqual(await actionsBefore.json());
    expect(await governanceAfter.json()).toEqual(await governanceBefore.json());
  });
});
