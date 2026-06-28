/**
 * runtime-proof.mjs — Phase 27 Security / Compliance / Risk OS.
 * Scenario: secret detected / unauthorized access -> risk task -> owner assignment -> remediation plan.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import SecurityRiskOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase27-'));
const sec = new SecurityRiskOS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  ✅ ' + n); } catch (e) { failed++; console.error('  ❌ ' + n + ' — ' + e.message); } };
console.log('PHASE 27 — SECURITY / COMPLIANCE / RISK OS :: RUNTIME PROOF\n');

// Grant access
sec.access.grant({ subject: 'alex@rawsushi.com', role: 'editor', resource: 'doordash-agent', division: 'operations' });
check('access grant recorded', () => assert.strictEqual(sec.access.active().length, 1));

// Secret detected in a config file
const ev1 = sec.handleSecurityEvent({ type: 'secret_detected', source: 'config/.env', actor: 'ci-bot', detail: 'sk_live_51abc...XYZ sk_live_52def...AAA', division: 'it' });
check('secret scan flags HIGH (2 API keys)', () => assert.strictEqual(ev1.scan.level, 'HIGH'));
check('violation created on HIGH risk secret', () => assert.ok(ev1.violation !== undefined && ev1.violation.level === 'HIGH'));
check('remediation task created', () => assert.ok(ev1.task !== undefined));
check('task is approval-gated (secret rotation never auto)', () => assert.strictEqual(ev1.task.approvalRequired, true));
check('task routed to it division', () => assert.strictEqual(ev1.task.division, 'it'));
check('task owner assigned', () => assert.ok(ev1.task.owner && ev1.task.owner.length > 0));

// Unauthorized access event
const ev2 = sec.handleSecurityEvent({ type: 'unauthorized_access', source: 'admin-panel', actor: 'former-employee@bakudan.com', detail: 'attempted login to CFO dashboard after termination', division: 'finance' });
check('violation created on unauthorized access', () => assert.ok(ev2.violation !== undefined));
check('task created on unauthorized access', () => assert.ok(ev2.task !== undefined));
check('unauthorized access task approval-gated', () => assert.strictEqual(ev2.task.approvalRequired, true));

// Audit log captures both events
const audit = sec.audit.all();
check('audit log records both security events', () => assert.ok(audit.length >= 2));
const unauthorizedAudit = sec.audit.query({ actor: 'former-employee@bakudan.com' });
check('audit log queryable by actor', () => assert.ok(unauthorizedAudit.length >= 1));

// Clean content is LOW risk (no task, no violation)
const ev3 = sec.handleSecurityEvent({ type: 'secret_detected', source: 'README.md', actor: 'dev', detail: 'This project uses environment variables for configuration.', division: 'it' });
check('clean content -> no violation', () => assert.strictEqual(ev3.remediationRequired, false));

// Risk register
const risk = sec.risks.register({ title: 'Insider threat: terminated employee', category: 'access', likelihood: 'medium', impact: 'high', level: 'HIGH', owner: 'it-admin', division: 'it' });
check('risk registered', () => assert.ok(risk.id && risk.level === 'HIGH'));
sec.risks.addMitigation(risk.id, 'Revoke credentials immediately; audit logs for 30 days');
check('mitigation added to risk', () => assert.ok(sec.risks.all()[0].mitigations.length >= 1));

const dash = sec.dashboard();
check('dashboard status AT_RISK (secret risk present)', () => assert.strictEqual(dash.status, 'AT_RISK'));
check('dashboard counts open violations', () => assert.ok(dash.openViolations >= 2));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);