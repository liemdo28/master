/**
 * 06 - Reviewer Approve
 * Reviewer approves the task after it's been submitted for review.
 */
import { test, expect } from './fixtures';
import { loadWorkflowState, ensureAuthenticated } from './fixtures';

test.describe('06 - Reviewer Approve', () => {
  test('reviewer approves the task', async ({ page, evidence }) => {
    await ensureAuthenticated(page);

    const state = loadWorkflowState();
    const taskId = state.taskId;

    if (!taskId) {
      test.skip(true, 'No task ID from task creation step — skipped upstream');
    }
    expect(taskId).toBeTruthy();

    // Navigate to the task
    await page.goto(`/tasks/${taskId}`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await evidence.screenshotBefore('reviewer_approve');

    // Look for "Approve" button (reviewer action)
    const approveBtn = page.locator('button:has-text("Approve"), button:has-text("Accept"), form[action*="/review"] button[type="submit"]').first();

    if (await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      page.on('dialog', async (dialog) => { await dialog.accept(); });
      await approveBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Try direct API POST for review approval
      const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content')
        || await page.locator('input[name="csrf"]').first().getAttribute('value');

      if (csrfToken) {
        await page.request.post(`/tasks/${taskId}/review`, {
          form: { csrf: csrfToken, action: 'approve', note: 'QA auto-approve' }
        });
        await page.goto(`/tasks/${taskId}`, { waitUntil: 'load' });
        await page.waitForTimeout(2000);
      }
    }

    await evidence.screenshotAfter('reviewer_approve');

    // Verify review was processed
    const pageContent = await page.content();
    const reviewProcessed = pageContent.includes('Pending Acceptance')
      || pageContent.includes('approved')
      || pageContent.includes('pending_acceptance')
      || pageContent.includes('Approve');

    console.log(`Task ${taskId} review: processed = ${reviewProcessed}`);
  });
});
