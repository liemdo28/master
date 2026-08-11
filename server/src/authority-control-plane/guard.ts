import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ControlledActionService } from '../personal-os/actions/service';
import { LegacyAuthorityAdapter, respondWithLegacyResult } from './legacy-adapter';
import { generateAuthorityManifest } from './scanner';
import { isMutation } from './registry';
import type { AuthoritySurface } from './types';

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
  const adapter = new LegacyAuthorityAdapter();
  respondWithLegacyResult(res, adapter.quarantine(surfaceId, reason, 'authority-control-plane', status));
}

export function isLegacyExternalAction(category: string): boolean {
  return LEGACY_EXTERNAL_ACTION_CATEGORIES.has(category);
}

export function legacyAuthorityBoundary(req: Request, res: Response, next: NextFunction): void {
  const surface = legacyMutationMatcher().find(item => item.method === req.method && item.regex.test(req.path));
  if (!surface) return next();
  if (surface.id === 'http:POST:/api/approval/request') return next();
  denyAuthorityMutation(res, surface.id, `Legacy mutation ${surface.runtimeMount} is quarantined by the Phase 6B authority boundary.`, 409);
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

let legacyMutationCache: Array<AuthoritySurface & { regex: RegExp }> | null = null;

function legacyMutationMatcher(): Array<AuthoritySurface & { regex: RegExp }> {
  if (legacyMutationCache) return legacyMutationCache;
  const manifest = generateAuthorityManifest(process.cwd());
  legacyMutationCache = manifest.surfaces
    .filter(surface =>
      isMutation(surface.method, surface.effectClass) &&
      (surface.legacyReason !== null || surface.authorityClass === 'LEGACY_QUARANTINED') &&
      surface.phase6bDisposition !== 'ADAPT_SAFE'
    )
    .map(surface => ({ ...surface, regex: routeRegex(surface.runtimeMount) }));
  return legacyMutationCache;
}

function routeRegex(runtimeMount: string): RegExp {
  const escaped = runtimeMount
    .split('/')
    .map(segment => segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('/');
  return new RegExp(`^${escaped}/?$`);
}
