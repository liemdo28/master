// tests/stress/seed-stress.js - Bulk data seeder for stress testing
import { openDatabase, batchInsert, closeDatabase } from '../../core/DatabaseManager.js';
import { createPatchRecord, updatePatchStatus }      from '../../core/PatchLedger.js';
import { startQARun, completeQARun }                 from '../../core/QAAccounting.js';
import { appendAuditEvent }                          from '../../core/AuditLedger.js';
import { randomUUID }                                from 'crypto';

export async function seedDatabase(db, { sessions = 1000, patches = 10000, metrics = 100000 } = {}) {
  const t0 = Date.now();

  // Sessions
  console.log(`  seeding ${sessions} sessions...`);
  const sessionRows = [];
  const sessionIds  = [];
  for (let i = 0; i < sessions; i++) {
    const session_id = `sess-${i}-${randomUUID().slice(0, 8)}`;
    sessionIds.push(session_id);
    sessionRows.push({
      session_id,
      project_name: `project-${i % 10}`,
      started_at:   new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
      ended_at:     null,
      status:       'completed',
      metadata:     JSON.stringify({ seeded: true, index: i }),
    });
    if (sessionRows.length === 500) {
      batchInsert(db, 'sessions', sessionRows.splice(0));
    }
  }
  if (sessionRows.length) batchInsert(db, 'sessions', sessionRows);

  // Metrics
  console.log(`  seeding ${metrics} resource_metrics rows...`);
  const CHUNK = 2000;
  for (let i = 0; i < metrics; i += CHUNK) {
    const chunk = [];
    for (let j = 0; j < CHUNK && i + j < metrics; j++) {
      chunk.push({
        session_id:       sessionIds[Math.floor(Math.random() * sessionIds.length)],
        timestamp:        new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
        cpu_pct:          Math.random() * 5,
        memory_mb:        100 + Math.random() * 200,
        heap_used_mb:     80  + Math.random() * 150,
        heap_total_mb:    200 + Math.random() * 100,
        rss_mb:           120 + Math.random() * 200,
        memory_delta_pct: Math.random() * 2,
        gpu_mb:           null,
        disk_free_mb:     null,
      });
    }
    batchInsert(db, 'resource_metrics', chunk);
    process.stdout.write(`\r    ${Math.min(i + CHUNK, metrics)}/${metrics}   `);
  }
  console.log();

  // Patches
  console.log(`  seeding ${patches} patches...`);
  const statuses   = ['proposed', 'applied', 'rejected', 'rolled_back', 'failed'];
  const PCHUNK     = 500;
  const patchIds   = [];
  for (let i = 0; i < patches; i++) {
    const patch_id    = `patch-seed-${i}-${randomUUID().slice(0, 6)}`;
    const parentPatch = patchIds.length > 0 && i % 5 !== 0 ? patchIds[Math.floor(Math.random() * patchIds.length)] : null;
    patchIds.push(patch_id);
    createPatchRecord(db, {
      patch_id,
      parent_patch:      parentPatch,
      branch_name:       `branch-${i % 20}`,
      deployment_target: i % 3 === 0 ? 'staging' : 'local',
      affected_modules:  [`module-${i % 8}`],
      task:              `Seeded task ${i}`,
      risk_level:        i % 5 === 0 ? 'high' : 'low',
      files_changed:     [`src/seed-${i % 100}.js`],
    });
    const status = statuses[i % statuses.length];
    if (status !== 'proposed') {
      updatePatchStatus(db, patch_id, status, {
        rollback_reason:  status === 'rolled_back' ? 'seed rollback' : undefined,
        approval_status:  status === 'applied'     ? 'approved'      : 'pending',
      });
    }
    if (i % PCHUNK === 0) process.stdout.write(`\r    ${i}/${patches}   `);
  }
  console.log(`\r    ${patches}/${patches}   `);

  // QA runs
  const qaRuns = Math.floor(patches / 100);
  console.log(`  seeding ${qaRuns} QA runs...`);
  const projects = Array.from({ length: 10 }, (_, i) => `project-${i}`);
  for (let i = 0; i < qaRuns; i++) {
    const project = projects[i % projects.length];
    const run_id  = startQARun(db, project);
    completeQARun(db, run_id, {
      total_tests:       100 + Math.floor(Math.random() * 400),
      failed_tests:      Math.floor(Math.random() * 20),
      flaky_tests:       Math.floor(Math.random() * 10),
      qa_reruns:         Math.floor(Math.random() * 5),
      regression_score:  Math.random() * 0.6,
      fix_time_minutes:  Math.random() * 60,
      build_success:     true,
      test_success:      Math.random() > 0.15,
      qa_score:          50 + Math.random() * 50,
      qa_grade:          Math.random() > 0.15 ? 'PASS' : 'FAIL',
      total_cost_cents:  Math.floor(Math.random() * 5000),
      repeated_issue_key: i % 10 === 0 ? `flaky-test-${i % 3}` : null,
    });
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`  [seed] done in ${elapsed}s`);
}

// Run directly
if (process.argv[1] && process.argv[1].includes('seed-stress')) {
  const db = openDatabase();
  await seedDatabase(db, { sessions: 1000, patches: 10000, metrics: 100000 });
  closeDatabase();
}
