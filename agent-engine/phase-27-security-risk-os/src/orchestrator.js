/**
 * Phase 27 — Security / Compliance / Risk OS.
 * OSS: Keycloak (TCP 8443). Access revocation + secret rotation always approval-gated.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class AccessControlEngine {
  constructor(opts) { this.store = new JsonStore('sec-access', opts); }
  grant({ subject, role, resource, division }) {
    return this.store.insert({ id: makeId('ACC'), timestamp: Date.now(), subject, role, resource, division, status: 'granted' });
  }
  revoke(subject, role, reason) {
    const rec = this.store.find((r) => r.subject === subject && r.role === role && r.status === 'granted');
    if (rec) this.store.update(rec.id, { status: 'revoked', revokedAt: Date.now(), revokeReason: reason });
    return rec;
  }
  all() { return this.store.all(); }
  active() { return this.store.filter((r) => r.status === 'granted'); }
}

export class SecretRiskEngine {
  constructor(opts) { this.store = new JsonStore('sec-secrets', opts); }
  scan(content, source = 'unknown') {
    const PATTERNS = [
      { p: /sk_live_|pk_live_|AIza[g0-9A-Z_-]{35}/g, label: 'api_key' },
      { p: /password\s*=\s*['"][^'"]{4,}['"]/gi, label: 'password_hardcoded' },
      { p: /bearer\s+[A-Za-z0-9_-]{20,}/gi, label: 'bearer_token' },
      { p: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g, label: 'private_key' },
    ];
    const found = PATTERNS.filter((pt) => (content || '').match(pt.p));
    const level = found.length > 1 ? 'CRITICAL' : found.length === 1 ? 'HIGH' : 'LOW';
    const rec = { id: makeId('SEC'), timestamp: Date.now(), source, found: found.map((f) => f.label), count: found.length, level, status: level !== 'LOW' ? 'flagged' : 'clear' };
    this.store.insert(rec);
    return rec;
  }
  all() { return this.store.all(); }
  flagged() { return this.store.filter((r) => r.status === 'flagged'); }
}

export class AuditLogEngine {
  constructor(opts) { this.store = new JsonStore('sec-audit', opts); }
  log(action) { return this.store.insert({ id: makeId('LOG'), timestamp: Date.now(), ...action }); }
  query({ actor, resource, division }) {
    return this.store.filter((r) => {
      if (actor && r.actor !== actor) return false;
      if (resource && r.resource !== resource) return false;
      if (division && r.division !== division) return false;
      return true;
    });
  }
  all() { return this.store.all(); }
}

export class PolicyViolationEngine {
  constructor(opts) { this.store = new JsonStore('sec-violations', opts); }
  flag(v) {
    const rec = { id: makeId('VIOL'), timestamp: Date.now(), owner: v.owner || 'unknown', division: v.division, policy: v.policy, detail: v.detail, level: v.level, status: 'open', requiresRemediation: v.level === 'HIGH' || v.level === 'CRITICAL' };
    this.store.insert(rec);
    return rec;
  }
  all() { return this.store.all(); }
  open() { return this.store.filter((r) => r.status === 'open'); }
}

export class RiskRegister {
  constructor(opts) { this.store = new JsonStore('sec-risk-register', opts); }
  register(risk) { return this.store.insert({ id: makeId('RISK'), timestamp: Date.now(), title: risk.title, category: risk.category, likelihood: risk.likelihood, impact: risk.impact, level: risk.level, owner: risk.owner, division: risk.division, status: risk.status || 'open', mitigations: [] }); }
  addMitigation(riskId, m) { const r = this.store.find((x) => x.id === riskId); if (r) { r.mitigations.push(m); this.store.update(r.id, { mitigations: r.mitigations }); } return r; }
  all() { return this.store.all(); }
}

export class ComplianceScorecard {
  dashboard(access, secrets, violations) {
    const activeAccess = (access || []).filter((a) => a.status === 'granted').length;
    const secretRisks = (secrets || []).filter((s) => s.status === 'flagged').length;
    const openViolations = (violations || []).filter((v) => v.status === 'open').length;
    const status = secretRisks > 0 ? 'AT_RISK' : openViolations > 2 ? 'WATCH' : 'HEALTHY';
    return { status, activeAccess, secretRisks, openViolations, lastAudit: new Date().toISOString() };
  }
}

export class SecurityRiskOS {
  constructor(opts = {}) {
    this.access = new AccessControlEngine(opts);
    this.secrets = new SecretRiskEngine(opts);
    this.audit = new AuditLogEngine(opts);
    this.violations = new PolicyViolationEngine(opts);
    this.risks = new RiskRegister(opts);
    this.scorecard = new ComplianceScorecard();
  }

  handleSecurityEvent(event) {
    const { type, source, actor, detail } = event;
    this.audit.log({ type, source, actor, detail, division: event.division });
    if (type === 'secret_detected') {
      const scan = this.secrets.scan(detail, source);
      if (scan.level !== 'LOW') {
        const violation = this.violations.flag({ owner: actor || 'unknown', division: event.division || 'it', policy: 'no-exposed-secrets', detail: source + ': secret found (' + scan.found.join(', ') + ')', level: scan.level });
        const task = { title: 'Remediate secret in ' + source, division: event.division || 'it', owner: actor || 'it-admin', status: 'pending_approval', approvalRequired: true, details: scan, violationId: violation.id };
        return { scan, violation, task, remediationRequired: true };
      }
      return { scan, remediationRequired: false };
    }
    if (type === 'unauthorized_access') {
      const violation = this.violations.flag({ owner: actor, division: event.division, policy: 'least-privilege-access', detail, level: 'HIGH' });
      const task = { title: 'Investigate unauthorized access: ' + actor, division: event.division, owner: 'it-admin', status: 'pending_approval', approvalRequired: true, violationId: violation.id };
      return { violation, task, remediationRequired: true };
    }
    return { remediationRequired: false };
  }

  dashboard() {
    const s = this.scorecard.dashboard(this.access.all(), this.secrets.all(), this.violations.all());
    return { ...s, openViolations: this.violations.open().length, riskCount: this.risks.all().length };
  }
}

export default SecurityRiskOS;