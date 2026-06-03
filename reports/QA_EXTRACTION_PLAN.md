# QA Extraction Plan — Phase 2

**Date:** 2026-06-01  
**Scope:** Extract and consolidate QA assets from `E:\Project\Master`  
**Based on:** `QA_ASSET_INVENTORY.md`  
**Status:** PENDING CEO APPROVAL

---

## Executive Summary

Based on the QA Asset Inventory, we have ONE valuable QA asset: `QA/PC-QA-Stability-Certification/`. This is already a full-featured QA platform that needs to be:

1. **Extracted** into `qa-platform/`
2. **Generalized** (currently PC-specific → project-agnostic)
3. **Enhanced** with product app test modules
4. **Integrated** into Agent OS as a first-class service

The `_archive/` tests are legacy and not worth extracting — they test project-specific logic that won't generalize.

---

## QA Platform Vision

```
Agent OS
│
├── Engineering
├── RD
├── Operations
└── QA Platform
    │
    ├── Source Audit Engine
    ├── Architecture Audit Engine
    ├── Dependency Audit Engine
    ├── Git Audit Engine
    ├── Security Audit Engine
    ├── Performance Audit Engine
    ├── QA Engine (smoke, regression, E2E)
    ├── Stress Engine
    ├── AI Review Layer
    ├── Release Gate
    └── QA Command Center
```

CEO can say:
```
"QA Review Dashboard"
"QA Audit review-auto-system"
"QA Stress integration-system"
"QA Release gate"
```

And QA Platform handles everything automatically.

---

## Proposed Folder Structure

```
E:\Project\Master\
├── qa-platform/                    ← NEW: Unified QA Platform
│   ├── app/                       ← Core modules (from PC-QA)
│   │   ├── analyzers/            ← Analysis engines
│   │   ├── collectors/            ← Data collectors
│   │   ├── monitors/              ← Monitoring
│   │   ├── orchestrator/         ← Test orchestration
│   │   ├── validators/           ← Validation
│   │   ├── reports/              ← Report generation
│   │   ├── decision/             ← Decision engine
│   │   ├── intelligence/        ← AI analysis
│   │   ├── forensics/            ← Root cause analysis
│   │   ├── recovery/             ← Recovery testing
│   │   ├── reliability/          ← Reliability analysis
│   │   ├── systemHealth/        ← Health checks
│   │   ├── validation/           ← Validation suite
│   │   ├── autonomous/           ← Auto-fix
│   │   └── authority/           ← Approval workflow
│   │
│   ├── src/                      ← Core engine
│   │   ├── ai/                 ← AI analysis
│   │   ├── analyzers/           ← Analyzers
│   │   ├── auto-fix/           ← Auto-fix engine
│   │   ├── collectors/           ← Collectors
│   │   ├── core/               ← Core logic
│   │   ├── reporters/           ← Reporters
│   │   └── simulation/          ← Load simulation
│   │
│   ├── test-modules/            ← Product-specific test modules
│   │   ├── dashboard/          ← Dashboard tests
│   │   ├── review-auto/        ← Review automation tests
│   │   ├── integration-system/  ← Integration system tests
│   │   ├── packing-list/       ← Packing list tests
│   │   ├── linktree/           ← LinkTreeHL tests
│   │   ├── agent-core/         ← Agent coding tests
│   │   └── ...                 ← Future products
│   │
│   ├── test-suites/            ← Cross-project test suites
│   │   ├── smoke/              ← Smoke tests
│   │   ├── regression/         ← Regression tests
│   │   ├── e2e/               ← End-to-end tests
│   │   ├── integration/        ← Integration tests
│   │   └── performance/        ← Performance tests
│   │
│   ├── playwright/              ← E2E test framework
│   │   ├── pages/             ← Page objects
│   │   ├── fixtures/          ← Test fixtures
│   │   ├── helpers/           ← Utilities
│   │   └── playwright.config.ts
│   │
│   ├── stress-engine/           ← Stress testing
│   │   ├── load/
│   │   ├── concurrency/
│   │   ├── memory/
│   │   └── chaos/
│   │
│   ├── audit-engine/            ← Audit engines
│   │   ├── source/
│   │   ├── architecture/
│   │   ├── dependency/
│   │   ├── git/
│   │   ├── security/
│   │   └── database/
│   │
│   ├── ai-review-engine/       ← AI-powered review
│   │   ├── code-review/
│   │   ├── pr-review/
│   │   ├── architecture-review/
│   │   ├── deployment-review/
│   │   └── release-review/
│   │
│   ├── release-gate/            ← Release gate
│   │   ├── gates/
│   │   │   ├── smoke-gate/
│   │   │   ├── regression-gate/
│   │   │   ├── security-gate/
│   │   │   ├── performance-gate/
│   │   │   └── architecture-gate/
│   │   └── orchestrator/
│   │
│   ├── qa-command-center/       ← Dashboard
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│   │
│   ├── qa-knowledge/           ← Historical knowledge base
│   │   ├── recurring-bugs/
│   │   ├── architecture-violations/
│   │   ├── regression-history/
│   │   ├── deployment-incidents/
│   │   └── production-failures/
│   │
│   ├── config/
│   │   ├── thresholds.json
│   │   ├── workflow-presets.json
│   │   └── projects.json        ← Project configuration
│   │
│   ├── scripts/                 ← Test runners
│   │   ├── run-smoke.ps1
│   │   ├── run-regression.ps1
│   │   ├── run-audit.ps1
│   │   ├── run-stress.ps1
│   │   ├── run-release-gate.ps1
│   │   └── run-full-qa.ps1
│   │
│   ├── docs/
│   │   ├── ARCHITECTURE.md
│   │   ├── CEO_REPORT_TEMPLATE.md
│   │   └── QA_TEST_PLAN.md
│   │
│   └── README.md
│
├── QA/                          ← Keep PC-QA as-is (reference)
└── _archive/Personal-agentai-agency-old/tests/  ← Legacy, keep as-is
```

---

## Extraction Steps

### Step 1: Create `qa-platform/` folder (ZERO RISK)

```powershell
mkdir E:\Project\Master\qa-platform
mkdir E:\Project\Master\qa-platform\app
mkdir E:\Project\Master\qa-platform\src
mkdir E:\Project\Master\qa-platform\test-modules
mkdir E:\Project\Master\qa-platform\test-suites
mkdir E:\Project\Master\qa-platform\playwright
mkdir E:\Project\Master\qa-platform\stress-engine
mkdir E:\Project\Master\qa-platform\audit-engine
mkdir E:\Project\Master\qa-platform\ai-review-engine
mkdir E:\Project\Master\qa-platform\release-gate
mkdir E:\Project\Master\qa-platform\qa-command-center
mkdir E:\Project\Master\qa-platform\qa-knowledge
mkdir E:\Project\Master\qa-platform\config
mkdir E:\Project\Master\qa-platform\scripts
mkdir E:\Project\Master\qa-platform\docs
```

### Step 2: Copy PC-QA core to `qa-platform/app/` (LOW RISK)

```powershell
# Copy app modules
cp -r E:\Project\Master\QA\PC-QA-Stability-Certification\app\* E:\Project\Master\qa-platform\app\

# Copy src modules
cp -r E:\Project\Master\QA\PC-QA-Stability-Certification\src\* E:\Project\Master\qa-platform\src\

# Copy config
cp -r E:\Project\Master\QA\PC-QA-Stability-Certification\config\* E:\Project\Master\qa-platform\config\

# Copy docs
cp -r E:\Project\Master\QA\PC-QA-Stability-Certification\docs\* E:\Project\Master\qa-platform\docs\
```

### Step 3: Copy test suites (LOW RISK)

```powershell
# Copy smoke tests
cp -r E:\Project\Master\QA\PC-QA-Stability-Certification\tests\* E:\Project\Master\qa-platform\test-suites\

# Copy scripts
cp -r E:\Project\Master\QA\PC-QA-Stability-Certification\scripts\* E:\Project\Master\qa-platform\scripts\
```

### Step 4: Generalize PC-QA modules (MEDIUM RISK)

Modify `qa-platform/app/` modules to be project-agnostic:

| Module | Change |
|--------|--------|
| `collectors/system_collector.ps1` | Make path configurable |
| `orchestrator/main.ps1` | Accept project path as param |
| `analyzers/log_analyzer.ps1` | Accept log path as param |
| `reports/ceo_report.ps1` | Make project name configurable |

### Step 5: Create test modules for each product (MEDIUM RISK)

```powershell
# Dashboard tests
mkdir E:\Project\Master\qa-platform\test-modules\dashboard
# Add health checks, smoke tests

# Review Auto tests
mkdir E:\Project\Master\qa-platform\test-modules\review-auto
# Add API tests, workflow tests

# Integration System tests
mkdir E:\Project\Master\qa-platform\test-modules\integration-system
# Add Toast QB integration tests

# Agent Core tests
mkdir E:\Project\Master\qa-platform\test-modules\agent-core
# Add pytest integration, lint checks
```

### Step 6: Create Playwright E2E suite (MEDIUM RISK)

```powershell
# Initialize Playwright
cd E:\Project\Master\qa-platform\playwright
npm init -y
npm install @playwright/test

# Create page objects
# Create test fixtures
# Create playwright.config.ts
```

### Step 7: Create AI Review Engine (HIGH RISK)

```powershell
mkdir E:\Project\Master\qa-platform\ai-review-engine
mkdir E:\Project\Master\qa-platform\ai-review-engine\code-review
mkdir E:\Project\Master\qa-platform\ai-review-engine\pr-review
mkdir E:\Project\Master\qa-platform\ai-review-engine\architecture-review
```

**AI Review API:**
```
POST /api/ai-review/code       — Review code changes
POST /api/ai-review/pr        — Review pull request
POST /api/ai-review/architecture — Review architecture
POST /api/ai-review/deployment — Review deployment plan
POST /api/ai-review/release   — Review release readiness
```

**Response format:**
```json
{
  "result": "PASS|WARNING|FAIL",
  "reasoning": "Detailed explanation",
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "confidence": 0.95
}
```

### Step 8: Create Release Gate (HIGH RISK)

```powershell
mkdir E:\Project\Master\qa-platform\release-gate
mkdir E:\Project\Master\qa-platform\release-gate\gates
mkdir E:\Project\Master\qa-platform\release-gate\orchestrator
```

**Release Gate Flow:**
```
1. Engineering → Request Release
2. Release Gate → Run All Gates
   ├── Smoke Gate ✅
   ├── Regression Gate ✅
   ├── Security Gate ✅
   ├── Performance Gate ✅
   └── Architecture Gate ✅
3. If ALL pass → Approved for Production
4. If ANY fail → Blocked, notify Engineering
```

### Step 9: Create QA Command Center (MEDIUM RISK)

```powershell
mkdir E:\Project\Master\qa-platform\qa-command-center
mkdir E:\Project\Master\qa-platform\qa-command-center\pages
mkdir E:\Project\Master\qa-platform\qa-command-center\components
mkdir E:\Project\Master\qa-platform\qa-command-center\api
```

**Pages:**
- `/projects` — Project list with coverage status
- `/coverage` — Coverage dashboard
- `/failures` — Failure analysis
- `/release-gates` — Release gate status
- `/stress-tests` — Stress test results
- `/audit-reports` — Audit report list
- `/security` — Security scan results
- `/architecture` — Architecture review results

### Step 10: Create QA Knowledge Base (LOW RISK)

```powershell
mkdir E:\Project\Master\qa-platform\qa-knowledge
mkdir E:\Project\Master\qa-platform\qa-knowledge\recurring-bugs
mkdir E:\Project\Master\qa-platform\qa-knowledge\architecture-violations
mkdir E:\Project\Master\qa-platform\qa-knowledge\regression-history
mkdir E:\Project\Master\qa-platform\qa-knowledge\deployment-incidents
mkdir E:\Project\Master\qa-platform\qa-knowledge\production-failures
mkdir E:\Project\Master\qa-platform\qa-knowledge\recovery-reports
```

---

## QA Platform API

```typescript
// Project Management
GET  /api/projects              // List all projects
GET  /api/projects/:id         // Get project details
POST /api/projects/:id/test     // Trigger test for project

// Test Execution
POST /api/tests/smoke           // Run smoke tests
POST /api/tests/regression      // Run regression tests
POST /api/tests/e2e             // Run E2E tests
POST /api/tests/integration      // Run integration tests
POST /api/tests/performance     // Run performance tests

// Audits
POST /api/audits/source         // Run source audit
POST /api/audits/architecture   // Run architecture audit
POST /api/audits/dependency     // Run dependency audit
POST /api/audits/git            // Run git audit
POST /api/audits/security       // Run security audit

// AI Review
POST /api/ai-review/code        // Review code
POST /api/ai-review/pr         // Review PR
POST /api/ai-review/release    // Review release

// Release Gate
POST /api/release-gate/:project  // Run release gate
GET  /api/release-gate/:project/status  // Get gate status

// Stress Testing
POST /api/stress/load          // Run load test
POST /api/stress/concurrency    // Run concurrency test
POST /api/stress/memory        // Run memory leak test

// Reports
GET  /api/reports              // List all reports
GET  /api/reports/:id          // Get report details
GET  /api/reports/:id/download  // Download report

// Knowledge Base
GET  /api/knowledge/recurring-bugs
GET  /api/knowledge/architecture-violations
GET  /api/knowledge/regression-history
```

---

## Integration with Agent OS

QA Platform becomes a first-class Agent OS service:

```typescript
// In agent-control or new qa-executor
const qaPlatformExecutor = {
  name: 'qa',
  capabilities: ['qa:*'],
  handlers: {
    'qa:smoke': runSmokeTests,
    'qa:regression': runRegressionTests,
    'qa:e2e': runE2ETests,
    'qa:audit': runAudits,
    'qa:stress': runStressTests,
    'qa:ai-review': runAIReview,
    'qa:release-gate': runReleaseGate,
  }
};
```

**Agent OS Commands:**
```
"QA Review Dashboard"     → qa:audit (dashboard project)
"QA Audit review-auto"    → qa:audit (review-auto project)
"QA Stress integration"    → qa:stress (integration system)
"QA Release Gate"         → qa:release-gate
```

---

## Safety Rules

### MUST NEVER DO:
1. ❌ Delete original `QA/PC-QA-Stability-Certification/` until extraction verified
2. ❌ Delete any `_archive/` contents
3. ❌ Change production app code
4. ❌ Modify deploy configurations

### ALLOWED:
- ✅ Copy files to new `qa-platform/` folder
- ✅ Create new test modules
- ✅ Create new configuration
- ✅ Modify `qa-platform/` code

---

## Rollback Plan

If anything goes wrong:
```powershell
# Remove qa-platform
rmdir /s /q E:\Project\Master\qa-platform

# Original QA/PC-QA-Stability-Certification/ is untouched
```

---

## Success Criteria

1. ✅ QA Platform can run all test types for all projects
2. ✅ Release gate blocks bad releases
3. ✅ AI Review provides actionable feedback
4. ✅ QA Command Center shows coverage at a glance
5. ✅ Knowledge base prevents recurring bugs
6. ✅ Agent OS can trigger QA tasks

---

## Timeline

| Step | Task | Risk | Time |
|------|------|------|------|
| 1 | Create folder structure | NONE | 1 hour |
| 2 | Copy PC-QA core | LOW | 1 hour |
| 3 | Copy test suites | LOW | 1 hour |
| 4 | Generalize modules | MEDIUM | 1 day |
| 5 | Create test modules | MEDIUM | 1 day |
| 6 | Create Playwright suite | MEDIUM | 2 days |
| 7 | Create AI Review Engine | HIGH | 2 days |
| 8 | Create Release Gate | HIGH | 2 days |
| 9 | Create QA Command Center | MEDIUM | 2 days |
| 10 | Create Knowledge Base | LOW | 1 day |

**Total: ~2 weeks**

---

## Deliverables

| # | File | Status |
|---|------|--------|
| 1 | `reports/QA_ASSET_INVENTORY.md` | ✅ DONE |
| 2 | `reports/QA_EXTRACTION_PLAN.md` | ✅ DONE (this file) |
| 3 | `qa-platform/` folder | 📋 TODO |
| 4 | `qa-platform/test-modules/` | 📋 TODO |
| 5 | `qa-platform/ai-review-engine/` | 📋 TODO |
| 6 | `qa-platform/release-gate/` | 📋 TODO |
| 7 | `qa-platform/qa-command-center/` | 📋 TODO |
| 8 | `qa-platform/qa-knowledge/` | 📋 TODO |
