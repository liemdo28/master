# CI SECURITY PIPELINE REPORT

## Date: 2026-06-09
## Scope: GitHub Actions CI Pipeline for mi-core

---

## Pipeline Overview

A four-job CI security pipeline has been configured in `.github/workflows/security-pipeline.yml`

### Jobs

| Job | Tool | Trigger | Action on Failure |
|-----|------|---------|-------------------|
| **npm-audit** | `npm audit` | Push/PR to main, Weekly (Mon 6 AM) | Blocks on CRITICAL, warns on HIGH |
| **osv-scanner** | OSV-Scanner (Google) | Push/PR to main, Weekly | Reports all findings |
| **sbom** | CycloneDX SBOM | Push/PR to main, Weekly | Uploads artifact |
| **dependency-check** | `npm outdated` | Push/PR to main, Weekly | Reports stale deps |

### Severity Policy

| Severity | Action | Gate |
|----------|--------|------|
| **Critical** | ❌ Block build | `npm audit --audit-level=critical` exits non-zero |
| **High** | ⚠️ Require approval | Logged, artifact uploaded, non-blocking |
| **Medium** | 📋 Report | Logged in CI output |
| **Low** | 📋 Track | Logged in CI output |

### Schedule

- **Push to main/develop**: Full security scan
- **Pull request to main**: Full security scan
- **Weekly (Monday 6 AM)**: Scheduled scan + SBOM refresh
- **Manual**: `workflow_dispatch` trigger available

## Artifacts

| Artifact | Format | Retention |
|----------|--------|-----------|
| npm-audit-report.json | JSON | 30 days |
| osv-report.json | JSON | 30 days |
| cyclonedx-sbom.json | CycloneDX JSON | 30 days |

## Local Dev Commands

Developers can run these checks locally:

```bash
# npm audit
cd server && npm audit --audit-level=critical

# Dependency check
cd server && npm outdated

# SBOM generation
cd server && npx @cyclonedx/cyclonedx-npm@latest \
  --output-format JSON \
  --output-file ../security/sbom/cyclonedx-sbom.json

# Manual dependency review
cd server && npm ls --depth=0
cd server && npm ls --all
```

## Setup Requirements

1. **Node.js 20** (or later) — Required for npm audit compatibility
2. **npm 10+** — Required for audit-level support
3. **GitHub secrets**: None required (public registry scanning)
4. **OSV-Scanner action**: Provided by `google/osv-scanner-action@v2`

## Current Baseline

After remediation:

| Metric | Value |
|--------|-------|
| npm audit findings | **0 vulnerabilities** |
| Outdated packages | uuid (resolved to 11.1.1), others non-critical |
| SBOM generated | ✅ CycloneDX 1.6, 207 components |
