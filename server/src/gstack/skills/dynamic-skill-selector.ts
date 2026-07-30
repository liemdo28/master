/**
 * Dynamic Skill Selector — Phase 11
 * Replaces hardcoded intent→skill maps with tag-based discovery + scoring.
 */

import { getAllSkillsFromStore } from './skill-store';
import { getReliabilityScore } from './skill-reliability-tracker';
import type { AgentSkillDefinition, SkillDiscoveryQuery, SkillDiscoveryResult } from './agent-skill-schema';

// Phase 12: lazy-loaded trust scores (avoids circular import at module load)
function getTrustScoreValue(skillId: string): number {
  try {
    const { getTrustScore } = require('./skill-trust-score');
    return getTrustScore(skillId)?.score ?? 50;
  } catch { return 50; }
}

// ── Intent → tag profile ───────────────────────────────────────────────────────

const INTENT_TAG_PROFILE: Record<string, { required: string[]; preferred: string[]; exclude: string[] }> = {
  audit_project:    { required: ['safe'],        preferred: ['audit', 'monitoring', 'qa', 'dashboard'], exclude: ['deploy', 'restart'] },
  fix_bug:          { required: ['safe', 'code'], preferred: ['scan', 'qa', 'test', 'build'],           exclude: ['deploy', 'restart'] },
  build_feature:    { required: ['safe'],         preferred: ['code', 'knowledge', 'github'],            exclude: ['restart', 'test'] },
  deploy_release:   { required: [],               preferred: ['deploy', 'restart', 'build'],             exclude: [] },
  rollback:         { required: [],               preferred: ['restart', 'deploy'],                      exclude: [] },
  check_status:     { required: ['safe'],         preferred: ['monitoring', 'health', 'system'],         exclude: [] },
  monitor_runtime:  { required: ['safe'],         preferred: ['monitoring', 'system', 'log'],            exclude: [] },
  search_knowledge: { required: ['safe'],         preferred: ['knowledge', 'search'],                    exclude: [] },
  create_report:    { required: ['safe'],         preferred: ['audit', 'dashboard', 'knowledge'],        exclude: [] },
  send_message:     { required: [],               preferred: ['communication'],                          exclude: [] },
};

// ── Discovery ──────────────────────────────────────────────────────────────────

export function discoverSkills(query: SkillDiscoveryQuery): SkillDiscoveryResult[] {
  const all = getAllSkillsFromStore();
  const results: SkillDiscoveryResult[] = [];

  for (const skill of all) {
    if (skill.disabled) continue;
    if (query.available_only !== false && !skill.available) continue;
    if (query.category && skill.category !== query.category) continue;
    if (query.approval_class && skill.approval_class !== query.approval_class) continue;

    const reliability = getReliabilityScore(skill.id);

    if (query.min_reliability !== undefined && reliability.score < query.min_reliability) continue;

    let matchScore = 0;
    const matchReasons: string[] = [];

    // Intent-based tag matching
    if (query.intent) {
      const profile = INTENT_TAG_PROFILE[query.intent];
      if (profile) {
        const excluded = profile.exclude.some(t => skill.tags.includes(t));
        if (excluded) continue;

        const requiredMet = profile.required.every(t => skill.tags.includes(t));
        if (!requiredMet) continue;

        const preferredCount = profile.preferred.filter(t => skill.tags.includes(t)).length;
        matchScore += preferredCount * 20;
        if (preferredCount > 0) matchReasons.push(`matches ${preferredCount} preferred tags`);
      }
    }

    // Explicit tag query
    if (query.tags?.length) {
      const overlap = query.tags.filter(t => skill.tags.includes(t)).length;
      if (overlap === 0 && query.tags.length > 0) continue;
      matchScore += overlap * 15;
      matchReasons.push(`${overlap}/${query.tags.length} tags matched`);
    }

    // Phase 12: Trust score bonus (replaces reliability-only ranking)
    const trustScore = getTrustScoreValue(skill.id);
    matchScore += Math.round(trustScore / 10);
    if (reliability.execution_count > 0) matchReasons.push(`trust ${trustScore}/100 (reliability ${reliability.score}/100)`);

    // SAFE bonus
    if (skill.approval_class === 'SAFE') { matchScore += 5; matchReasons.push('SAFE'); }

    results.push({ skill, match_score: matchScore, match_reasons: matchReasons, reliability });
  }

  return results.sort((a, b) => b.match_score - a.match_score);
}

// ── Best skill chain for an intent ────────────────────────────────────────────

export function selectBestSkillChain(intent: string): string[] {
  const discovered = discoverSkills({ intent, available_only: true });

  if (discovered.length === 0) return fallbackChain(intent);

  // Deduplicate by category — don't run two scans if one suffices
  const selected: AgentSkillDefinition[] = [];
  const usedCategories = new Set<string>();

  for (const result of discovered) {
    const s = result.skill;
    // Allow multiple 'code' and 'system' skills, cap at 1 per niche category
    const cappedCategories = ['knowledge', 'communication', 'finance'];
    if (cappedCategories.includes(s.category) && usedCategories.has(s.category)) continue;
    usedCategories.add(s.category);
    selected.push(s);
    if (selected.length >= 6) break; // max 6 skills per chain
  }

  const ids = selected.map(s => s.id);
  return ids.length > 0 ? ids : fallbackChain(intent);
}

// ── Fallback (static map — safety net) ────────────────────────────────────────

function fallbackChain(intent: string): string[] {
  const map: Record<string, string[]> = {
    audit_project:    ['health', 'pm2_status', 'source_scan', 'log_scan', 'dashboard_audit'],
    fix_bug:          ['health', 'pm2_status', 'source_scan', 'log_scan', 'build_check', 'regression_suite'],
    build_feature:    ['knowledge_search', 'source_scan'],
    deploy_release:   ['health', 'build_check', 'pm2_restart'],
    rollback:         ['pm2_restart'],
    check_status:     ['health', 'pm2_status'],
    monitor_runtime:  ['health', 'pm2_status', 'log_scan'],
    search_knowledge: ['knowledge_search'],
    create_report:    ['knowledge_search', 'dashboard_audit', 'health'],
    send_message:     ['gmail_draft'],
  };
  return map[intent] || ['health'];
}

// ── Search skills by text ──────────────────────────────────────────────────────

export function searchSkills(query: string): AgentSkillDefinition[] {
  const q = query.toLowerCase();
  return getAllSkillsFromStore().filter(s =>
    s.id.includes(q) ||
    s.name.toLowerCase().includes(q) ||
    s.name_vi.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.tags.some(t => t.includes(q))
  );
}
