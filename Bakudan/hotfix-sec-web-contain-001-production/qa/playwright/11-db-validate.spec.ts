/**
 * 11 - Database Validation
 * Runs after workflow to verify database state and generate SQL evidence report.
 */
import { test, expect } from './fixtures';
import { loadWorkflowState, ensureAuthenticated } from './fixtures';
import { validateDatabase } from './db-validate';

test.describe('11 - Database Validation', () => {
  test('verify workflow data in database', async ({ page, evidence }) => {
    // Re-auth before making API calls so a stale session can't make the
    // /tasks/<id>/json request return 401/302 and report "task not found".
    await page.goto('/overview', { waitUntil: 'load' });
    await ensureAuthenticated(page);

    await evidence.screenshotBefore('db_validate');

    const state = loadWorkflowState();
    if (!state.taskId) {
      test.skip(true, 'No task ID from task creation step — skipped upstream');
    }

    const results = await validateDatabase(page);

    // Task must exist
    const taskResult = results.find((r) => r.table === 'tasks');
    expect(taskResult?.found).toBe(true);

    await evidence.screenshotAfter('db_validate');

    // Log results for reporting
    for (const r of results) {
      const status = r.found ? 'OK' : 'MISSING';
      console.log(`${status} ${r.table}: ${r.count} records`);
    }
  });
});
