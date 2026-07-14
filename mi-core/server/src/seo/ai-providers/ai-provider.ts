/**
 * SEO Control Center — AI provider abstraction (spec §3).
 *
 * The CEO explicitly does NOT want to route content generation through the
 * OpenAI API. Instead, content generation happens through one of:
 *   - ChatGPTBrowserProvider — browser-automated ChatGPT session using the
 *     CEO's own logged-in browser account (PRIMARY / default provider)
 *   - ManualPasteProvider    — CEO pastes the ChatGPT answer by hand via the
 *     dashboard (fallback when the browser session can't run)
 *   - LocalModelProvider     — thin wrapper around providerRouter's Ollama
 *     path, for low-risk classification/QA tasks only (never primary content)
 *
 * All three implement this shared interface so `ai-router.ts` can dispatch
 * to any of them without callers caring which one actually ran.
 */

export interface AIProviderRequest {
  task_id: string;
  brand_id: string;
  location_id?: string;
  article_id?: string;
  /** e.g. 'article-generation', 'keyword-research' — matches a prompt template name */
  template: string;
  prompt: string;
  idempotency_key: string;
}

export type AIProviderStatus = 'completed' | 'failed' | 'waiting_for_login' | 'waiting_for_manual_paste';

export type AIProviderHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'BLOCKED_CREDENTIALS'
  | 'BLOCKED_LOGIN'
  | 'FAILED_NETWORK'
  | 'FAILED_TIMEOUT'
  | 'FAILED_SCHEMA'
  | 'FALLBACK_ACTIVE';

export interface AIProviderResult {
  status: AIProviderStatus;
  raw_response?: string;
  error?: string;
}

export interface AIProvider {
  name: string;
  submit(req: AIProviderRequest): Promise<AIProviderResult>;
}
