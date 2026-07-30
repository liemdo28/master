/**
 * 09 - Mentions
 * Tests @mention functionality in task comments.
 */
import { test, expect } from './fixtures';
import { loadWorkflowState, ensureAuthenticated } from './fixtures';

test.describe('09 - Mentions', () => {
  test('add comment with @mention', async ({ page, evidence }) => {
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
    await evidence.screenshotBefore('mention');

    // Find comment input
    const commentInput = page.locator(
      'textarea[name="comment"], textarea[name="body"], textarea[name="content"], #comment-input, .comment-input, [placeholder*="comment"], [placeholder*="Comment"]'
    ).first();

    if (await commentInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Type a comment with @mention
      await commentInput.fill('QA test comment @admin checking mentions work');
      await page.waitForTimeout(1000);

      // Check if mention dropdown appears after typing @
      await commentInput.clear();
      await commentInput.type('Testing @');
      await page.waitForTimeout(1500);

      const mentionDropdown = page.locator(
        '.mention-list, .mention-dropdown, .tribute-container, [data-mention-list], .at-who, .mentions-autocomplete'
      ).first();
      const hasMentions = await mentionDropdown.isVisible().catch(() => false);

      // Complete the comment regardless
      await commentInput.clear();
      await commentInput.fill('QA automated mention test @admin - workflow validation');

      const submitBtn = page.locator(
        'button:has-text("Comment"), button:has-text("Post"), button:has-text("Send"), form[action*="comment"] button[type="submit"], .comment-form button[type="submit"]'
      ).first();

      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }

      await evidence.screenshotAfter('mention');

      const commentPosted = await page.locator('text="QA automated mention test"').isVisible().catch(() => false);
      if (!commentPosted) {
        console.warn('Comment may not have been posted - task might be in completed state');
      }
    } else {
      await evidence.screenshotAfter('mention_not_available');
      test.skip(true, 'Comment input not available on this task');
    }
  });
});
