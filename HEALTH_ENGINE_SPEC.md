# Health Engine — Specification

> **Status:** P0 — Phase 7  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

The Health Engine calculates and reports **company-wide health** across five dimensions: Project Health, QA Health, Release Health, Infrastructure Health, and Worker Health. It produces a single composite score and per-project breakdowns that CEO Chat and dashboards consume.

---

## 2. Health Dimensions

```
Company Health (weighted composite)
│
├── Project Health (30%)
│   ├── Code Quality
│   ├── Test Coverage
│   ├── Security Posture
│   ├── Documentation
│   └── Bug Count
│
├── QA Health (30%)
│   ├── Test Automation Coverage
│   ├── Bug Resolution Rate
│   ├── Release Quality
│   └── Regression Rate
│
├── Release Health (20%)
│   ├── Deployment Success Rate
│   ├── Rollback Rate
│   ├── Time to Production
│   └── Release Frequency
│
├── Infrastructure Health (10%)
│   ├── Worker Availability
│   ├── System Resources (CPU/RAM/Disk)
│   ├── Network Connectivity
│   └── Service Uptime
│
└── Worker Health (10%)
    ├── Task Completion Rate
    ├── Error Rate
    ├── Queue Depth
    └── Response Time
```

---

## 3. Score Calculation

### 3.1 Company Health Score

```
Company Health = (
  Project Health × 0.30 +
  QA Health × 0.30 +
  Release Health × 0.20 +
  Infrastructure Health × 0.10 +
  Worker Health × 0.10
)
```

### 3.2 Project Health Score (per project)

```
Project Score = (
  Code Quality (25%) +
  Test Coverage (25%) +
  Security Score (25%) +
  Documentation (15%) +
  Bug Count Inverse (10%)
)
```

### 3.3 Status Thresholds

| Score | Status | Emoji | Action |
|-------|--------|-------|--------|
| 90-100 | Healthy | 🟢 | No action needed |
| 70-89 | Warning | 🟡 | Monitor, plan improvements |
| 50-69 | Degraded | 🟠 | Active intervention required |
| 0-49 | Critical | 🔴 | Immediate action, alert CEO |

---

## 4. Health Dashboard Output

```
┌─────────────────────────────────────────────────────────────┐
│  COMPANY HEALTH                                      91%   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Projects:                                                  │
│  ├── agent-os          ████████████████████  98%  🟢       │
│  ├── Bakudan/dashboard ████████████████████  92%  🟢       │
│  ├── Bakudan/review    ███████████████████   95%  🟢       │
│  ├── QA/qa-system      ████████████████      85%  🟡       │
│  └── Other/tu-vi       ████████████           78%  🟡       │
│                                                             │
│  Open Risks: 7                                              │
│  Blocked Releases: 1                                        │
│  Critical Bugs: 0                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Health API

### 5.1 Get Overall Health

```
GET /api/health
```

Response:
```json
{
  "overall": 91,
  "status": "healthy",
  "dimensions": {
    "project_health": 93,
    "qa_health": 88,
    "release_health": 92,
    "infrastructure_health": 100,
    "worker_health": 85
  },
  "trend": "+2%",
  "last_calculated": "2026-06-01T19:00:00+07:00"
}
```

### 5.2 Get Project Health

```
GET /api/health/project/{name}
```

Response:
```json
{
  "project": "Dashboard",
  "score": 92,
  "status": "healthy",
  "breakdown": {
    "code_quality": 93,
    "test_coverage": 87,
    "security_score": 95,
    "documentation": 88,
    "bug_count_score": 92
  },
  "open_bugs": 2,
  "known_risks": 3,
  "last_release": "v2.3.0",
  "trend": "-1%"
}
```

### 5.3 Get Health History

```
GET /api/health/history?days=30
```

### 5.4 Get Alerts

```
GET /api/health/alerts
```

---

## 6. Alert System

### 6.1 Alert Levels

| Level | Condition | Action |
|-------|-----------|--------|
| 🟢 Info | Health > 90% | Log only |
| 🟡 Warning | Health 70-90% | Notify team |
| 🔴 Critical | Health < 70% | Alert CEO |
| ⚫ Emergency | Health < 50% | Immediate action required |

### 6.2 Alert Triggers

```yaml
alerts:
  - name: "Worker Offline"
    condition: "workers.online < workers.total"
    level: critical
    notify: ["ceo", "operations"]
    
  - name: "Health Dropped"
    condition: "health.trend < -10"
    level: warning
    notify: ["qa_lead"]
    
  - name: "Critical Bug"
    condition: "bugs.critical > 0"
    level: critical
    notify: ["ceo", "engineering_lead"]
    
  - name: "Release Blocked"
    condition: "releases.blocked > 2"
    level: warning
    notify: ["qa_lead"]
    
  - name: "Security Vulnerability"
    condition: "security.critical > 0"
    level: critical
    notify: ["ceo", "security_lead"]
```

---

## 7. Weekly CEO Report

Generated every Monday at 8 AM:

```markdown
# Company Health Report
## Week of May 25 - May 31, 2026

## Overall Health: 91% (Target: 90%) ✅

### Summary
- Projects: 26 total
- Healthy: 20 (77%)
- Warning: 5 (19%)
- Critical: 1 (4%)

### Highlights
✅ Agent OS stable (98%)
✅ 3 releases completed successfully
✅ Zero critical bugs
❌ QA coverage dropped 3% on Bakudan

### Top Risks
1. Agent Core single point of failure (P0)
2. Bakudan QA coverage declining (P1)
3. Outdated dependencies in 4 projects (P2)

### Actions Required
- [ ] Add redundancy to Agent Core
- [ ] Improve Bakudan test coverage
- [ ] Update dependencies in flagged projects

### Next Week
- Release agent-os v3.0.0
- Security audit for all P0 projects
- Infrastructure upgrade planned
```

---

## 8. Data Sources

| Dimension | Source |
|-----------|--------|
| Code Quality | Source Indexer (complexity, duplication) |
| Test Coverage | QA Platform (test reports) |
| Security | QA Platform Security Engine |
| Documentation | Source Indexer (README, DNA presence) |
| Bug Count | Master Journal (bugs/) |
| Release Quality | Master Journal (deploy events) |
| Infrastructure | System monitoring (CPU/RAM/Disk) |
| Worker Health | Agent OS worker status |

---

## 9. Integration Points

| System | Integration |
|--------|-------------|
| Source Indexer | Reads project metrics |
| QA Platform | Reads QA scores and test results |
| Master Journal | Reads incidents, bugs, deploys |
| Knowledge Graph | Writes health scores as node attributes |
| CEO Chat | Serves health queries |
| Review Board | Provides health context for decisions |

---

## 10. Calculation Schedule

| Calculation | Frequency |
|-------------|-----------|
| Per-project health | Every 15 minutes |
| Company health | Every hour |
| Health trends | Daily |
| Weekly report | Monday 8 AM |
| Alert checks | Every 5 minutes |
