# Skill Registry — Mi GStack Layer
**Date:** 2026-06-13

---

## Available Skills

The GStack layer routes work to the correct skill based on intent + target_project. Skills are reusable, composable, and stateless.

| Skill | Module | Invoked By | Risk |
|-------|--------|-----------|------|
| **Source Scan** | engineering-manager → execSync dir | qa_agent, engineering_manager | L1 |
| **Health Check** | qa-agent → httpGet all services | qa_agent | L1 |
| **Regression Suite** | qa-agent → processJarvisQuery x10 | qa_agent | L1 |
| **PM2 Status** | engineering-manager → pm2 jlist | engineering_manager | L1 |
| **Error Log Scan** | engineering-manager → tail pm2-err.log | engineering_manager | L1 |
| **Audit Certification** | auditor-agent → evidence rules | auditor_agent | L1 |
| **Build Compile** | qa-agent → tsc --noEmit | qa_agent | L1 |
| **PM2 Restart** | release-agent → pm2 restart | release_agent | L3 ⚠️ |
| **CEO Report** | product-manager → compileCeoReport | product_manager | L1 |
| **Knowledge Search** | jarvis phase21 → searchKnowledge | ceo_interpreter | L1 |
| **WhatsApp Reply** | executive-personality → addMiTurn | personality engine | L1 |
| **Approval Queue** | approval/gate → enqueue | any agent | L2-L3 |

---

## Risk Levels

| Level | Description | Requires Approval |
|-------|-------------|-------------------|
| L1 | Read-only, non-destructive, reversible | No — auto-execute |
| L2 | Write, create, modify | Single CEO confirm |
| L3 | Deploy, delete, financial, external send | Double CEO confirm |

---

## Skill Mapping by Intent

```
audit_project:
  L1: source_scan → health_check → pm2_status → error_log_scan → audit_certification → ceo_report
  
fix_bug:
  L1: source_scan → health_check → pm2_status → regression_suite → audit_certification → ceo_report
  L3: pm2_restart (requires CEO approval)

deploy_release:
  L1: health_check → build_compile → audit_certification
  L3: pm2_restart (requires CEO approval)

check_status:
  L1: health_check → pm2_status → ceo_report

build_feature:
  L1: knowledge_search (scope) → ceo_report (draft)
  L2: code_write (requires CEO review)
```

---

## Future Skills (Planned)

| Skill | Status |
|-------|--------|
| GitHub PR create | Planned |
| Gmail draft + send | Planned (L2/L3) |
| Google Calendar read | Planned (L1) |
| QuickBooks query | Planned (L1) |
| Qdrant vector search | Planned (L1) |
| Browser automation | Planned (L2) |
| Code diff + patch | Planned (L2) |
