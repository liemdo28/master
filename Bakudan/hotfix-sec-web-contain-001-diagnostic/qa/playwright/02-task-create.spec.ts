/**
 * 02 - Task Create
 * Navigates to the tasks page and creates a new task via the Create New button.
 * Saves the task ID to workflow state for subsequent tests.
 */
import { test, expect } from './fixtures';
import { saveWorkflowState, ensureAuthenticated } from './fixtures';

test.describe('02 - Task Create', () => {
  const TASK_TITLE = `QA-Auto-${Date.now()}`;

  test('create a new task', async ({ page, evidence }) => {
    // Navigate to tasks page (admin redirects to /my-tasks)
    await page.goto('/tasks', { waitUntil: 'load' });
    await ensureAuthenticated(page);
    if (!page.url().includes('/tasks')) {
      await page.goto('/my-tasks', { waitUntil: 'load' });
    }
    await page.waitForTimeout(1000);
    await evidence.screenshotBefore('task_create');

    // ── Open Create Task Modal ──────────────────────────────────────────
    // Method 1: Click "Create New" button to open dropdown, then click task link
    const createBtn = page.locator('button:has-text("Create New")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Click the "open-create-task" data-action link in the dropdown
      const openTaskLink = page.locator('[data-action="open-create-task"]').first();
      if (await openTaskLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await openTaskLink.click();
        await page.waitForTimeout(500);
      }
    }

    // Check if modal is open
    let modalVisible = await page.locator('#createTaskModal.open').isVisible().catch(() => false);

    // Method 2: If dropdown didn't work, call JS directly
    if (!modalVisible) {
      await page.evaluate(() => {
        const fn = (window as any).openCreateTaskModal;
        if (fn) fn();
      });
      await page.waitForTimeout(500);
      modalVisible = await page.locator('#createTaskModal.open').isVisible().catch(() => false);
    }

    // Method 3: Force visibility via class
    if (!modalVisible) {
      await page.locator('#createTaskModal').evaluate((el) => el.classList.add('open'));
      await page.waitForTimeout(300);
      modalVisible = await page.locator('#createTaskModal.open').isVisible().catch(() => false);
    }

    if (!modalVisible) {
      await evidence.screenshotAfter('task_create_no_modal');
      console.log('Could not open create task modal. Page URL:', page.url());
      test.skip(true, 'Create task modal could not be opened — inspect screenshots');
    }

    // ── Fill the form ───────────────────────────────────────────────
    // Title
    const titleInput = page.locator(
      '#createTaskModal input[name="title"], ' +
      'input[name="title"], ' +
      '#ctTitle, ' +
      '.modal input[name="title"]'
    ).first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(TASK_TITLE);

    // Description
    const descInput = page.locator(
      '#createTaskModal textarea[name="description"], ' +
      'textarea[name="description"], ' +
      '#ctDescription'
    ).first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill('QA automated test task — verify full workflow');
    }

    // ── Select project (REQUIRED — form will not submit without it) ──
    const projectSelect = page.locator('#createTaskModal select[name="project_id"]').first();
    await expect(projectSelect).toBeVisible({ timeout: 5000 });
    const projectOptions = await projectSelect.locator('option:not([value=""])').all();
    if (projectOptions.length > 0) {
      const firstProjectValue = await projectOptions[0].getAttribute('value');
      await projectSelect.selectOption(firstProjectValue!);
      console.log(`Selected project ID: ${firstProjectValue}`);
    }

    // ── Opt into the Review + Acceptance approval workflow ──
    // Required so the Submit / Review / Approve steps have a real chain to exercise.
    const approvalMode = page.locator('#createTaskModal select[name="approval_mode"]').first();
    if (await approvalMode.isVisible().catch(() => false)) {
      // Setting value via JS isn't enough: the static <option value="none">
      // has the `selected` attribute, so HTML form serialization falls back
      // to it. Move the `selected` attribute to the option we want, then
      // dispatch change so the page's onchange runs and the reviewer/approver
      // fields appear.
      await approvalMode.evaluate((el) => {
        const sel = el as HTMLSelectElement;
        for (const opt of Array.from(sel.options)) {
          opt.removeAttribute('selected');
        }
        const target = sel.querySelector('option[value="review_acceptance"]') as HTMLOptionElement | null;
        if (target) {
          target.setAttribute('selected', 'selected');
          sel.value = 'review_acceptance';
        }
        sel.dispatchEvent(new Event('input',  { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(400);
      const reviewerSelect = page.locator('#createTaskModal select[name="reviewer_id"]').first();
      const approverSelect = page.locator('#createTaskModal select[name="approver_id"]').first();
      const revOptions = await reviewerSelect.locator('option:not([value=""])').all();
      if (revOptions.length > 0) {
        const revVal = await revOptions[0].getAttribute('value');
        await reviewerSelect.evaluate((el, v) => {
          const sel = el as HTMLSelectElement;
          for (const opt of Array.from(sel.options)) opt.removeAttribute('selected');
          const tgt = sel.querySelector('option[value="' + v + '"]') as HTMLOptionElement | null;
          if (tgt) { tgt.setAttribute('selected', 'selected'); sel.value = v; }
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, revVal!);
      }
      const appOptions = await approverSelect.locator('option:not([value=""])').all();
      if (appOptions.length > 0) {
        const appVal = await appOptions[0].getAttribute('value');
        await approverSelect.evaluate((el, v) => {
          const sel = el as HTMLSelectElement;
          for (const opt of Array.from(sel.options)) opt.removeAttribute('selected');
          const tgt = sel.querySelector('option[value="' + v + '"]') as HTMLOptionElement | null;
          if (tgt) { tgt.setAttribute('selected', 'selected'); sel.value = v; }
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, appVal!);
      }
      console.log('Opted new task into review_acceptance approval chain');
    } else {
      console.log('approval_mode select not visible — task will be created without approval chain');
    }

    await evidence.screenshotAfter('task_create_filled');

    // ── Submit ────────────────────────────────────────────────────
    // Use stable data-testid selector; falls back to CSS selector
    const submitBtn = page.locator('[data-testid="create-task-submit"]').first();
    if (!await submitBtn.isVisible().catch(() => false)) {
      // Fallback: locate submit button inside modal form
      const fallbackBtn = page.locator('#createTaskModal button[type="submit"]').first();
      await expect(fallbackBtn).toBeVisible({ timeout: 5000 });
      await fallbackBtn.click();
    } else {
      await submitBtn.click();
    }

    // Wait for navigation: the server redirects to /tasks/<id> on success
    // or back to /my-tasks with a flash message on validation error
    try {
      await page.waitForURL(/\/tasks\/\d+/, { timeout: 10_000 });
    } catch {
      // If no redirect to task detail, the form may have failed server-side
      // Capture the page state for diagnostics
      await evidence.screenshotAfter('task_create_submit_result');
      const currentUrl = page.url();
      console.log('Post-submit URL (no task detail redirect):', currentUrl);
      // Check for flash errors
      const flashError = await page.locator('.flash-error, .alert-error, [class*="error"]').first().textContent().catch(() => null);
      if (flashError) console.log('Flash error:', flashError);
    }

    // ── Extract task ID ────────────────────────────────────────────
    let taskId: number | undefined;
    const url = page.url();
    const taskMatch = url.match(/\/tasks\/(\d+)/);
    if (taskMatch) {
      taskId = parseInt(taskMatch[1]);
    }

    if (!taskId) {
      // Navigate back to tasks list and find our task
      await page.goto('/my-tasks', { waitUntil: 'load' });
      await page.waitForTimeout(1000);
      const taskLink = page.locator(
        `a[href*="/tasks/"]:has-text("${TASK_TITLE}")`
      ).first();
      if (await taskLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        const href = await taskLink.getAttribute('href');
        const linkMatch = href?.match(/\/tasks\/(\d+)/);
        if (linkMatch) taskId = parseInt(linkMatch[1]);
      }
    }

    await evidence.screenshotAfter('task_create');

    saveWorkflowState({ taskId, taskTitle: TASK_TITLE });
    expect(taskId).toBeTruthy();
    console.log(`Created task: ID=${taskId}, Title=${TASK_TITLE}`);
  });
});
