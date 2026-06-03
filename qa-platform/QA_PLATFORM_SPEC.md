# QA PLATFORM SPEC

**Phase 6 of Master Intelligence Layer**

## Purpose

Canonical QA service for the Master ecosystem. Owns quality gates outside individual products so projects do not need to carry separate audit, stress, security, architecture, and release-gate logic.

## Scope

QA Platform tests:
- Agent OS
- Dashboard
- Payroll
- Review Auto
- Bakudan products
- RawSushi products
- Toast QB
- Future projects

## Required Engines

| Engine | Purpose | Test Types |
|--------|---------|------------|
| `audit-engine` | Source and structure audit | code quality, structure, docs |
| `test-engine` | Functional testing | unit, integration, browser, workflow |
| `stress-engine` | Load and stability testing | load, endurance, spike |
| `security-engine` | Security checks | secrets, dependencies, risky operations |
| `architecture-engine` | Dependency and boundary validation | circular deps, boundary violations |
| `release-gate-engine` | Final pass/fail before deploy | all gates combined |

## Test Inventory

### Playwright Tests
- Browser automation
- E2E workflows
- Screenshot capture
- Video recording
- Accessibility testing

### Regression Tests
- Core functionality
- Critical paths
- Known bug regressions

### Smoke Tests
- Quick sanity checks
- Health endpoints
- Login flows

### Stress Tests
- Load simulation
- Concurrent users
- Resource limits

### Audit Tests
- Code structure
- Documentation coverage
- Dependency analysis

### Walkthrough Tests
- Manual procedure recording
- Step-by-step validation

### Release Gates
- Pre-release validation
- Post-deploy verification

## Test Configuration

```yaml
# qa-platform/config/test-suites.yaml

suites:
  - name: "Dashboard Full Suite"
    project: "dashboard"
    engines: ["test", "audit", "security"]
    browser: "chromium"
    headless: true
    timeout: 300000
    tests:
      - path: "tests/e2e/*.spec.ts"
      - path: "tests/integration/*.test.ts"
    
  - name: "Agent OS Regression"
    project: "agent-os"
    engines: ["test", "architecture"]
    timeout: 600000
    tests:
      - path: "tests/**/*.test.ts"
      - path: "tests/**/*.spec.ts"

  - name: "Bakudan Smoke"
    project: "bakudan"
    engines: ["test"]
    timeout: 120000
    critical_only: true
    tests:
      - path: "qa/smoke/*.spec.ts"
```

## Release Gate Definition

```yaml
# Release gate: must pass ALL before deploy
gates:
  - name: "Code Quality Gate"
    threshold: 80
    metrics:
      - test_coverage: >= 80%
      - lint_errors: 0
      - type_errors: 0
      
  - name: "Security Gate"
    threshold: 100
    checks:
      - no_secrets_in_code: true
      - dependencies_secure: true
      - no_risky_operations: true
      
  - name: "Functional Gate"
    threshold: 95
    metrics:
      - critical_tests_pass: 100%
      - regression_tests_pass: >= 95%
      
  - name: "Performance Gate"
    threshold: 90
    metrics:
      - load_test_pass: true
      - response_time_p95: < 500ms
      
  - name: "Documentation Gate"
    threshold: 70
    metrics:
      - readme_exists: true
      - changelog_updated: true
      - api_docs_complete: true
```

## QA Report Schema

```json
{
  "report_id": "qa_20260601_190000_abc123",
  "project": "dashboard",
  "suite": "Full Regression",
  "timestamp": "2026-06-01T19:00:00Z",
  "duration_seconds": 1847,
  "status": "PASS",
  "results": {
    "total": 142,
    "passed": 140,
    "failed": 1,
    "skipped": 1,
    "flaky": 0
  },
  "coverage": {
    "lines": 87.3,
    "branches": 81.2,
    "functions": 92.5
  },
  "security": {
    "secrets_found": 0,
    "vulnerabilities": 0,
    "risky_operations": 0
  },
  "performance": {
    "avg_response_ms": 245,
    "p95_response_ms": 480,
    "p99_response_ms": 890
  },
  "artifacts": [
    {
      "type": "qa_report",
      "path": "artifacts/qa-reports/dashboard/2026-06-01/report.json",
      "checksum": "sha256:abc123..."
    },
    {
      "type": "qa_video",
      "path": "artifacts/qa-videos/dashboard/2026-06-01/run.webm",
      "checksum": "sha256:def456..."
    }
  ],
  "gate_results": {
    "code_quality": "PASS",
    "security": "PASS",
    "functional": "PASS",
    "performance": "PASS",
    "overall": "PASS"
  }
}
```

## Engine Architecture

```
qa-platform/
├── index.js                    # Main entry
├── config/
│   ├── test-suites.yaml
│   ├── release-gates.yaml
│   └── browser-config.json
├── engines/
│   ├── audit/
│   │   ├── index.js
│   │   ├── code-quality.js
│   │   ├── structure-check.js
│   │   └── doc-coverage.js
│   ├── test/
│   │   ├── index.js
│   │   ├── playwright-runner.js
│   │   └── test-reporter.js
│   ├── stress/
│   │   ├── index.js
│   │   ├── load-simulator.js
│   │   └── metrics-collector.js
│   ├── security/
│   │   ├── index.js
│   │   ├── secrets-scanner.js
│   │   ├── dep-analyzer.js
│   │   └── risky-op-detector.js
│   ├── architecture/
│   │   ├── index.js
│   │   ├── dep-graph.js
│   │   └── boundary-validator.js
│   └── release-gate/
│       ├── index.js
│       ├── gate-runner.js
│       └── gate-reporter.js
├── lib/
│   ├── test-loader.js
│   ├── result-aggregator.js
│   └── artifact-uploader.js
├── artifacts/
│   ├── qa-reports/
│   ├── qa-videos/
│   ├── qa-screenshots/
│   └── qa-platform/
└── README.md
```

## QA API

```typescript
interface QAPlatform {
  // Run tests
  runSuite(project: string, suite: string): Promise<QAResport>;
  runEngine(project: string, engine: EngineType): Promise<EngineResult>;
  runReleaseGate(project: string, gate: string): Promise<GateResult>;
  
  // Query
  getLatestReport(project: string): Promise<QAReport>;
  getReportHistory(project: string, days: number): Promise<QAReport[]>;
  getCoverage(project: string): Promise<CoverageMetrics>;
  getSecurityScore(project: string): Promise<SecurityScore>;
  
  // Management
  listSuites(project?: string): Promise<Suite[]>;
  listEngines(): Promise<Engine[]>;
  getGateStatus(project: string): Promise<GateStatus>;
}
```

## Contract

Every QA run must:
1. Produce artifacts under `qa-platform/artifacts/`
2. Create a journal event in `master-journal`
3. Register artifact in `artifact-registry`
4. Update project health in `knowledge-graph`

## Integration Points

| System | Interaction |
|--------|-------------|
| Agent OS | Triggers QA runs, stores artifacts |
| Bakudan products | Consumes QA platform |
| Dashboard | Consumes QA platform |
| Review Auto | Consumes QA platform |
| Payroll | Consumes QA platform |
| Master Journal | Creates QA events |
| Artifact Registry | Stores QA outputs |
| Knowledge Graph | Updates QA coverage |
| Health Engine | Reads QA scores |
| CEO Chat | Queries QA status |
| Review Board | Requires QA pass for approval |

## Success Criteria

- [ ] QA Platform tests all projects from one interface
- [ ] All test types consolidated (Playwright, regression, smoke, stress, audit, walkthrough)
- [ ] Release gates are automated and blocking
- [ ] QA reports are stored in Artifact Registry
- [ ] CEO can ask "What is Dashboard's QA score?"
- [ ] No project ships without QA pass
