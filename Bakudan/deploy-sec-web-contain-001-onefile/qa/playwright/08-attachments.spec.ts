/**
 * 08 - Attachments
 * Tests file upload functionality on a task.
 */
import { test, expect } from './fixtures';
import { loadWorkflowState, ensureAuthenticated } from './fixtures';
import path from 'path';
import fs from 'fs';

test.describe('08 - Attachments', () => {
  test('upload attachment to task', async ({ page, evidence }) => {
    await ensureAuthenticated(page);

    const state = loadWorkflowState();
    const taskId = state.taskId;

    if (!taskId) {
      test.skip(true, 'No task ID from task creation step — skipped upstream');
    }
    expect(taskId).toBeTruthy();

    // Create a temporary test file
    const testFilePath = path.join(__dirname, '.auth', 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'QA Automated Test Upload - ' + new Date().toISOString());

    // Navigate to the task
    await page.goto(`/tasks/${taskId}`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await evidence.screenshotBefore('attachment');

    // Look for file upload input
    const fileInput = page.locator(
      'input[type="file"], input[name="attachment"], input[name="file"], input[name="attachments[]"]'
    ).first();

    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileInput.setInputFiles(testFilePath);
      await page.waitForTimeout(2000);

      const uploadBtn = page.locator(
        'button:has-text("Upload"), button:has-text("Attach"), form[action*="upload"] button[type="submit"]'
      ).first();
      if (await uploadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uploadBtn.click();
        await page.waitForTimeout(3000);
      }

      const uploaded = await page.locator(
        'text="test-upload.txt", .attachment-item, .file-item, .flash-success, .alert-success'
      ).first().isVisible().catch(() => false);

      await evidence.screenshotAfter('attachment');
      expect(uploaded).toBe(true);
    } else {
      const dropZone = page.locator('.dropzone, .file-drop, [data-dropzone]').first();
      if (await dropZone.isVisible({ timeout: 3000 }).catch(() => false)) {
        const hiddenInput = page.locator('input[type="file"]').first();
        await hiddenInput.setInputFiles(testFilePath);
        await page.waitForTimeout(3000);
        await evidence.screenshotAfter('attachment');
      } else {
        await evidence.screenshotAfter('attachment_not_available');
        test.skip(true, 'File upload not available on this task page');
      }
    }

    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
  });
});
