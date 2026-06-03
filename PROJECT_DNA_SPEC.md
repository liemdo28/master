# Project DNA — Specification

> **Status:** P0 — Phase 2  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

Every project under `E:\Project\Master` generates a `PROJECT_DNA.md` file that serves as its **living identity card**. The DNA captures purpose, dependencies, risks, bugs, QA status, and health — so Agent OS never needs to read source code to understand a project.

---

## 2. File Location

```
E:\Project\Master\{ProjectName}\PROJECT_DNA.md
```

For sub-projects (e.g., Bakudan/dashboard):

```
E:\Project\Master\Bakudan\dashboard\PROJECT_DNA.md
```

---

## 3. Required Fields

### 3.1 Identity Section

```markdown
## Identity

Project: {name}
Purpose: {one-line business description}
Owner: {team or person}
Business Function: {department}
Created: {YYYY-MM-DD}
```

### 3.2 Classification Section

```markdown
## Classification

Business Criticality: {P0|P1|P2|P3}
- P0: Critical (payments, auth, core infra)
- P1: High (core features, customer-facing)
- P2: Medium (internal tools)
- P3: Low (experiments, archives)

QA Level: {Standard|Enhanced|Continuous}
Release Cadence: {daily|weekly|monthly|on-demand}
```

### 3.3 Dependencies Section

```markdown
## Dependencies

### Internal (within E:\Project\Master)

| Dependency | Type | Version/Ref | Impact |
|------------|------|-------------|--------|
| agent-os | hard | main | Critical |
| qa-platform | soft | any | If QA fails, this project degrades |
```

```markdown
### External

| Dependency | Type | Version | Risk |
|-----------|------|---------|------|
| react | npm | 18.x | React ecosystem |
| openai | pip | 1.x | API dependency |
```

### 3.4 Known Risks Section

```markdown
## Known Risks

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Timezone handling | High | Regression tests | Known |
| Overtime rounding | High | Manual approval | Active |
| API rate limits | Medium | Retry logic | Mitigated |
```

### 3.5 Known Bugs Section

```markdown
## Known Bugs

| Bug ID | Title | Severity | Status | Since |
|--------|-------|----------|--------|-------|
| #421 | Timezone offset error | High | Open | 2026-05-15 |
| #387 | Memory leak in worker | Medium | Mitigated | 2026-04-20 |
```

### 3.6 QA Coverage Section

```markdown
## QA Coverage

Test Coverage: {XX%}
Last Full Audit: {YYYY-MM-DD}
Security Score: {XX}
Last Security Scan: {YYYY-MM-DD}

### Test Breakdown

| Type | Coverage | Last Run | Status |
|------|----------|----------|--------|
| Unit | 85% | 2026-06-01 | PASS |
| Integration | 72% | 2026-06-01 | PASS |
| E2E | 60% | 2026-05-30 | WARNING |
| Security | 90% | 2026-06-01 | PASS |
```

### 3.7 Release Status Section

```markdown
## Release Status

Current Version: {vX.Y.Z}
Last Release: {YYYY-MM-DD}
Release Frequency: {weekly}
Last Git Tag: {v2.1.0}
Release Status: {Stable|Beta|Blocked}

### Release History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| v2.1.0 | 2026-05-25 | Stable | Feature release |
| v2.0.0 | 2026-05-01 | Stable | Major refactor |
```

### 3.8 Health Score Section

```markdown
## Health Score

Overall: {XX}/100
Status: {🟢 Healthy|🟡 Warning|🔴 Critical}

### Breakdown

| Dimension | Score | Weight |
|-----------|-------|--------|
| Code Quality | 92 | 25% |
| Test Coverage | 87 | 25% |
| Security | 95 | 25% |
| Documentation | 78 | 15% |
| Bug Count | 88 | 10% |
```

### 3.9 Knowledge Section

```markdown
## Knowledge

Decisions: {N} (see master-journal/decisions/)
Bugs Fixed: {N}
Known Issues: {N}
Related Projects: {list}
Architecture Notes: {summary}
```

---

## 4. DNA Generation

### 4.1 Trigger Conditions

DNA is regenerated when:
1. New project is added to Master
2. Project crosses a release milestone
3. Project has a critical bug added/resolved
4. Health score changes by >10%
5. Major dependency added/removed
6. Manual trigger via CEO Chat or QA Platform

### 4.2 Generation Sources

| Field | Source |
|-------|--------|
| Purpose | PROJECT_DNA.md (if exists), README.md, or AI inference |
| Owner | git history, existing DNA, PROJECT_DNA.md |
| Dependencies | package.json, requirements.txt, import analysis |
| Risks | master-journal/incidents/, known-bugs files |
| Bugs | master-journal/bugs/ |
| QA Coverage | QA Platform scores, test reports |
| Health | Health Engine |
| Release Status | Git tags, CHANGELOG.md, deployment records |

---

## 5. Integration Points

| System | Integration |
|--------|-------------|
| Source Indexer | Provides base metadata |
| Knowledge Graph | Registers as node with relationships |
| Master Journal | Records when DNA changes |
| Health Engine | Reads health scores |
| CEO Chat | Answers "What is {project}?" queries |
| QA Platform | Reads QA coverage and risks |

---

## 6. Example: Payroll Project DNA

```markdown
# PROJECT_DNA.md — Payroll

## Identity

Project: Payroll
Purpose: Calculate and process employee payroll
Owner: Engineering
Business Function: Finance Operations
Created: 2025-01-15

## Classification

Business Criticality: P0 (Critical)
QA Level: Enhanced Review
Release Cadence: Monthly

## Dependencies

### Internal

| Dependency | Type | Impact |
|-----------|------|--------|
| agent-os | hard | Core task execution |
| Google Drive API | soft | Report storage |

### External

| Dependency | Type | Risk |
|-----------|------|------|
| date-fns | npm | Low |
| googleapis | npm | Medium (API dependency) |

## Known Risks

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Timezone handling | High | Test matrix for all zones | Known |
| Overtime rounding | High | Manual approval gate | Known |
| Tax rule changes | Medium | Quarterly review | Active |

## Known Bugs

| Bug ID | Title | Severity | Status |
|--------|-------|----------|--------|
| #421 | Timezone offset causes wrong pay | High | Open |
| #398 | Leap year day calculation | Low | Open |

## QA Coverage

Test Coverage: 91%
Last Full Audit: 2026-05-15
Security Score: 88

| Type | Coverage | Status |
|------|----------|--------|
| Unit | 95% | PASS |
| Integration | 88% | PASS |
| E2E | 80% | PASS |
| Security | 88% | PASS |

## Release Status

Current Version: v2.1.0
Last Release: 2026-05-25
Release Status: Stable

## Health Score

Overall: 88/100
Status: 🟡 Warning

| Dimension | Score | Weight |
|-----------|-------|--------|
| Code Quality | 90 | 25% |
| Test Coverage | 91 | 25% |
| Security | 88 | 25% |
| Documentation | 80 | 15% |
| Bug Count | 85 | 10% |

## Knowledge

Decisions: 12
Bugs Fixed: 23
Known Issues: 2
Related Projects: Dashboard, Agent Core
Architecture Notes: Batch payroll processing with approval workflow
```
