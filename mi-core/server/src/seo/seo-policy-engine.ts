/**
 * SEO Control Center — policy engine.
 * Loads config/seo-policy.yaml (SAFE_AUTO / AUTO_WITH_NOTIFICATION / REQUIRES_APPROVAL / BLOCKED)
 * and evaluates a category string against it. Unknown categories fail safe to REQUIRES_APPROVAL.
 * Precedence: BLOCKED > REQUIRES_APPROVAL > AUTO_WITH_NOTIFICATION > SAFE_AUTO — enforced by
 * checking tiers in that fixed order, never by any caller-supplied confidence/override value.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';

export type PolicyTier = 'SAFE_AUTO' | 'AUTO_WITH_NOTIFICATION' | 'REQUIRES_APPROVAL' | 'BLOCKED';

const TIER_PRECEDENCE: PolicyTier[] = ['BLOCKED', 'REQUIRES_APPROVAL', 'AUTO_WITH_NOTIFICATION', 'SAFE_AUTO'];

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const POLICY_PATH = path.join(MI_CORE_ROOT, 'config', 'seo-policy.yaml');

interface PolicyFile {
  version: number;
  SAFE_AUTO: string[];
  AUTO_WITH_NOTIFICATION: string[];
  REQUIRES_APPROVAL: string[];
  BLOCKED: string[];
}

let cached: PolicyFile | null = null;
let cachedMtimeMs = 0;

function loadPolicy(): PolicyFile {
  const stat = fs.statSync(POLICY_PATH);
  if (cached && stat.mtimeMs === cachedMtimeMs) return cached;
  const raw = fs.readFileSync(POLICY_PATH, 'utf8');
  const parsed = parseYaml(raw) as PolicyFile;
  cached = parsed;
  cachedMtimeMs = stat.mtimeMs;
  return parsed;
}

export interface PolicyEvaluation {
  category: string;
  tier: PolicyTier;
  reason: string;
  policy_version: number;
}

/**
 * Evaluate a single action category against the policy file.
 * Fail-safe: a category not listed anywhere defaults to REQUIRES_APPROVAL,
 * never to SAFE_AUTO — an unrecognized action is never auto-executed.
 */
export function evaluatePolicy(category: string): PolicyEvaluation {
  const policy = loadPolicy();

  for (const tier of TIER_PRECEDENCE) {
    const list = policy[tier] || [];
    if (list.includes(category)) {
      return { category, tier, reason: `matched ${tier} list`, policy_version: policy.version };
    }
  }

  return {
    category,
    tier: 'REQUIRES_APPROVAL',
    reason: 'category not found in seo-policy.yaml — fail-safe default',
    policy_version: policy.version,
  };
}

export function isBlocked(category: string): boolean {
  return evaluatePolicy(category).tier === 'BLOCKED';
}

export function requiresApproval(category: string): boolean {
  const tier = evaluatePolicy(category).tier;
  return tier === 'REQUIRES_APPROVAL' || tier === 'BLOCKED';
}

export function getRawPolicy(): PolicyFile {
  return loadPolicy();
}

export function getPolicyPath(): string {
  return POLICY_PATH;
}
