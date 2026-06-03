# QA Platform — Specification

> **Status:** P0 — Phase 6  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

The QA Platform is the **centralized quality management system** for the entire Master ecosystem. It consolidates all testing, auditing, security scanning, architecture validation, and release gating into one platform that tests all projects from a single point.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    QA PLATFORM                                    │
│                     Port: 3701                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Audit Engine │  │ Test Engine  │  │ Stress Engine        │  │
│  │              │  │              │  │                      │  │
│  │- Source scan │  │- Smoke       │  │- Load testing       │  │
│  │- Inventory   │  │- Regression  │  │- Stability          │  │
│  │- Health      │  │- Unit/E2E   │  │- Capacity planning  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │Security Eng  │  │Architecture │  │ Release Gate Engine  │  │
│  │              │  │  Engine      │  │                      │  │
│  │- Secrets     │  │- Dependency  │  │- Approve/Reject     │  │
│  │- Vulns       │  │- Impact      │  │- Block releases     │  │
│  │- OWASP       │  │- Boundaries  │  │- Approval workflow  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Six QA Engines

### 3.1 Audit Engine

**Purpose:** Scan, inventory, and health-check all projects.

**Capabilities:**
- Full source scan (file structure, naming, organization)
- Dependency inventory (outdated, vulnerable, unused)
- Code quality metrics (complexity, duplication, coverage)
- Documentation completeness check
- PROJECT_DNA.md validation

**Outputs:**
- `COMPANY_MAP.md` — All departments, owners, projects
- `COMPANY_INVENTORY.md` — Complete project inventory
- `RISK_REGISTER.md` — Risk matrix for all projects
- `DEPENDENCY_GRAPH.md` — Project dependencies

### 3.2 Test Engine

**Purpose:** Automated testing across all projects.

**Test Types:**

| Type | Trigger | Scope | Frequency |
|------|---------|-------|-----------|
| Smoke | Every commit | Critical paths | Continuous |
| Regression | Before release | Full suite | Daily 2 AM |
| Unit | On change | Changed modules | Continuous |
| Integration | Before release | Cross-module | Daily |
| E2E | Before release | User flows | Daily |
| Walkthrough | Manual trigger | Full app | Weekly |

**Supported Frameworks:**
- Playwright (browser testing)
- Jest/Vitest (unit testing)
- Pytest (Python testing)
- Custom test runners

### 3.3 Stress Engine

**Purpose:** Load testing and stability verification.

**Capabilities:**
- Concurrent user simulation
- API load testing
- Memory leak detection
- Long-running stability tests
- Capacity planning

**Schedule:**
```yaml
stress:
  schedule: "0 3 * * 0"  # Sunday 3 AM
  targets: ["API", "Dashboard", "Auth"]
  duration: "30m"
  concurrent_users: [10, 50, 100, 500]
```

### 3.4 Security Engine

**Purpose:** Vulnerability scanning and secrets detection.

**Checks:**
- Secrets in source code (API keys, passwords, tokens)
- Dependency vulnerabilities (CVE database)
- OWASP Top 10 compliance
- Authentication/authorization review
- Input validation audit
- SQL injection patterns
- XSS vulnerability patterns

**Schedule:**
```yaml
security:
  schedule: "0 4 * * *"  # Daily at 4 AM
  rules: ["OWASP Top 10", "Secrets", "Dependencies", "Auth"]
```

### 3.5 Architecture Engine

**Purpose:** Dependency graph validation and impact analysis.

**Capabilities:**
- Build dependency graph across all projects
- Detect circular dependencies
- Calculate impact scores
- Validate module boundaries
- Check for architecture drift

**Outputs:**
- Dependency graph (JSON + visual)
- Impact analysis per project
- Circular dependency warnings
- Architecture drift report

### 3.6 Release Gate Engine

**Purpose:** Final pass/fail decision before deploy.

**Gate Checks:**

| Gate | Pass Criteria | Block Criteria |
|------|--------------|----------------|
| Audit | Score > 80% | Score < 60% |
| Tests | All pass | Any critical fail |
| Security | No critical vulns | Any critical vuln |
| Architecture | No circular deps | Breaking change |
| Documentation | DNA up to date | Missing DNA |

**Decision Matrix:**

| Audit | Tests | Security | Architecture | Decision |
|-------|-------|----------|--------------|----------|
| Pass | Pass | Pass | Pass | ✅ APPROVE |
| Pass | Pass | Warning | Pass | ⚠️ WARN |
| Pass | Fail | Any | Any | ❌ BLOCK |
| Any | Any | Fail | Any | ❌ BLOCK |
| Warning | Pass | Pass | Pass | ⚠️ WARN |

---

## 4. QA Score Calculation

```
QA Score = (
  Test Coverage (30%) +
  Security Score (25%) +
  Architecture Health (20%) +
  Incident History (15%) +
  Documentation (10%)
)
```

### Score Thresholds

| Score | Status | Action |
|-------|--------|--------|
| 90-100 | 🟢 Excellent | Auto-approve P2 releases |
| 75-89 | 🟢 Good | Standard approval |
| 60-74 | 🟡 Warning | Enhanced review required |
| 40-59 | 🔴 Poor | Requires full audit |
| 0-39 | 🔴 Critical | Block all releases |

---

## 5. Target Projects

QA Platform tests all projects under `E:\Project\Master`:

| Project | Priority | QA Level |
|---------|----------|----------|
| agent-os | P0 | Continuous |
| Bakudan (all) | P1 | Enhanced |
| QA systems | P1 | Enhanced |
| RawSushi | P2 | Standard |
| Other | P3 | Standard |

---

## 6. QA API

### 6.1 Run Audit

```
POST /api/qa/audit
{ "project": "all", "scope": "full" }
```

### 6.2 Run Tests

```
POST /api/qa/test
{ "project": "Dashboard", "type": "regression" }
```

### 6.3 Check Release Gate

```
POST /api/qa/release-gate
{ "project": "Payroll", "version": "v2.0.0" }
```

### 6.4 Get QA Score

```
GET /api/qa/score/{project}
```

### 6.5 Get Company Health

```
GET /api/qa/health
```

---

## 7. Integration Points

| System | Integration |
|--------|-------------|
| Source Indexer | Provides project list for audit scope |
| Master Journal | Records all QA events |
| Knowledge Graph | Links bugs, fixes, decisions |
| Health Engine | Provides QA health scores |
| CEO Chat | Answers QA-related queries |
| Review Board | Provides QA reviewer input |
| Artifact Registry | Stores all QA reports |

---

## 8. QA Rights

### 8.1 QA Can Block

- Production releases
- P0 project deploys
- Critical branch merges

### 8.2 QA Can Require

- Security scan before release
- Regression tests before merge
- QA Lead approval for P0 changes
- CTO signoff for critical changes

### 8.3 QA Cannot Override

- Security critical findings
- Data loss risk findings
- CEO-level decisions
