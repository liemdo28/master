import { pgQuery } from '../bigdata/db-client';
import { ensureEnterpriseSchema } from '../queue/job-queue';

const PRODUCTION_ACTIONS = new Set(['deploy', 'delete', 'financial_post', 'browser_write', 'direct_db_write']);

export async function assertPermission(params: {
  actor?: string;
  action: string;
  resource: string;
  approval_id?: string;
}) {
  const actor = params.actor || 'system';
  const needsApproval = PRODUCTION_ACTIONS.has(params.action);
  const allowed = !needsApproval || Boolean(params.approval_id);
  const reason = allowed ? 'allowed' : 'approval_required';

  try {
    await ensureEnterpriseSchema();
    await pgQuery(
      `INSERT INTO permission_audit (actor, action, resource, decision, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [actor, params.action, params.resource, allowed ? 'allow' : 'deny', reason],
    );
  } catch {
    // Audit failures must not disclose DB internals to callers.
  }

  if (!allowed) throw new Error(`Permission denied: ${reason}`);
  return { allowed, reason };
}
