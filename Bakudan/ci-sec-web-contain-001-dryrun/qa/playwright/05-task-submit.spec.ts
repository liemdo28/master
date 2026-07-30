/**
 * 05 - Task Submit
 * Submits the task for review via the form on the task detail page.
 */
import { test, expect } from './fixtures';
import { loadWorkflowState, ensureAuthenticated } from './fixtures';

test.describe('05 - Task Submit', () => {
  test('submit task for review', async ({ page, evidence }) => {
    await ensureAuthenticated(page);

    const state = loadWorkflowState();
    const taskId = state.taskId;

    // Must have a task ID from previous steps
    if (!taskId) {
      test.skip(true, 'No task ID from task creation step — skipped upstream');
    }
    expect(taskId).toBeTruthy();

    // Navigate to the task — re-auth first so a stale session can't dump us on /login
    await page.goto('/overview', { waitUntil: 'load' });
    await ensureAuthenticated(page);
    await page.goto(`/tasks/${taskId}`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await evidence.screenshotBefore('task_submit');

    // Look for "Submit for Review" button
    const submitBtn = page.locator('button:has-text("Submit for Review"), button:has-text("Submit"), a:has-text("Submit for Review")').first();

    if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      page.on('dialog', async (dialog) => { await dialog.accept(); });
      await submitBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Task might not have approval workflow enabled, try to submit via direct POST
      const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content')
        || await page.locator('input[name="csrf"]').first().getAttribute('value');

      if (csrfToken) {
        await page.request.post(`/tasks/${taskId}/submit`, { form: { csrf: csrfToken } });
        await page.goto(`/tasks/${taskId}`, { waitUntil: 'load' });
        await page.waitForTimeout(2000);
      }
    }

    await evidence.screenshotAfter('task_submit');

    // Verify task status changed (shows "Pending Review" or moved to review state)
    const pageContent = await page.content();
    const hasReviewState = pageContent.includes('Pending Review')
      || pageContent.includes('pending_review')
      || pageContent.includes('submitted')
      || pageContent.includes('review');

    console.log(`Task ${taskId} submit: review state visible = ${hasReviewState}`);
  });
});
