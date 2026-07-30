/**
 * Mi Company OS — Brain Registry
 * Maps every department to the correct brain config.
 * Phase 1: Full spec — primary + fallback, safety policy, allowed tools, evidence required.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface DeptBrainAssignment {
  dept_id: string;
  brain_name: string;
  model: string;
  fallback_model: string;
  temperature: number;
  max_tokens: number;
  max_latency_ms: number;
  system_prompt: string;
  timeout_ms: number;
  safety_policy: 'FULL_AUTO' | 'REQUIRES_APPROVAL' | 'BLOCKED';
  allowed_tools: string[];
  evidence_required: boolean;
}

const DEPT_BRAIN_MAP: Record<string, DeptBrainAssignment> = {
  'dispatch': {
    dept_id: 'dispatch',
    brain_name: 'qwen-deep',
    model: process.env.OLLAMA_DEEP_MODEL || 'qwen3:14b',
    fallback_model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    temperature: 0.4,
    max_tokens: 2048,
    max_latency_ms: 60_000,
    system_prompt: 'You are Mi, the dispatch center. Classify CEO commands into intents and assign to departments. Be concise.',
    timeout_ms: 60_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['dept-definitions', 'pipeline-history'],
    evidence_required: true,
  },
  'executive-assistant': {
    dept_id: 'executive-assistant',
    brain_name: 'qwen-balanced',
    model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    fallback_model: 'qwen3:14b',
    temperature: 0.4,
    max_tokens: 512,
    max_latency_ms: 90_000,
    system_prompt: 'You are the Executive Assistant for CEO Liem Do. Summarize tasks and priorities in 3-5 bullet points. Be concise. Vietnamese OK.',
    timeout_ms: 90_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['task-snapshot', 'task-today', 'task-approvals', 'health-intel', 'gmail', 'calendar'],
    evidence_required: true,
  },
  'report-center': {
    dept_id: 'report-center',
    brain_name: 'qwen-balanced',
    model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    fallback_model: 'qwen3:14b',
    temperature: 0.3,
    max_tokens: 512,
    max_latency_ms: 90_000,
    system_prompt: 'You are the Report Center. Produce CEO-level summaries. Never include UUIDs, stack traces, internal IDs. Include: what was done, result, blockers.',
    timeout_ms: 90_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['briefing-latest', 'visibility-dashboard', 'agenview-snapshot', 'strategic-memory', 'pipeline-history'],
    evidence_required: true,
  },
  'library': {
    dept_id: 'library',
    brain_name: 'qwen-balanced',
    model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    fallback_model: 'qwen3:14b',
    temperature: 0.3,
    max_tokens: 512,
    max_latency_ms: 60_000,
    system_prompt: 'You are the Library. Search SOPs, policies, and documents. Return relevant excerpts and source names.',
    timeout_ms: 60_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['dept-definitions', 'source-inventory-reader', 'rag-search', 'document-search'],
    evidence_required: false,
  },
  'qa': {
    dept_id: 'qa',
    brain_name: 'gemma-qa',
    model: process.env.OLLAMA_QA_MODEL || 'gemma3:12b',
    fallback_model: 'qwen3:14b',
    temperature: 0.1,
    max_tokens: 256,
    max_latency_ms: 90_000,
    system_prompt: 'You are QA. Verdict: PASS or FAIL only. One sentence reason. No provisional. No READY. No DESIGNED.',
    timeout_ms: 90_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['evidence-reader', 'pipeline-history'],
    evidence_required: true,
  },
  'finance': {
    dept_id: 'finance',
    brain_name: 'qwen-deep',
    model: process.env.OLLAMA_DEEP_MODEL || 'qwen3:14b',
    fallback_model: 'qwen3:8b',
    temperature: 0.2,
    max_tokens: 512,
    max_latency_ms: 120_000,
    system_prompt: 'You are the Finance department. Analyze P&L, cash flow, expenses. State data source and confidence. Never guess numbers.',
    timeout_ms: 120_000,
    safety_policy: 'REQUIRES_APPROVAL',
    allowed_tools: ['visibility-dashboard', 'strategic-memory', 'quickbooks', 'toast-pos', 'accounting-engine', 'pdf-evidence'],
    evidence_required: true,
  },
  'tax-compliance': {
    dept_id: 'tax-compliance',
    brain_name: 'qwen-deep',
    model: process.env.OLLAMA_DEEP_MODEL || 'qwen3:14b',
    fallback_model: 'qwen3:8b',
    temperature: 0.1,
    max_tokens: 512,
    max_latency_ms: 120_000,
    system_prompt: 'You are Tax & Compliance. Review tax obligations, deadlines, and evidence. Never guess tax amounts. Always cite source.',
    timeout_ms: 120_000,
    safety_policy: 'REQUIRES_APPROVAL',
    allowed_tools: ['quickbooks', 'pdf-evidence', 'accounting-engine'],
    evidence_required: true,
  },
  'restaurant-intelligence': {
    dept_id: 'restaurant-intelligence',
    brain_name: 'qwen-balanced',
    model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    fallback_model: 'qwen3:14b',
    temperature: 0.3,
    max_tokens: 512,
    max_latency_ms: 90_000,
    system_prompt: 'You are Restaurant Intelligence. Summarize Toast POS, DoorDash, food-safety data for CEO Liem Do. Be concise.',
    timeout_ms: 90_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['visibility-dashboard', 'toast-pos', 'doordash', 'food-safety'],
    evidence_required: true,
  },
  'engineering': {
    dept_id: 'engineering',
    brain_name: 'qwen-coder',
    model: process.env.OLLAMA_CODER_MODEL || 'qwen2.5-coder:7b',
    fallback_model: 'qwen3:14b',
    temperature: 0.2,
    max_tokens: 1024,
    max_latency_ms: 120_000,
    system_prompt: 'You are Engineering. Review code, identify bugs, suggest fixes. Be precise.',
    timeout_ms: 120_000,
    safety_policy: 'REQUIRES_APPROVAL',
    allowed_tools: ['pipeline-history', 'evidence-reader', 'git', 'build', 'test', 'deploy-preview', 'logs'],
    evidence_required: true,
  },
  'infrastructure': {
    dept_id: 'infrastructure',
    brain_name: 'qwen-balanced',
    model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    fallback_model: 'qwen3:14b',
    temperature: 0.2,
    max_tokens: 512,
    max_latency_ms: 90_000,
    system_prompt: 'You are Infrastructure. Diagnose service outages. Check: PM2 status, Docker, ports, logs. Return: what is down, why, how to fix.',
    timeout_ms: 90_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['pm2-status', 'node-registry', 'visibility-dashboard', 'docker', 'ports', 'tailscale', 'health-checks'],
    evidence_required: true,
  },
  'marketing': {
    dept_id: 'marketing',
    brain_name: 'qwen-balanced',
    model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    fallback_model: 'qwen3:14b',
    temperature: 0.6,
    max_tokens: 512,
    max_latency_ms: 90_000,
    system_prompt: 'You are Marketing. Plan campaigns, write ad copy for Bakudan Ramen and Raw Sushi. Be creative and concise.',
    timeout_ms: 90_000,
    safety_policy: 'REQUIRES_APPROVAL',
    allowed_tools: ['strategic-memory', 'visibility-dashboard', 'doordash', 'review-system'],
    evidence_required: true,
  },
  'brand-creative': {
    dept_id: 'brand-creative',
    brain_name: 'gemma-qa',
    model: process.env.OLLAMA_QA_MODEL || 'gemma3:12b',
    fallback_model: 'qwen3:8b',
    temperature: 0.7,
    max_tokens: 512,
    max_latency_ms: 90_000,
    system_prompt: 'You are Brand & Creative. Generate creative briefs for restaurant social media. Be specific and visual.',
    timeout_ms: 90_000,
    safety_policy: 'REQUIRES_APPROVAL',
    allowed_tools: ['strategic-memory', 'comfyui', 'flux', 'restaurant-creative-engine'],
    evidence_required: true,
  },
  'technical-operations': {
    dept_id: 'technical-operations',
    brain_name: 'qwen-balanced',
    model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
    fallback_model: 'qwen3:14b',
    temperature: 0.2,
    max_tokens: 512,
    max_latency_ms: 90_000,
    system_prompt: 'You are Technical Operations. Summarize PM2 status, service health for CEO. List: OK services, DOWN services, action needed.',
    timeout_ms: 90_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['pm2-status', 'node-registry', 'visibility-dashboard', 'health-checks'],
    evidence_required: true,
  },
  'rd': {
    dept_id: 'rd',
    brain_name: 'qwen-deep',
    model: process.env.OLLAMA_DEEP_MODEL || 'qwen3:14b',
    fallback_model: 'qwen3:8b',
    temperature: 0.5,
    max_tokens: 1024,
    max_latency_ms: 180_000,
    system_prompt: 'You are Research & Development. Evaluate technologies, write specs, propose solutions. Think deeply before answering.',
    timeout_ms: 180_000,
    safety_policy: 'FULL_AUTO',
    allowed_tools: ['source-inventory-reader', 'dept-definitions', 'strategic-memory', 'rag-search'],
    evidence_required: true,
  },
};

const DEFAULT_BRAIN: DeptBrainAssignment = {
  dept_id: 'default',
  brain_name: 'qwen-balanced',
  model: process.env.OLLAMA_FAST_MODEL || 'qwen3:8b',
  fallback_model: 'qwen3:14b',
  temperature: 0.5,
  max_tokens: 512,
  max_latency_ms: 90_000,
  system_prompt: 'You are Mi, an intelligent executive assistant. Answer clearly and concisely.',
  timeout_ms: 90_000,
  safety_policy: 'FULL_AUTO',
  allowed_tools: [],
  evidence_required: false,
};

export function getBrainForDept(deptId: string): DeptBrainAssignment {
  return DEPT_BRAIN_MAP[deptId] || { ...DEFAULT_BRAIN, dept_id: deptId };
}

export function listBrainAssignments(): DeptBrainAssignment[] {
  return Object.values(DEPT_BRAIN_MAP);
}

// ── Ollama inference ──────────────────────────────────────────────────────────

export interface BrainResponse {
  text: string;
  model: string;
  duration_ms: number;
  tokens_used?: number;
  used_fallback?: boolean;
}

export async function callBrain(
  assignment: DeptBrainAssignment,
  userPrompt: string,
  contextData?: string
): Promise<BrainResponse> {
  const start = Date.now();
  const fullPrompt = contextData
    ? `${assignment.system_prompt}\n\n--- Context ---\n${contextData}\n--- End Context ---\n\n${userPrompt}`
    : `${assignment.system_prompt}\n\n${userPrompt}`;

  // Try primary model first, then fallback
  for (const [model, isFallback] of [[assignment.model, false], [assignment.fallback_model, true]] as [string, boolean][]) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), assignment.timeout_ms);
      try {
        const res = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: fullPrompt,
            stream: false,
            options: { temperature: assignment.temperature, num_predict: assignment.max_tokens },
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Ollama ${res.status}`);
        const data = await res.json() as { response: string; eval_count?: number; prompt_eval_count?: number };
        return {
          text: (data.response || '').trim(),
          model,
          duration_ms: Date.now() - start,
          tokens_used: (data.eval_count || 0) + (data.prompt_eval_count || 0),
          used_fallback: isFallback,
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if (!isFallback) continue; // try fallback
      throw err;
    }
  }
  throw new Error('Both primary and fallback models failed');
}

export async function verifyBrain(assignment: DeptBrainAssignment): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json() as { models: Array<{ name: string }> };
    return data.models.some(m => m.name === assignment.model || m.name.startsWith(assignment.model + ':'));
  } catch { return false; }
}
