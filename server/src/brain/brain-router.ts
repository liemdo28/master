/**
 * Brain Router — Mi Executive OS WS1
 *
 * Selects the optimal model config for each classified intent.
 * CEO never sees this — Mi just picks the right brain.
 */

import { ClassifiedIntent, BrainName } from './intent-classifier';

export interface BrainConfig {
  brain: BrainName;
  model: string;
  temperature: number;
  max_tokens: number;
  system_suffix?: string;   // extra instructions appended to system prompt
  timeout_ms: number;
}

const MODELS = {
  fast:     process.env.OLLAMA_FAST_MODEL    || 'qwen3:8b',
  balanced: process.env.OLLAMA_FAST_MODEL    || 'qwen3:8b',
  deep:     process.env.OLLAMA_DEEP_MODEL    || 'qwen3:14b',
  coder:    process.env.OLLAMA_CODER_MODEL   || 'qwen2.5-coder:7b',
  tiny:     process.env.OLLAMA_TINY_MODEL    || 'qwen3:1.7b',
};

// ── Domain → brain config mapping ─────────────────────────────────────────
export function selectBrainConfig(intent: ClassifiedIntent): BrainConfig {
  switch (intent.brain) {

    case 'qwen-fast':
      return {
        brain: 'qwen-fast',
        model: MODELS.tiny,
        temperature: 0.3,
        max_tokens: 512,
        timeout_ms: 15000,
      };

    case 'qwen-balanced':
      return {
        brain: 'qwen-balanced',
        model: MODELS.balanced,
        temperature: 0.5,
        max_tokens: 2048,
        timeout_ms: 30000,
      };

    case 'qwen-deep':
      return {
        brain: 'qwen-deep',
        model: MODELS.deep,
        temperature: 0.6,
        max_tokens: 4096,
        timeout_ms: 90000,
      };

    case 'qwen-coder':
      return {
        brain: 'qwen-coder',
        model: MODELS.coder,
        temperature: 0.2,
        max_tokens: 4096,
        system_suffix: '\nYou are an expert software engineer. Be precise, terse, and focus on code quality.',
        timeout_ms: 60000,
      };

    case 'compliance':
      return {
        brain: 'compliance',
        model: MODELS.balanced,
        temperature: 0.2,  // low temp for factual compliance answers
        max_tokens: 2048,
        system_suffix: `\nIMPORTANT: Answer only from the compliance reference data provided.
Always include: jurisdiction, source document, and disclaimer to verify with CPA/legal professional.
Never guess or hallucinate legal requirements. If data not found, say "Not found in reference DB."`,
        timeout_ms: 45000,
      };

    case 'data-analyst':
      return {
        brain: 'data-analyst',
        model: MODELS.balanced,
        temperature: 0.3,
        max_tokens: 2048,
        system_suffix: '\nAll statistics must come from real data rows. Never generate or estimate numbers.',
        timeout_ms: 30000,
      };

    case 'skill-router':
      return {
        brain: 'skill-router',
        model: MODELS.balanced,
        temperature: 0.6,
        max_tokens: 3000,
        timeout_ms: 60000,
      };

    case 'claude-api': {
      const claudeKey = process.env.ANTHROPIC_API_KEY;
      if (!claudeKey) {
        // Fallback to deep local model
        return {
          brain: 'qwen-deep',
          model: MODELS.deep,
          temperature: 0.6,
          max_tokens: 4096,
          timeout_ms: 90000,
        };
      }
      return {
        brain: 'claude-api',
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        temperature: 0.5,
        max_tokens: 4096,
        timeout_ms: 60000,
      };
    }

    default:
      return {
        brain: 'qwen-balanced',
        model: MODELS.balanced,
        temperature: 0.5,
        max_tokens: 2048,
        timeout_ms: 30000,
      };
  }
}

// ── Context strategy per domain ────────────────────────────────────────────
export interface ContextStrategy {
  pull_executive_memory: boolean;
  pull_calendar: boolean;
  pull_email: boolean;
  pull_tasks: boolean;
  pull_compliance_db: boolean;
  pull_data_analyst: boolean;
  pull_health: boolean;
  pull_platform_health: boolean;
  search_kb: boolean;
  inject_store_context: boolean;
}

export function getContextStrategy(intent: ClassifiedIntent): ContextStrategy {
  const d = intent.domain;
  return {
    pull_executive_memory: true,  // always
    pull_calendar: ['briefing', 'calendar_view', 'calendar_create'].includes(d),
    pull_email: ['briefing', 'email_read', 'email_send', 'email_draft'].includes(d),
    pull_tasks: ['briefing', 'task_query', 'task_create', 'project_status'].includes(d),
    pull_compliance_db: intent.requires_compliance_db,
    pull_data_analyst: intent.requires_data_analyst,
    pull_health: d === 'health_query',
    pull_platform_health: d === 'briefing',
    search_kb: ['briefing', 'compliance_query', 'labor_law', 'payroll_question', 'chat'].includes(d),
    inject_store_context: !!intent.store || ['compliance_query', 'labor_law', 'payroll_question', 'store_info', 'data_analysis'].includes(d),
  };
}
