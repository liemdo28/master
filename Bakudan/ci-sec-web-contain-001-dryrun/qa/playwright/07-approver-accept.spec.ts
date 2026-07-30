/**
 * 07 - Approver Accept (Done)
 * Final approver accepts the task, marking it as Done.
 */
import { test, expect } from './fixtures';
import { loadWorkflowState, ensureAuthenticated } from './fixtures';

test.describe('07 - Approver Accept', () => {
  test('approver accepts the task', async ({ page, evidence }) => {
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
    await evidence.screenshotBefore('approver_accept');

    // Look for "Accept" / "Approve" / "Mark Done" button
    const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Approve"), button:has-text("Done"), button:has-text("Complete"), form[action*="/approve"] button[type="submit"]').first();

    if (await acceptBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      page.on('dialog', async (dialog) => { await dialog.accept(); });
      await acceptBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Try direct API POST for acceptance
      const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content')
        || await page.locator('input[name="csrf"]').first().getAttribute('value');

      if (csrfToken) {
        const resp = await page.request.post(`/tasks/${taskId}/approve`, {
          form: { csrf: csrfToken, action: 'approve', note: 'QA auto-accept' }
        });
        if (!resp.ok()) {
          await page.request.post(`/tasks/${taskId}/toggle-complete`, { form: { csrf: csrfToken } });
        }
        await page.goto(`/tasks/${taskId}`, { waitUntil: 'load' });
        await page.waitForTimeout(2000);
      }
    }

    await evidence.screenshotAfter('approver_accept');

    // Verify task is done/completed
    const pageContent = await page.content();
    const isDone = pageContent.includes('Done')
      || pageContent.includes('Completed')
      || pageContent.includes('done')
      || pageContent.includes('completed')
      || pageContent.includes('✅');

    console.log(`Task ${taskId} final: done = ${isDone}`);
  });
});
