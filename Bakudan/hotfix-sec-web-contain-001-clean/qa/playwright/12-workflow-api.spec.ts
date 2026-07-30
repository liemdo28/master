/**
 * Phase 1 — Workflow Execution API integration tests
 * Hits the four JSON endpoints and asserts envelope + shape.
 */
import { test, expect } from '@playwright/test';

const ENDPOINTS = [
  { path: '/api/workflow/my-work',        required: ['assigned_to_me', 'due_today', 'overdue_mine', 'mentioned_me', 'waiting_on_me'] },
  { path: '/api/workflow/reviewer-queue', required: ['needs_review', 'waiting_evidence', 'approved', 'rejected'] },
  { path: '/api/workflow/approver-queue', required: ['needs_approval', 'accepted', 'rejected'] },
  { path: '/api/workflow/command-center', required: ['my_work', 'review', 'approve', 'critical_today', 'blocked'] },
];

for (const { path, required } of ENDPOINTS) {
  test(`[workflow-api] ${path} returns a valid envelope`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status(), `${path} status`).toBeLessThan(500);
    const json = await res.json();
    expect(json.success, `${path} success=true`).toBe(true);
    expect(json.data, `${path} data present`).toBeTruthy();
    for (const key of required) {
      expect(json.data, `${path}.data.${key}`).toHaveProperty(key);
    }
  });
}

test('[workflow-api] /api/workflow/my-work/list returns bucket tasks', async ({ request }) => {
  const res = await request.get('/api/workflow/my-work/list?bucket=assigned_to_me');
  expect(res.status()).toBeLessThan(500);
  const json = await res.json();
  expect(json.data).toHaveProperty('bucket', 'assigned_to_me');
  expect(Array.isArray(json.data.tasks)).toBe(true);
});
