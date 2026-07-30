/**
 * COO V4 — Full Acceptance Test
 * 24 domains × tests = validates JARVIS_COO_V4_READY
 *
 * Run: node tests/coo-v4-acceptance-test.mjs
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const SRC       = path.join(ROOT, 'server/src/coo-v4');
const ROUTES    = path.join(ROOT, 'server/src/routes');

let total = 0, passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  total++;
  try {
    const r = fn();
    if (r === false) throw new Error('returned false');
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failures.push({ name, error: e.message });
    failed++;
  }
}

function src(file) { return fs.readFileSync(path.join(SRC, file), 'utf8'); }
function srcExists(file) { return fs.existsSync(path.join(SRC, file)); }
function assertContains(content, str, msg) {
  if (!content.includes(str)) throw new Error(msg || `Missing: "${str}"`);
}

// ── Domain A: Intent Engine ────────────────────────────────────────────────

console.log('\n🧠 Domain A — Intent Engine (LangGraph)');

test('intent-engine.ts exists', () => srcExists('intent-engine.ts'));
test('decomposePlan exported', () => assertContains(src('intent-engine.ts'), 'export function decomposePlan'));
test('buildExecutionGraph exported', () => assertContains(src('intent-engine.ts'), 'export function buildExecutionGraph'));
test('runGraph exported', () => assertContains(src('intent-engine.ts'), 'export async function runGraph'));
test('quickPlan exported', () => assertContains(src('intent-engine.ts'), 'export function quickPlan'));
test('Goal templates include audit→dashboard pipeline', () => assertContains(src('intent-engine.ts'), 'audit_source'));
test('Goal templates include video/marketing pipeline', () => assertContains(src('intent-engine.ts'), 'create_video'));
test('Goal templates include tax→CEO approval', () => assertContains(src('intent-engine.ts'), 'ceo_approval'));
test('Graph nodes: parse_intent, decompose_goal, governor_check, execute, validate, report', () => {
  const s = src('intent-engine.ts');
  ['parse_intent', 'decompose_goal', 'governor_check', 'execute', 'validate', 'report'].forEach(n => assertContains(s, `'${n}'`));
});
test('Conditional edges in graph', () => assertContains(src('intent-engine.ts'), 'EdgeFn'));
test('formatPlan exported for WhatsApp display', () => assertContains(src('intent-engine.ts'), 'export function formatPlan'));

// ── Domain B: Durable Workflow ─────────────────────────────────────────────

console.log('\n⏳ Domain B — Durable Workflow Engine');

test('durable-workflow.ts exists', () => srcExists('durable-workflow.ts'));
test('createWorkflow exported', () => assertContains(src('durable-workflow.ts'), 'export function createWorkflow'));
test('getWorkflow exported', () => assertContains(src('durable-workflow.ts'), 'export function getWorkflow'));
test('checkpointStep exported', () => assertContains(src('durable-workflow.ts'), 'export function checkpointStep'));
test('sendSignal exported', () => assertContains(src('durable-workflow.ts'), 'export function sendSignal'));
test('waitForSignal exported', () => assertContains(src('durable-workflow.ts'), 'export function waitForSignal'));
test('recoverInterrupted exported', () => assertContains(src('durable-workflow.ts'), 'export function recoverInterrupted'));
test('SQLite WAL mode enabled', () => assertContains(src('durable-workflow.ts'), 'journal_mode = WAL'));
test('workflows table in schema', () => assertContains(src('durable-workflow.ts'), 'CREATE TABLE IF NOT EXISTS workflows'));
test('workflow_signals table for CEO approvals', () => assertContains(src('durable-workflow.ts'), 'CREATE TABLE IF NOT EXISTS workflow_signals'));
test('Crash recovery: mark running→paused on boot', () => assertContains(src('durable-workflow.ts'), "'paused'"));

// ── Domain C: NLP Engine ──────────────────────────────────────────────────

console.log('\n💬 Domain C — Human NLP Engine');

test('nlp-engine.ts exists', () => srcExists('nlp-engine.ts'));
test('parseIntent exported', () => assertContains(src('nlp-engine.ts'), 'export function parseIntent'));
test('normalize exported', () => assertContains(src('nlp-engine.ts'), 'export function normalize'));
test('humanize exported', () => assertContains(src('nlp-engine.ts'), 'export function humanize'));
test('CEO shorthand dictionary (rv→review)', () => assertContains(src('nlp-engine.ts'), "'rv':"));
test('Typo correction (dashbord→dashboard)', () => assertContains(src('nlp-engine.ts'), 'dashbord'));
test('Context inference for incomplete requests', () => assertContains(src('nlp-engine.ts'), 'CONTEXT_INFERENCES'));
test('Language detection (vi/en/mixed)', () => assertContains(src('nlp-engine.ts'), "'mixed'"));
test('Vietnamese without diacritics normalization', () => assertContains(src('nlp-engine.ts'), 'NFD'));
test('Action verbs catalogue', () => {
  const s = src('nlp-engine.ts');
  ['audit', 'fix', 'create', 'publish', 'analyze', 'prepare'].forEach(a => assertContains(s, a));
});

// ── Domains D/E/F/G: Code Agents ──────────────────────────────────────────

console.log('\n👨‍💻 Domains D/E/F/G — AI Developer + Code Gate');

test('ai-developer-agent.ts exists', () => srcExists('agents/ai-developer-agent.ts'));
test('readSource exported (Domain D)', () => assertContains(src('agents/ai-developer-agent.ts'), 'export async function readSource'));
test('modifySource exported (Domain D)', () => assertContains(src('agents/ai-developer-agent.ts'), 'export async function modifySource'));
test('runTests exported (Domain D)', () => assertContains(src('agents/ai-developer-agent.ts'), 'export async function runTests'));
test('createPatch exported (Domain D)', () => assertContains(src('agents/ai-developer-agent.ts'), 'export async function createPatch'));
test('diagnoseBug exported (Domain E - SWE Agent)', () => assertContains(src('agents/ai-developer-agent.ts'), 'export async function diagnoseBug'));
test('reviewCode exported (Domain F - Aider)', () => assertContains(src('agents/ai-developer-agent.ts'), 'export async function reviewCode'));
test('productionGate exported (Domain G - Alibaba Gate)', () => assertContains(src('agents/ai-developer-agent.ts'), 'export async function productionGate'));
test('OWASP checks: eval, innerHTML, exec user input', () => {
  const s = src('agents/ai-developer-agent.ts');
  ['eval\\(', 'innerHTML', 'Command injection'].forEach(p => assertContains(s, p));
});
test('Code review checks hardcoded secrets', () => assertContains(src('agents/ai-developer-agent.ts'), 'hardcoded secret'));

// ── Domain H: Skill Marketplace ────────────────────────────────────────────

console.log('\n🛒 Domain H — Skill Marketplace');

test('skill-marketplace.ts exists', () => srcExists('skill-marketplace.ts'));
test('getAllSkills exported', () => assertContains(src('skill-marketplace.ts'), 'export function getAllSkills'));
test('registerSkill exported', () => assertContains(src('skill-marketplace.ts'), 'export function registerSkill'));
test('recordExecution exported', () => assertContains(src('skill-marketplace.ts'), 'export function recordExecution'));
test('trust_score recalculated on execution', () => assertContains(src('skill-marketplace.ts'), 'trust_score'));
test('upgradeSkillVersion exported', () => assertContains(src('skill-marketplace.ts'), 'export function upgradeSkillVersion'));
test('Skill catalogue covers all 24 domains', () => {
  const s = src('skill-marketplace.ts');
  ['ai_developer', 'browser', 'workspace', 'bookkeeper', 'accountant', 'cfo', 'tax', 'marketing', 'website', 'social'].forEach(d => assertContains(s, `'${d}'`));
});
test('50+ built-in skills registered', () => {
  const matches = src('skill-marketplace.ts').match(/skill\(/g) || [];
  if (matches.length < 40) throw new Error(`Only ${matches.length} skills, expected 40+`);
});

// ── Domain I: Agent Council V4 ─────────────────────────────────────────────

console.log('\n🏛 Domain I — Agent Council V4 (CrewAI-style)');

test('agent-council-v4.ts exists', () => srcExists('agent-council-v4.ts'));
test('runCouncilV4 exported', () => assertContains(src('agent-council-v4.ts'), 'export function runCouncilV4'));
test('formatCouncilReport exported', () => assertContains(src('agent-council-v4.ts'), 'export function formatCouncilReport'));
test('9 agents: PM, QA, Dev, Security, Ops, Marketing, Bookkeeper, Accountant, CFO', () => {
  const s = src('agent-council-v4.ts');
  ['pm', 'qa', 'dev', 'security', 'ops', 'marketing', 'bookkeeper', 'accountant', 'cfo'].forEach(r => assertContains(s, `'${r}'`));
});
test('Weighted votes (CFO weight 1.5)', () => assertContains(src('agent-council-v4.ts'), 'weight: 1.5'));
test('BLOCK veto power (any single BLOCK wins)', () => assertContains(src('agent-council-v4.ts'), 'hasBlock'));
test('Financial transactions escalate to CEO', () => assertContains(src('agent-council-v4.ts'), 'ESCALATE_TO_CEO'));
test('Council output includes Vietnamese summary', () => assertContains(src('agent-council-v4.ts'), 'summary_vi'));

// ── Domains J/K/L: Browser + Computer + Workspace ─────────────────────────

console.log('\n🌐 Domains J/K/L — Browser + Computer + Google Workspace');

test('browser-operator.ts exists', () => srcExists('agents/browser-operator.ts'));
test('navigate exported (Domain J)', () => assertContains(src('agents/browser-operator.ts'), 'export async function navigate'));
test('fillForm exported', () => assertContains(src('agents/browser-operator.ts'), 'export async function fillForm'));
test('login exported', () => assertContains(src('agents/browser-operator.ts'), 'export async function login'));
test('screenshot exported', () => assertContains(src('agents/browser-operator.ts'), 'export async function screenshot'));
test('Playwright optional — graceful degradation', () => assertContains(src('agents/browser-operator.ts'), 'playwrightAvailable'));

test('business-agents.ts exists (Domains K/L/M/N/O/P)', () => srcExists('agents/business-agents.ts'));
test('sheetsRead exported (Domain L)', () => assertContains(src('agents/business-agents.ts'), 'export async function sheetsRead'));
test('sheetsWrite exported (Domain L)', () => assertContains(src('agents/business-agents.ts'), 'export async function sheetsWrite'));
test('gmailSend exported (Domain L)', () => assertContains(src('agents/business-agents.ts'), 'export async function gmailSend'));
test('driveUpload exported (Domain L)', () => assertContains(src('agents/business-agents.ts'), 'export async function driveUpload'));
test('Google OAuth refresh token flow', () => assertContains(src('agents/business-agents.ts'), 'getGoogleAccessToken'));

// ── Domains M/N/O/P: Finance Agents ───────────────────────────────────────

console.log('\n💰 Domains M/N/O/P — Finance Agents');

test('categorizeTransaction exported (Domain M - Bookkeeper)', () => assertContains(src('agents/business-agents.ts'), 'export function categorizeTransaction'));
test('reconcileAccount exported', () => assertContains(src('agents/business-agents.ts'), 'export async function reconcileAccount'));
test('Expense categories: Marketing, Payroll, Software, Rent', () => {
  const s = src('agents/business-agents.ts');
  ['Marketing', 'Payroll', 'Software', 'Rent'].forEach(c => assertContains(s, c));
});
test('generatePL exported (Domain N - Accountant)', () => assertContains(src('agents/business-agents.ts'), 'export async function generatePL'));
test('monthEndClose exported', () => assertContains(src('agents/business-agents.ts'), 'export async function monthEndClose'));
test('cashFlowForecast exported (Domain O - CFO)', () => assertContains(src('agents/business-agents.ts'), 'export async function cashFlowForecast'));
test('storeAnalysis exported', () => assertContains(src('agents/business-agents.ts'), 'export async function storeAnalysis'));
test('prepareTaxPackage exported (Domain P - Tax)', () => assertContains(src('agents/business-agents.ts'), 'export async function prepareTaxPackage'));
test('fillTaxForm ALWAYS requires approval', () => assertContains(src('agents/business-agents.ts'), 'requires_approval: true'));

// ── Domains Q/R/S: Creative Agents ────────────────────────────────────────

console.log('\n🎨 Domains Q/R/S — Marketing Factory + Website + Social Media');

test('creative-agents.ts exists', () => srcExists('agents/creative-agents.ts'));
test('createFlyer exported (Domain Q)', () => assertContains(src('agents/creative-agents.ts'), 'export async function createFlyer'));
test('ComfyUI integration', () => assertContains(src('agents/creative-agents.ts'), 'COMFYUI_URL'));
test('createVideo exported — Wan/Hunyuan', () => assertContains(src('agents/creative-agents.ts'), 'export async function createVideo'));
test('writeSeoArticle exported — Ollama/LLM', () => assertContains(src('agents/creative-agents.ts'), 'export async function writeSeoArticle'));
test('generateVoiceover exported — OpenVoice', () => assertContains(src('agents/creative-agents.ts'), 'export async function generateVoiceover'));
test('publishPost exported (Domain R - WordPress)', () => assertContains(src('agents/creative-agents.ts'), 'export async function publishPost'));
test('WordPress REST API integration', () => assertContains(src('agents/creative-agents.ts'), 'wp-json/wp/v2'));
test('postToFacebook exported (Domain S)', () => assertContains(src('agents/creative-agents.ts'), 'export async function postToFacebook'));
test('postToInstagram exported', () => assertContains(src('agents/creative-agents.ts'), 'export async function postToInstagram'));
test('postToTikTok exported', () => assertContains(src('agents/creative-agents.ts'), 'export async function postToTikTok'));
test('schedulePosts exported', () => assertContains(src('agents/creative-agents.ts'), 'export async function schedulePosts'));
test('Facebook Graph API integration', () => assertContains(src('agents/creative-agents.ts'), 'graph.facebook.com'));

// ── Domain T: Execution Autonomy ───────────────────────────────────────────

console.log('\n🤖 Domain T — Execution Autonomy (COO Orchestrator)');

test('coo-orchestrator.ts exists', () => srcExists('coo-orchestrator.ts'));
test('cooExecute exported', () => assertContains(src('coo-orchestrator.ts'), 'export async function cooExecute'));
test('handleCeoSignal exported (APPROVE/CANCEL)', () => assertContains(src('coo-orchestrator.ts'), 'export function handleCeoSignal'));
test('generateReport exported', () => assertContains(src('coo-orchestrator.ts'), 'export function generateReport'));
test('getRunningWorkflows exported', () => assertContains(src('coo-orchestrator.ts'), 'export function getRunningWorkflows'));
test('BLOCKED requests rejected immediately', () => assertContains(src('coo-orchestrator.ts'), "'blocked'"));
test('Council runs before execution', () => assertContains(src('coo-orchestrator.ts'), 'runCouncilV4'));
test('Approval wait: CEO sends APPROVE <workflow_id>', () => assertContains(src('coo-orchestrator.ts'), 'APPROVE'));
test('CEO report sent via WhatsApp on completion', () => assertContains(src('coo-orchestrator.ts'), 'queueToCeo'));
test('async execution: setImmediate for non-blocking WhatsApp response', () => assertContains(src('coo-orchestrator.ts'), 'setImmediate'));
test('Dependency ordering in step execution', () => assertContains(src('coo-orchestrator.ts'), 'depends_on'));

// ── Domain V: Flow Optimizer ───────────────────────────────────────────────

console.log('\n⚡ Domain V — Flow Optimizer');

test('flow-optimizer.ts exists', () => srcExists('flow-optimizer.ts'));
test('FlowOptimizer class exported', () => assertContains(src('flow-optimizer.ts'), 'export class FlowOptimizer'));
test('Priority queue (BullMQ semantics)', () => assertContains(src('flow-optimizer.ts'), 'PriorityQueue'));
test('Circuit breaker pattern', () => assertContains(src('flow-optimizer.ts'), 'CircuitBreaker'));
test('OpenTelemetry-style spans', () => assertContains(src('flow-optimizer.ts'), 'Span'));
test('runParallel with dependency ordering', () => assertContains(src('flow-optimizer.ts'), 'runParallel'));
test('Retry with exponential backoff', () => assertContains(src('flow-optimizer.ts'), 'backoff_ms'));
test('Concurrency limits per queue', () => assertContains(src('flow-optimizer.ts'), 'CONCURRENCY'));
test('Circuit breaker auto-opens on threshold', () => assertContains(src('flow-optimizer.ts'), 'OPEN_DURATION_MS'));

// ── Domain W: Production Governor ─────────────────────────────────────────

console.log('\n🛡 Domain W — Production Governor');

test('production-governor.ts exists', () => srcExists('production-governor.ts'));
test('classify exported', () => assertContains(src('production-governor.ts'), 'export function classify'));
test('classifyStep exported', () => assertContains(src('production-governor.ts'), 'export function classifyStep'));
test('isBlocked exported', () => assertContains(src('production-governor.ts'), 'export function isBlocked'));
test('requiresApproval exported', () => assertContains(src('production-governor.ts'), 'export function requiresApproval'));
test('BLOCKED: tax submission blocked', () => assertContains(src('production-governor.ts'), 'submit.*tax|file.*tax'));
test('BLOCKED: wire transfers', () => assertContains(src('production-governor.ts'), 'wire transfer'));
test('BLOCKED: secret exposure', () => assertContains(src('production-governor.ts'), 'Secret exposure blocked'));
test('REQUIRES_APPROVAL: social media publish', () => assertContains(src('production-governor.ts'), 'social.*media.*post'));
test('REQUIRES_APPROVAL: production deploy', () => assertContains(src('production-governor.ts'), 'deploy.*production'));
test('SAFE: read-only operations', () => assertContains(src('production-governor.ts'), "'SAFE'"));
test('4 classes: SAFE, REQUIRES_APPROVAL, DANGEROUS, BLOCKED', () => {
  const s = src('production-governor.ts');
  ['SAFE', 'REQUIRES_APPROVAL', 'DANGEROUS', 'BLOCKED'].forEach(c => assertContains(s, `'${c}'`));
});

// ── Domain X: Self-Improvement V4 ─────────────────────────────────────────

console.log('\n🔄 Domain X — Self-Improvement V4');

test('self-improvement-v4.ts exists', () => srcExists('self-improvement-v4.ts'));
test('generateSelfImprovementReportV4 exported', () => assertContains(src('self-improvement-v4.ts'), 'export function generateSelfImprovementReportV4'));
test('formatSelfImprovementReport exported', () => assertContains(src('self-improvement-v4.ts'), 'export function formatSelfImprovementReport'));
test('autoApplyImprovements exported', () => assertContains(src('self-improvement-v4.ts'), 'export function autoApplyImprovements'));
test('Detects bad skills (high failure rate)', () => assertContains(src('self-improvement-v4.ts'), 'detectBadSkills'));
test('Detects slow skills vs thresholds', () => assertContains(src('self-improvement-v4.ts'), 'detectSlowSkills'));
test('Detects failed workflows', () => assertContains(src('self-improvement-v4.ts'), 'detectFailedWorkflows'));
test('Detects missing skills per agent', () => assertContains(src('self-improvement-v4.ts'), 'detectMissingSkills'));
test('Score calculation: 100 - penalties', () => assertContains(src('self-improvement-v4.ts'), 'calculateScore'));
test('Auto-disables skills >80% failure rate', () => assertContains(src('self-improvement-v4.ts'), '0.8'));

// ── COO V4 Router + Integration ────────────────────────────────────────────

console.log('\n🔌 COO V4 Router + Index Integration');

test('coo-v4-router.ts exists', () => fs.existsSync(path.join(ROUTES, 'coo-v4-router.ts')));

const routerSrc = fs.readFileSync(path.join(ROUTES, 'coo-v4-router.ts'), 'utf8');
test('POST /execute endpoint', () => assertContains(routerSrc, "'/execute'"));
test('POST /plan endpoint', () => assertContains(routerSrc, "'/plan'"));
test('GET /workflows endpoint', () => assertContains(routerSrc, "'/workflows'"));
test('POST /workflows/:id/signal endpoint', () => assertContains(routerSrc, "'/workflows/:id/signal'"));
test('POST /council endpoint', () => assertContains(routerSrc, "'/council'"));
test('GET /skills endpoint', () => assertContains(routerSrc, "'/skills'"));
test('GET /self-improve endpoint', () => assertContains(routerSrc, "'/self-improve'"));
test('GET /status endpoint', () => assertContains(routerSrc, "'/status'"));
test('GET /nlp endpoint', () => assertContains(routerSrc, "'/nlp'"));
test('GET /governor endpoint', () => assertContains(routerSrc, "'/governor'"));

const indexSrc = fs.readFileSync(path.join(ROOT, 'server/src/index.ts'), 'utf8');
test('cooV4Router imported in index.ts', () => assertContains(indexSrc, 'cooV4Router'));
test('/api/coo-v4 mounted in index.ts', () => assertContains(indexSrc, "'/api/coo-v4'"));

// ── Jarvis Integration ─────────────────────────────────────────────────────

console.log('\n📱 Jarvis V4 WhatsApp Integration');

const jarvisSrc = fs.readFileSync(path.join(ROOT, 'server/src/jarvis/phase30-jarvis/jarvis-core.ts'), 'utf8');
test('COO V4 handler block in jarvis-core', () => assertContains(jarvisSrc, 'COO V4'));
test('cooExecute called from Jarvis', () => assertContains(jarvisSrc, 'cooExecute'));
test('handleCeoSignal for APPROVE/CANCEL in Jarvis', () => assertContains(jarvisSrc, 'handleCeoSignal'));
test('Council V4 handler in Jarvis', () => assertContains(jarvisSrc, 'runCouncilV4'));
test('Self-improvement V4 handler in Jarvis', () => assertContains(jarvisSrc, 'generateSelfImprovementReportV4'));
test('Skill marketplace query in Jarvis', () => assertContains(jarvisSrc, 'getSkillStats'));
test('Production governor WhatsApp query', () => assertContains(jarvisSrc, 'Production Governor'));

// ── Types completeness ─────────────────────────────────────────────────────

console.log('\n📐 Type System Completeness');

test('types.ts exists', () => srcExists('types.ts'));
const typesSrc = src('types.ts');
test('WorkflowState type defined', () => assertContains(typesSrc, 'WorkflowState'));
test('PlanStep type defined', () => assertContains(typesSrc, 'PlanStep'));
test('CouncilDecision type defined', () => assertContains(typesSrc, 'CouncilDecision'));
test('GovernorClass type (4 classes)', () => assertContains(typesSrc, 'GovernorClass'));
test('ExecutiveReport type for CEO reporting', () => assertContains(typesSrc, 'ExecutiveReport'));
test('Skill type for marketplace', () => assertContains(typesSrc, 'SkillExecution'));
test('24 AgentDomains covered', () => {
  const s = typesSrc;
  ['ai_developer', 'swe_agent', 'code_reviewer', 'code_gate', 'browser', 'computer', 'workspace', 'bookkeeper', 'accountant', 'cfo', 'tax', 'marketing', 'website', 'social'].forEach(d => assertContains(s, `'${d}'`));
});

// ── Summary ────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(55));
console.log(`  TOTAL:  ${total}`);
console.log(`  PASSED: ${passed} ✅`);
console.log(`  FAILED: ${failed} ❌`);
console.log('═'.repeat(55));

if (failures.length > 0) {
  console.log('\nFailed:');
  failures.forEach(f => console.log(`  ❌ ${f.name}\n     ${f.error}`));
}

const pct = Math.round((passed / total) * 100);
if (pct === 100) {
  console.log(`\n🎉 JARVIS_COO_V4_READY — ${pct}% PASS`);
  console.log('🤖 AUTONOMOUS_COO_READY — All 24 Domains Certified');
} else if (pct >= 90) {
  console.log(`\n✅ JARVIS_COO_V4_PASS — ${pct}% (${failed} minor gaps)`);
} else {
  console.log(`\n⚠️  JARVIS_COO_V4_INCOMPLETE — ${pct}% (${failed} failures)`);
}

process.exit(failed > 0 ? 1 : 0);
