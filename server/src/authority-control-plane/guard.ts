import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ControlledActionService } from '../personal-os/actions/service';

export const LEGACY_EXTERNAL_ACTION_CATEGORIES = new Set([
  'gmail_send',
  'gmail_draft',
  'calendar_create',
  'calendar_update',
  'drive_upload',
  'drive_share',
  'asana_create',
  'asana_update',
  'dashboard_create',
]);

export function denyAuthorityMutation(res: Response, surfaceId: string, reason: string, status = 409): void {
  recordAuthorityEvent('authority.legacy.blocked', surfaceId, reason);
  res.status(status).json({
    error: 'AUTHORITY_SURFACE_QUARANTINED',
    surfaceId,
    reason,
  });
}

export function isLegacyExternalAction(category: string): boolean {
  return LEGACY_EXTERNAL_ACTION_CATEGORIES.has(category);
}

export function denyUnregisteredMutation(_req: Request, res: Response): void {
  denyAuthorityMutation(res, 'test:unregistered-mutation', 'Mutation surface is not registered in the authority control plane.', 403);
}

export function recordAuthorityEvent(eventType: string, surfaceId: string, reason: string): void {
  try {
    const service = new ControlledActionService();
    try {
      service.policyEngine.audit.record({
        eventType,
        policyVersion: null,
        inputHash: null,
        decisionHash: null,
        actor: 'authority-control-plane',
        proposalId: null,
        reasons: [reason],
        metadata: { surfaceId, eventId: `authority-${randomUUID()}` },
      });
    } finally {
      service.close();
    }
  } catch {
    // Authority denial must not become an availability dependency on the audit DB.
  }
}
