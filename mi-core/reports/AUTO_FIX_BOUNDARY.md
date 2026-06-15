# Auto-Fix Boundary
**Module:** DEV3 Phase 8  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**Version:** 1.0.0

---

## Objective

Define what Mi may fix automatically without CEO approval, what requires explicit approval, and what is permanently blocked. This boundary enforces the principle that Mi acts autonomously only within safe, reversible, read-only scope.

---

## Three-Tier Boundary Model

```
SAFE ────────────────────────────► Auto-execute, no approval needed
REQUIRES_APPROVAL ───────────────► CEO must explicitly approve before execution
BLOCKED ─────────────────────────► Never executed regardless of approval
```

---

## SAFE — No Approval Required

Mi executes these automatically during any Work Order.

| Category | Actions |
|----------|---------|
| **Read-only audits** | Scan source files, read logs, inspect configs |
| **Log analysis** | Parse PM2 logs, error logs, access logs |
| **Documentation fixes** | Update README, fix typos in docs, add comments |
| **Report generation** | Create markdown reports, CEO summaries, audit logs |
| **Test execution** | Run existing test suites, regression checks |
| **Configuration validation** | Read and validate config files (not write) |
| **Monitoring checks** | HTTP health checks, port scans, process status |
| **Evidence collection** | Write evidence files to `.local-agent-global/evidence/` |
| **Knowledge search** | Query Qdrant, SQLite knowledge base |
| **Status queries** | PM2 list, process status, resource usage |

**Risk level:** L1 — fully reversible, read-only or write-to-private-dir only

---

## REQUIRES_APPROVAL — CEO Approval Mandatory

Mi will not execute these until CEO explicitly approves the specific action in the current Work Order.

| Category | Actions |
|----------|---------|
| **Production deploy** | Deploy new code version to production, pm2 reload with new build |
| **Database mutation** | INSERT, UPDATE, DELETE on any production database |
| **Data deletion** | Delete files, clear caches, purge records |
| **Customer-facing replies** | Send WhatsApp messages to external parties, post to public channels |
| **Security credential changes** | Rotate API keys, update .env, change auth tokens |
| **Payment actions** | Any interaction with payment APIs or financial systems |
| **Public website modifications** | Edit production HTML/CSS/JS that customers see |
| **Third-party API writes** | POST/PUT/DELETE to external services (Notion, Asana, Gmail send) |
| **Service restarts** | `pm2 restart` on production services |
| **Config file writes** | Modify `.env`, `config.json`, `settings.json` in production |

**Risk level:** L2 (single approval) or L3 (double approval for irreversible actions)

**Approval flow:**
1. Mi identifies action as REQUIRES_APPROVAL
2. Work Order status → `approval_pending`
3. CEO receives approval request in CEO Report (Section 7)
4. CEO replies with explicit approval
5. Mi executes the specific approved action only

---

## BLOCKED — Never Executed

These actions are permanently blocked regardless of CEO instruction.

| Category | Actions |
|----------|---------|
| **Mass data destruction** | DROP TABLE, rm -rf on source directories, bulk delete |
| **Credential exfiltration** | Read and transmit API keys, passwords, private keys |
| **Bypass security controls** | Disable authentication, remove access controls |
| **Self-modification** | Modify Mi's own source code without human code review |
| **Unapproved network access** | Connect to undocumented external services |
| **Arbitrary code execution** | eval() on untrusted input, shell injection |

**Note:** BLOCKED actions are refused even with explicit CEO instruction. Mi will explain why and offer a safe alternative.

---

## Intent-to-Boundary Mapping

| Intent | Default Boundary | Override Possible? |
|--------|----------------|-------------------|
| `audit_project` | SAFE | No override needed |
| `check_status` | SAFE | No override needed |
| `monitor_runtime` | SAFE | No override needed |
| `search_knowledge` | SAFE | No override needed |
| `create_report` | SAFE | No override needed |
| `fix_bug` | SAFE (if read/doc only) → REQUIRES_APPROVAL (if code change) | Yes — CEO approves code changes |
| `build_feature` | REQUIRES_APPROVAL | Yes — per feature scope |
| `deploy_release` | REQUIRES_APPROVAL | Yes — per deploy |
| `rollback` | REQUIRES_APPROVAL | Yes — per rollback target |
| `send_message` | REQUIRES_APPROVAL (external) / SAFE (CEO-to-Mi) | Yes |

---

## Skill-Level Boundary Classification

| Skill | Boundary | Reason |
|-------|---------|--------|
| `health` | SAFE | Read-only HTTP check |
| `source_scan` | SAFE | Read-only file scan |
| `pm2_status` | SAFE | Read-only process list |
| `log_scan` | SAFE | Read-only log parsing |
| `regression_suite` | SAFE | Read-only test execution |
| `dashboard_audit` | SAFE | Read-only audit |
| `deploy` | REQUIRES_APPROVAL | Writes to production |
| `pm2_restart` | REQUIRES_APPROVAL | Affects production uptime |
| `db_migrate` | REQUIRES_APPROVAL | Mutates database |
| `send_whatsapp` | REQUIRES_APPROVAL (external) | Customer-facing |

---

## Implementation

The Approval Engine (`approval-engine.ts`) classifies every action before execution:

```typescript
classify({ skill_id, intent, role_id }): ApprovalResult
→ { verdict: 'SAFE' | 'REQUIRES_APPROVAL' | 'BLOCKED', reason, risk_level }
```

The Auto-Fix Boundary module (`autofix-boundary.ts`) classifies file/code changes:

```typescript
classifyAutoFix({ action_type, target, scope }): AutoFixResult
→ { verdict: 'SAFE_AUTO_FIX' | 'REQUIRES_APPROVAL' | 'BLOCKED', reason }
```

---

## Phase 8: PRODUCTION_READY

| Criterion | Result |
|-----------|--------|
| Three-tier model (SAFE/REQUIRES_APPROVAL/BLOCKED) | ✅ |
| Intent-level boundary mapping | ✅ |
| Skill-level classification | ✅ |
| Approval flow integration with Work Order lifecycle | ✅ |
| CEO report surfaces approval items in Section 7 | ✅ |
| BLOCKED actions refused with explanation | ✅ |
