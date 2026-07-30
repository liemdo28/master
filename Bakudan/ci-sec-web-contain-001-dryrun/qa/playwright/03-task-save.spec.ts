/**
 * 03 - Task Save
 * Verifies the task was saved correctly by navigating to its detail page.
 */
import { test, expect } from './fixtures';
import { loadWorkflowState, ensureAuthenticated } from './fixtures';

test.describe('03 - Task Save', () => {
  test('task detail page shows saved data', async ({ page, evidence }) => {
    await ensureAuthenticated(page);

    const state = loadWorkflowState();
    const taskId = state.taskId;
    const taskTitle = state.taskTitle;

    if (!taskId) {
      test.skip(true, 'No task ID from task creation step — skipped upstream');
    }

    expect(taskId).toBeTruthy();
    await evidence.screenshotBefore('task_save');

    await page.goto(`/tasks/${taskId}`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    const titleVisible = await page.locator(`text=${taskTitle}`).first().isVisible({ timeout: 10_000 }).catch(() => false);

    if (!titleVisible) {
      const titleInInput = await page.locator(`input[value*="QA-Auto"], h1:has-text("QA-Auto"), h2:has-text("QA-Auto"), .task-title:has-text("QA-Auto")`).first().isVisible().catch(() => false);
      expect(titleInInput).toBe(true);
    }

    await evidence.screenshotAfter('task_save');
    console.log(`Task ${taskId} verified on detail page`);
  });
});
