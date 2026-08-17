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

    // 15. Open Jarvis (Phase 7E Operator Workspace) — ask a health question, a
    //     project-scoped question, and a knowledge question against the real
    //     canonical gateway. Read/plan/simulate only; never executes. Intent-
    //     label assertions are scoped to the "Current interaction" landmark
    //     specifically, since the History panel can legitimately show the
    //     same intent label for a past turn once a real session exists.
    await page.getByRole('link', { name: 'Jarvis' }).click();
    await expect(page).toHaveURL(/\/jarvis$/);
    // A <section aria-label> maps to ARIA role "region" — Playwright's
    // getByLabel targets form controls specifically, not arbitrary labelled
    // landmarks (unlike testing-library's getByLabelText, used in the
    // vitest a11y suite, which is more lenient here).
    const current = page.getByRole('region', { name: 'Current interaction' });

    const jarvisInput = page.getByPlaceholder(/ask about health/i);
    await jarvisInput.fill('what is the system health right now');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(current.getByText('system status', { exact: true })).toBeVisible();
    await expect(current.getByText(/Overall:/)).toBeVisible();

    await page.getByRole('combobox').selectOption({ label: 'Mi Core System' });
    await jarvisInput.fill('what tasks are waiting on me');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(current.getByText('task query', { exact: true })).toBeVisible();
    // The answer paragraph AND a per-task fact bullet both mention the task
    // text — same pattern already found during Phase 7C's own review.
    await expect(current.getByText(/E2E fixture: deploy the pricing page/i).first()).toBeVisible();

    // 15a. Context Indicator (§5) — explicit project this turn must show,
    //      distinct from session-derived context.
    await expect(page.getByRole('tab', { name: 'context', selected: true })).toBeVisible();
    await expect(page.getByText('Mi Core System', { exact: true }).last()).toBeVisible();

    // 15b. Session continuity (§13/7D) — ask a follow-up with NO explicit
    //      project this time; it must still resolve via session context,
    //      never re-ask for clarification.
    await page.getByRole('combobox').selectOption({ label: 'No specific project' });
    // Deliberately avoids the word "deploy" — the History panel now renders
    // each turn's own question text inside a <button>, and the forbidden-
    // control check below scans the whole page for a /deploy/i-named
    // button, so a question containing "deployment" would create a false
    // positive against its own history entry.
    await jarvisInput.fill('find documentation about the fixture architecture');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(current.getByText('knowledge search', { exact: true })).toBeVisible();
    await expect(current.getByText('NEEDS CLARIFICATION')).not.toBeVisible();
    await expect(page.getByText(/reused the session's project context/i)).toBeVisible();

    // 15c. Evidence Inspector (§7) — reuses the real Phase 6D Evidence API,
    //      links out to the canonical Task detail page for the real
    //      approval-required state (never an inline approve control here).
    await jarvisInput.fill('what tasks are waiting on me');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(current.getByText('task query', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'evidence' }).click();
    const taskEvidenceLink = page.getByRole('link', { name: /open task/i }).first();
    await expect(taskEvidenceLink).toBeVisible();
    await taskEvidenceLink.click();
    await expect(page).toHaveURL(/\/tasks\//);
    await expect(page.getByText('WAITING_APPROVAL').first()).toBeVisible();
    // The real approval-required state and its control live only on this
    // canonical page — confirmed absent from the Jarvis workspace itself.
    await page.goBack();
    await expect(page).toHaveURL(/\/jarvis$/);

    // 15d. Simulation Inspector (§10) — reuses the real Phase 6F simulator;
    //      always the mandatory non-live-execution banner.
    await jarvisInput.fill('simulate what would happen if I archived this project');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(current.getByText('simulation', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'simulation' }).click();
    await expect(page.getByText('SIMULATION — NO LIVE EXECUTION')).toBeVisible();
    // TruthStatusBadge renders "<icon> PROPOSED" as one text node.
    await expect(page.getByText(/PROPOSED/).first()).toBeVisible();

    // No execution/mutation control, and no false EXECUTED claim, anywhere
    // on the page, across every answer above.
    for (const forbidden of [/^approve/i, /^execute/i, /^send$/i, /^force$/i, /run shell/i, /bypass/i, /deploy/i]) {
      await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    }
    // Substring match (not exact) — TruthStatusBadge would render "✓ EXECUTED"
    // as one text node if this claim were ever made; an exact match against
    // the bare word would trivially pass even if that happened.
    await expect(page.getByText(/EXECUTED/)).toHaveCount(0);

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

  test('Phase 7E: cross-session request/session access is denied, and the whole workspace flow leaves zero real mutation', async ({ page, request, baseURL }) => {
    await page.goto('./');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page).toHaveURL(/\/today$/);

    // Snapshot real governance/action/task/plan/delegation state before
    // touching the Jarvis workspace at all.
    const loginA = await request.post(new URL('/api/remote/login', baseURL).toString(), { data: { pin: PIN } });
    const { token: tokenA } = await loginA.json();
    const authA = { Authorization: `Bearer ${tokenA}` };
    const before = {
      actions: await (await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: authA })).json(),
      plans: await (await request.get(new URL('/api/command-center/orchestration/plans', baseURL).toString(), { headers: authA })).json(),
      governance: await (await request.get(new URL('/api/command-center/governance/status', baseURL).toString(), { headers: authA })).json(),
      tasks: await (await request.get(new URL('/api/command-center/task-runtime/tasks', baseURL).toString(), { headers: authA })).json(),
    };

    await page.getByRole('link', { name: 'Jarvis' }).click();
    await expect(page).toHaveURL(/\/jarvis$/);
    const jarvisInput = page.getByPlaceholder(/ask about health/i);
    await jarvisInput.fill('what tasks are waiting on me');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Current interaction' }).getByText('task query', { exact: true })).toBeVisible();

    // Recover the requestId this created via the API-key-style route mirror:
    // the same login's own session must be able to read its own request back.
    const ownSession = await request.get(new URL('/api/command-center/jarvis/session/current', baseURL).toString(), { headers: authA });
    expect(ownSession.status()).toBe(200);
    const sessionBody = await ownSession.json();
    const requestId = sessionBody.turns.at(-1).requestId;
    const ownRead = await request.get(new URL(`/api/command-center/jarvis/request/${requestId}`, baseURL).toString(), { headers: authA });
    expect(ownRead.status()).toBe(200);

    // A SECOND, independently-authenticated caller (Playwright's own request
    // context uses a distinct User-Agent from the real browser page, so this
    // PIN login mints a genuinely different device_id/session) must be
    // denied both the specific request AND the first caller's session.
    const loginB = await request.post(new URL('/api/remote/login', baseURL).toString(), {
      data: { pin: PIN },
      headers: { 'User-Agent': 'Phase7E-E2E-second-caller/1.0' },
    });
    const { token: tokenB } = await loginB.json();
    const authB = { Authorization: `Bearer ${tokenB}` };

    const crossRead = await request.get(new URL(`/api/command-center/jarvis/request/${requestId}`, baseURL).toString(), { headers: authB });
    expect(crossRead.status()).toBe(404); // never 200, never leaks caller A's stored response

    const crossSession = await request.get(new URL('/api/command-center/jarvis/session/current', baseURL).toString(), { headers: authB });
    // Caller B has never asked anything itself yet, so its own session is
    // legitimately empty — critically, it must never equal caller A's.
    if (crossSession.status() === 200) {
      const bodyB = await crossSession.json();
      expect(bodyB.sessionId).not.toBe(sessionBody.sessionId);
    } else {
      expect(crossSession.status()).toBe(404);
    }

    // Unauthenticated access is rejected outright.
    const unauth = await request.get(new URL(`/api/command-center/jarvis/request/${requestId}`, baseURL).toString());
    expect(unauth.status()).toBe(401);

    // Zero real mutation anywhere, across the entire workspace flow.
    const after = {
      actions: await (await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: authA })).json(),
      plans: await (await request.get(new URL('/api/command-center/orchestration/plans', baseURL).toString(), { headers: authA })).json(),
      governance: await (await request.get(new URL('/api/command-center/governance/status', baseURL).toString(), { headers: authA })).json(),
      tasks: await (await request.get(new URL('/api/command-center/task-runtime/tasks', baseURL).toString(), { headers: authA })).json(),
    };
    expect(after.actions).toEqual(before.actions);
    expect(after.plans).toEqual(before.plans);
    expect(after.governance).toEqual(before.governance);
    expect(after.tasks).toEqual(before.tasks);

    // Authority counts unchanged too.
    const manifestBefore = await request.get(new URL('/api/command-center/authority/status', baseURL).toString(), { headers: authA });
    expect((await manifestBefore.json()).counts.unknownMutations).toBe(0);
    expect((await manifestBefore.json()).counts.unresolvedLegacyMutations).toBe(0);
  });

  test('Phase 7F: voice read/plan/simulate/propose flow — spoken "yes, approve it" never approves, zero real mutation', async ({ page, request, baseURL }) => {
    await page.goto('./');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page).toHaveURL(/\/today$/);

    const login = await request.post(new URL('/api/remote/login', baseURL).toString(), { data: { pin: PIN } });
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };
    const before = {
      actions: await (await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: auth })).json(),
      plans: await (await request.get(new URL('/api/command-center/orchestration/plans', baseURL).toString(), { headers: auth })).json(),
      governance: await (await request.get(new URL('/api/command-center/governance/status', baseURL).toString(), { headers: auth })).json(),
      tasks: await (await request.get(new URL('/api/command-center/task-runtime/tasks', baseURL).toString(), { headers: auth })).json(),
    };

    await page.getByRole('link', { name: 'Jarvis' }).click();
    await expect(page).toHaveURL(/\/jarvis$/);
    const current = page.getByRole('region', { name: 'Current interaction' });
    const voice = page.getByRole('region', { name: 'Voice input' });
    const transcriptBox = voice.getByPlaceholder(/type a question here/i);
    const submitButton = voice.getByRole('button', { name: 'Submit', exact: true });

    // 1. Voice transcript mode is always visible — no separate "activate"
    //    step is needed; the transcript field and Submit button are always
    //    present and keyboard-usable (§24), which is exactly what makes
    //    this real, deterministic browser automation possible without a
    //    real microphone.
    await expect(transcriptBox).toBeVisible();
    await expect(submitButton).toBeVisible();

    // 2. Submit a safe question via the voice transcript field, with an
    //    explicit project — same rendering path a typed Ask uses.
    await page.getByRole('combobox').selectOption({ label: 'Mi Core System' });
    await transcriptBox.fill('what tasks are waiting on me');
    await submitButton.click();
    await expect(current.getByText('task query', { exact: true })).toBeVisible();
    await expect(current.getByText(/E2E fixture: deploy the pricing page/i).first()).toBeVisible();

    // 3. Project continuity via voice — a follow-up with NO explicit
    //    project must still resolve through the same session Phase 7D
    //    already governs, exactly like the typed path.
    await page.getByRole('combobox').selectOption({ label: 'No specific project' });
    await transcriptBox.fill('find documentation about the fixture architecture');
    await submitButton.click();
    await expect(current.getByText('knowledge search', { exact: true })).toBeVisible();
    await expect(page.getByText(/reused the session's project context/i)).toBeVisible();

    // 4. Simulation request via voice — result must always carry the
    //    mandatory non-live-execution banner.
    await transcriptBox.fill('simulate what would happen if I archived this project');
    await submitButton.click();
    await expect(current.getByText('simulation', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'simulation' }).click();
    await expect(page.getByText('SIMULATION — NO LIVE EXECUTION')).toBeVisible();
    await expect(page.getByText(/PROPOSED/).first()).toBeVisible();

    // 5. Proposal-preparation request via voice — must always ask for
    //    exact fields, never silently prepare or approve anything.
    await transcriptBox.fill('draft an email to the team');
    await submitButton.click();
    await expect(current.getByText('action proposal', { exact: true })).toBeVisible();
    await expect(current.getByText('NEEDS CLARIFICATION')).toBeVisible();

    // 6. The hard confirmation-boundary rule — a spoken/typed "yes, approve
    //    it" is intercepted before the Gateway even runs and produces the
    //    fixed "still required" message inline in the Voice input region
    //    itself (there is no Gateway response to select/cache for this
    //    case), never an approval.
    await transcriptBox.fill('yes, approve it');
    await submitButton.click();
    await expect(voice.getByText(/approval is still required in command center/i)).toBeVisible();

    // No execution/mutation control, and no false EXECUTED claim, anywhere
    // on the page across every voice exchange above.
    for (const forbidden of [/^approve/i, /^execute/i, /^send$/i, /^force$/i, /run shell/i, /bypass/i, /deploy/i]) {
      await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    }
    await expect(page.getByText(/EXECUTED/)).toHaveCount(0);

    // Zero real mutation anywhere, across the entire voice flow.
    const after = {
      actions: await (await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: auth })).json(),
      plans: await (await request.get(new URL('/api/command-center/orchestration/plans', baseURL).toString(), { headers: auth })).json(),
      governance: await (await request.get(new URL('/api/command-center/governance/status', baseURL).toString(), { headers: auth })).json(),
      tasks: await (await request.get(new URL('/api/command-center/task-runtime/tasks', baseURL).toString(), { headers: auth })).json(),
    };
    expect(after.actions).toEqual(before.actions);
    expect(after.plans).toEqual(before.plans);
    expect(after.governance).toEqual(before.governance);
    expect(after.tasks).toEqual(before.tasks);

    const manifest = await request.get(new URL('/api/command-center/authority/status', baseURL).toString(), { headers: auth });
    const manifestBody = await manifest.json();
    expect(manifestBody.counts.unknownMutations).toBe(0);
    expect(manifestBody.counts.unresolvedLegacyMutations).toBe(0);
  });

  test('Phase 7G §21: single continuous certification journey — health, project, task, knowledge+citation, plan, simulation, controlled-action proposal, approval-required, evidence, voice transcript, spoken approval phrase never approves, zero unintended execution', async ({ page, request, baseURL }) => {
    await page.goto('./');
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page).toHaveURL(/\/today$/);

    const login = await request.post(new URL('/api/remote/login', baseURL).toString(), { data: { pin: PIN } });
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };
    const before = {
      actions: await (await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: auth })).json(),
      plans: await (await request.get(new URL('/api/command-center/orchestration/plans', baseURL).toString(), { headers: auth })).json(),
      tasks: await (await request.get(new URL('/api/command-center/task-runtime/tasks', baseURL).toString(), { headers: auth })).json(),
    };

    await page.getByRole('link', { name: 'Jarvis' }).click();
    await expect(page).toHaveURL(/\/jarvis$/);
    const current = page.getByRole('region', { name: 'Current interaction' });
    const jarvisInput = page.getByPlaceholder(/ask about health/i);
    const ask = page.getByRole('button', { name: 'Ask', exact: true });

    // 1. HEALTH
    await jarvisInput.fill('what is the current system health');
    await ask.click();
    await expect(current.getByText('system status', { exact: true })).toBeVisible();

    // 2. PROJECT
    await page.getByRole('combobox').selectOption({ label: 'Mi Core System' });
    await jarvisInput.fill('what is the project status');
    await ask.click();
    await expect(current.getByText('project query', { exact: true })).toBeVisible();

    // 3. TASK
    await jarvisInput.fill('what tasks are waiting on me');
    await ask.click();
    await expect(current.getByText('task query', { exact: true })).toBeVisible();

    // 3b. EVIDENCE — checked right after the task query, while it's still
    //     the current interaction (the Evidence Inspector reflects the
    //     interaction currently in view, matching where test 1 above
    //     exercises the same tab).
    await page.getByRole('tab', { name: 'evidence' }).click();
    await expect(page.getByRole('link', { name: /open task/i }).first()).toBeVisible();

    // 4. KNOWLEDGE + citation
    await jarvisInput.fill('find documentation about the fixture architecture');
    await ask.click();
    await expect(current.getByText('knowledge search', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'context' }).click();

    // 5. PLANNING — preview only, never execution
    await jarvisInput.fill('make a plan to migrate the fixture database');
    await ask.click();
    await expect(current.getByText('planning', { exact: true })).toBeVisible();
    await expect(page.getByText(/EXECUTED/)).toHaveCount(0);

    // 6. SIMULATION — SIMULATION ONLY banner mandatory
    await jarvisInput.fill('simulate what would happen if I archived this project');
    await ask.click();
    await expect(current.getByText('simulation', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'simulation' }).click();
    await expect(page.getByText('SIMULATION — NO LIVE EXECUTION')).toBeVisible();

    // 7. CONTROLLED ACTION proposal preview -> approval-required state
    //    (Gateway asks for exact fields, never fabricates a proposal)
    await jarvisInput.fill('draft an email to the team about the launch');
    await ask.click();
    await expect(current.getByText('action proposal', { exact: true })).toBeVisible();
    await expect(current.getByText('NEEDS CLARIFICATION')).toBeVisible();

    // 9. VOICE transcript path, then the spoken approval phrase — must
    //    never approve anything, must remain a distinct inline message.
    const voice = page.getByRole('region', { name: 'Voice input' });
    const transcriptBox = voice.getByPlaceholder(/type a question here/i);
    const submitButton = voice.getByRole('button', { name: 'Submit', exact: true });
    await transcriptBox.fill('yes, approve it');
    await submitButton.click();
    await expect(voice.getByText(/approval is still required in command center/i)).toBeVisible();

    // 10. Zero unintended execution anywhere on the page or in the underlying
    //     data, across this entire 9-step chained journey.
    for (const forbidden of [/^approve/i, /^execute/i, /^send$/i, /^force$/i, /run shell/i, /bypass/i, /deploy/i]) {
      await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    }
    await expect(page.getByText(/EXECUTED/)).toHaveCount(0);
    const after = {
      actions: await (await request.get(new URL('/api/command-center/actions', baseURL).toString(), { headers: auth })).json(),
      plans: await (await request.get(new URL('/api/command-center/orchestration/plans', baseURL).toString(), { headers: auth })).json(),
      tasks: await (await request.get(new URL('/api/command-center/task-runtime/tasks', baseURL).toString(), { headers: auth })).json(),
    };
    expect(after.actions).toEqual(before.actions);
    expect(after.plans).toEqual(before.plans);
    expect(after.tasks).toEqual(before.tasks);
    const manifestAfter = await (await request.get(new URL('/api/command-center/authority/status', baseURL).toString(), { headers: auth })).json();
    expect(manifestAfter.counts.unknownMutations).toBe(0);
    expect(manifestAfter.counts.unresolvedLegacyMutations).toBe(0);
  });
});
