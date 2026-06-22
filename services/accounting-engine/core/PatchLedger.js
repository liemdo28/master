// core/PatchLedger.js - Patch lifecycle tracking with full lineage
import { appendAuditEvent } from './AuditLedger.js';

export function createPatchRecord(db, patch) {
  const {
    patch_id, parent_patch = null, branch_name = null,
    deployment_target = 'local', affected_modules = [],
    task, risk_level = 'low', files_changed = [],
  } = patch;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO patch_ledger
      (patch_id, parent_patch, branch_name, deployment_target, affected_modules,
       task, status, risk_level, approval_status, files_changed, created_at)
    VALUES
      (@patch_id, @parent_patch, @branch_name, @deployment_target, @affected_modules,
       @task, 'proposed', @risk_level, 'pending', @files_changed, @created_at)
  `).run({
    patch_id,
    parent_patch,
    branch_name,
    deployment_target,
    affected_modules: JSON.stringify(affected_modules),
    task,
    risk_level,
    files_changed:    JSON.stringify(files_changed),
    created_at:       now,
  });

  appendAuditEvent(db, 'PATCH_CREATED', { patch_id, task, risk_level, parent_patch });
  return getPatchRecord(db, patch_id);
}

export function updatePatchStatus(db, patch_id, status, opts = {}) {
  const { rollback_reason, approved_by, approval_status } = opts;
  const now  = new Date().toISOString();
  const sets = ['status = @status'];
  const args = { patch_id, status };

  if (status === 'applied')      { sets.push('applied_at = @now');       args.now = now; }
  if (status === 'rolled_back')  { sets.push('rolled_back_at = @now');   args.now = now; }
  if (rollback_reason)           { sets.push('rollback_reason = @rollback_reason'); args.rollback_reason = rollback_reason; }
  if (approved_by)               { sets.push('approved_by = @approved_by'); args.approved_by = approved_by; }
  if (approval_status)           { sets.push('approval_status = @approval_status'); args.approval_status = approval_status; }

  db.prepare(`UPDATE patch_ledger SET ${sets.join(', ')} WHERE patch_id = @patch_id`).run(args);
  appendAuditEvent(db, `PATCH_${status.toUpperCase()}`, { patch_id, status, rollback_reason });
  return getPatchRecord(db, patch_id);
}

export function getPatchRecord(db, patch_id) {
  const row = db.prepare('SELECT * FROM patch_ledger WHERE patch_id = ?').get(patch_id);
  if (!row) return null;
  return {
    ...row,
    affected_modules: JSON.parse(row.affected_modules ?? '[]'),
    files_changed:    JSON.parse(row.files_changed    ?? '[]'),
  };
}

export function listPatches(db, { status, limit = 100, offset = 0 } = {}) {
  const where = status ? 'WHERE status = ?' : '';
  const args  = status ? [status, limit, offset] : [limit, offset];
  return db.prepare(
    `SELECT * FROM patch_ledger ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...args).map((r) => ({
    ...r,
    affected_modules: JSON.parse(r.affected_modules ?? '[]'),
    files_changed:    JSON.parse(r.files_changed    ?? '[]'),
  }));
}

export function getPatchLineage(db, patch_id) {
  const chain = [];
  let current = getPatchRecord(db, patch_id);
  while (current) {
    chain.push(current);
    if (!current.parent_patch) break;
    current = getPatchRecord(db, current.parent_patch);
  }
  return chain;
}

export function getPatchStats(db) {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='proposed'    THEN 1 ELSE 0 END) as proposed,
      SUM(CASE WHEN status='applied'     THEN 1 ELSE 0 END) as applied,
      SUM(CASE WHEN status='rejected'    THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) as rolled_back,
      SUM(CASE WHEN status='failed'      THEN 1 ELSE 0 END) as failed
    FROM patch_ledger
  `).get();
  return row;
}
