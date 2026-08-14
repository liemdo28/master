/**
 * Phase 7C — deterministic request-type classification (directive §5).
 * Pure rules + typed schema, no LLM. An LLM may assist ambiguous natural-
 * language understanding elsewhere in the pipeline, but never determines
 * authority, approval level, policy result, project boundary, or external
 * action permission — those stay canonical deterministic systems (§5, §38).
 */
import type { RequestType } from './types';

/** Strips Vietnamese diacritics and lowercases, matching the NFD-normalize
 *  convention already used by gstack/intent-router.ts and jarvis-core.ts —
 *  reused here as a plain text-normalization technique, not as a dependency
 *  on either of those (non-canonical) modules. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

interface Rule {
  type: RequestType;
  pattern: RegExp;
}

// Ordered — first match wins. More specific/higher-authority-implying
// patterns are checked before general ones.
const RULES: Rule[] = [
  { type: 'SYSTEM_STATUS', pattern: /\b(health|status|he thong|dang chay|is (up|down|broken)|what'?s broken|gi bi loi|healthy|degraded)\b/ },
  { type: 'OPERATOR_QUERY', pattern: /\b(pending|waiting.?approval|blocked|why (was|is) this blocked|operator|what did you do)\b/ },
  { type: 'CODING', pattern: /\b(code|coding|fix\b.*\bbug|implement|refactor|write (a )?function|pull request|git diff)\b/ },
  { type: 'ACTION_PROPOSAL', pattern: /\b(draft (an? )?email|schedule (a )?meeting|create (a )?calendar event|send (an? )?email|propose|book (a )?meeting)\b/ },
  { type: 'SIMULATION', pattern: /\b(simulate|what would happen|dry.?run|preview (the )?effect)\b/ },
  { type: 'PLANNING', pattern: /\b(plan|create a plan|how should i|break (this )?down|next steps for)\b/ },
  { type: 'GOAL_QUERY', pattern: /\b(goal|goals|objective)\b/ },
  { type: 'PROJECT_QUERY', pattern: /\b(project|repo|repository)\b/ },
  { type: 'TASK_QUERY', pattern: /\b(task|tasks|todo|to.?do|what'?s waiting|waiting on me)\b/ },
  { type: 'KNOWLEDGE_SEARCH', pattern: /\b(document|documentation|knowledge|according to|cite|source|find (the )?doc)\b/ },
];

export interface Classification {
  type: RequestType;
  confidence: number;
  matchedRule: string | null;
}

export function classifyRequest(rawText: string, explicitType?: RequestType): Classification {
  if (explicitType) {
    return { type: explicitType, confidence: 1, matchedRule: 'explicit' };
  }
  const text = normalize(rawText);
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { type: rule.type, confidence: 0.9, matchedRule: rule.pattern.source };
    }
  }
  return { type: 'INFORMATION', confidence: 0.5, matchedRule: null };
}
