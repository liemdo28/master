# HEALTH ENGINE SPEC

**Phase 7 of Master Intelligence Layer**

## Purpose

Calculate and report the health of projects, QA, releases, infrastructure, and workers across the entire company. Health Engine provides the single source of truth for operational status.

## Health Dimensions

```
Company Health
├── Project Health
│   ├── Code Quality
│   ├── Test Coverage
│   ├── Security Posture
│   ├── Documentation
│   └── Bug Count
├── QA Health
│   ├── Test Automation
│   ├── Bug Resolution
│   └── Release Quality
├── Release Health
│   ├── Deployment Success
│   ├── Rollback Rate
│   └── Time to Production
├── Infrastructure Health
│   ├── Worker Status
│   ├── System Resources
│   └── Network Connectivity
└── Business Health
    ├── Revenue Impact
    ├── Customer Satisfaction
    └── Team Velocity
```

## Health Score Formula

```
Overall Health = (
  Project Health (30%) +
  QA Health (30%) +
  Release Health (20%) +
  Infrastructure Health (20%)
)

Project Health = (
  Code Quality (25%) +
  Test Coverage (25%) +
  Security Score (25%) +
  Documentation (15%) +
  Bug Count (10%)
)
```

## Health Thresholds

| Level | Score Range | Status | Action |
|-------|-------------|--------|--------|
| 🟢 Excellent | 90-100 | PASS | Maintain |
| 🟢 Healthy | 80-89 | PASS | Monitor |
| 🟡 Warning | 70-79 | WARNING | Investigate |
| 🔴 Critical | 50-69 | CRITICAL | Escalate |
| ⚫ Emergency | 0-49 | EMERGENCY | Immediate action |

## Project Health Metrics

| Metric | Source | Weight |
|--------|--------|--------|
| Code Quality | Audit engine | 25% |
| Test Coverage | QA Platform | 25% |
| Security Score | Security engine | 25% |
| Documentation | Audit engine | 15% |
| Bug Count | Master Journal | 10% |

## Infrastructure Health Metrics

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|---------|
| Workers Online | 100% | 75-99% | <75% |
| CPU Usage | <70% | 70-90% | >90% |
| Memory Usage | <80% | 80-95% | >95% |
| Disk Usage | <70% | 70-85% | >85% |
| Network Latency | <100ms | 100-300ms | >300ms |

## Health Report Schema

```json
{
  "report_id": "health_20260601_190000",
  "timestamp": "2026-06-01T19:00:00Z",
  "overall": 88,
  "dimensions": {
    "project_health": 91,
    "qa_health": 85,
    "release_health": 78,
    "infrastructure_health": 100,
    "business_health": null
  },
  "trend": -3,
  "target": 90,
  "projects": [
    {
      "name": "Agent OS",
      "health": 98,
      "status": "healthy",
      "criticality": "P0",
      "issues": []
    },
    {
      "name": "Dashboard",
      "health": 87,
      "status": "warning",
      "criticality": "P1",
      "issues": [
        "Test coverage dropped 5%"
      ]
    },
    {
      "name": "Payroll",
      "health": 72,
      "status": "critical",
      "criticality": "P0",
      "issues": [
        "Known bug unresolved",
        "QA score below threshold"
      ]
    }
  ],
  "workers": [
    {
      "name": "PC-Worker-1",
      "status": "online",
      "cpu": 45,
      "memory": 52,
      "last_heartbeat": "2026-06-01T19:00:00Z"
    }
  ],
  "alerts": [
    {
      "level": "warning",
      "project": "Dashboard",
      "message": "QA score below target",
      "timestamp": "2026-06-01T18:30:00Z"
    }
  ],
  "risks": [
    {
      "project": "Payroll",
      "risk": "Timezone bug",
      "severity": "high",
      "mitigation": "Fix in progress"
    }
  ]
}
```

## Health Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  COMPANY HEALTH                                          88%   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ OVERALL HEALTH TREND                                      │   │
│  │  88% ───────────────────●                               │   │
│  │  Target: 90%                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ PROJECT HEALTH  │  │ QA HEALTH       │  │ INFRA HEALTH  │ │
│  │     91% 🟢     │  │     85% 🟡     │  │    100% 🟢   │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AT RISK PROJECTS                                         │   │
│  │ 🔴 Payroll       P0 | 72% | 2 issues                    │   │
│  │ 🟡 Dashboard    P1 | 87% | 1 issue                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ACTIVE WORKERS: 3/3 ONLINE                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Health API

```typescript
interface HealthEngine {
  // Calculate health
  calculateOverall(): Promise<number>;
  calculateProjectHealth(project: string): Promise<number>;
  calculateQAHealth(): Promise<number>;
  calculateReleaseHealth(): Promise<number>;
  calculateInfrastructureHealth(): Promise<number>;
  
  // Reports
  getLatestReport(): Promise<HealthReport>;
  getProjectReport(project: string): Promise<ProjectHealth>;
  getTrendReport(days: number): Promise<HealthTrend>;
  
  // Alerts
  checkAlerts(): Promise<Alert[]>;
  getActiveAlerts(): Promise<Alert[]>;
  
  // Dashboard data
  getDashboardData(): Promise<DashboardData>;
}
```

## Alert Configuration

```yaml
alerts:
  - name: "Worker Offline"
    condition: "workers.online < workers.total"
    level: critical
    notify: ["ceo", "operations"]
    cooldown: 300  # seconds
    
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
    
  - name: "Project Health Critical"
    condition: "project.health < 70"
    level: critical
    notify: ["ceo", "project_owner"]
    
  - name: "QA Score Low"
    condition: "qa.score < 70"
    level: warning
    notify: ["qa_lead"]
```

## Architecture

```
health-engine/
├── index.js              # Main entry
├── calculator.js         # Health calculation logic
├── aggregator.js         # Multi-source data aggregation
├── alert-engine.js       # Alert detection and notification
├── trend-analyzer.js     # Historical trend analysis
├── data/
│   └── health.db         # Historical health data
├── reports/
│   ├── templates/        # Report templates
│   └── generated/        # Generated reports
├── config/
│   ├── weights.yaml      # Health dimension weights
│   ├── thresholds.yaml   # Alert thresholds
│   └── notifications.yaml # Notification channels
└── README.md
```

## Data Sources

| Source | Data Used |
|--------|-----------|
| Source Indexer | Project metadata, file counts |
| Knowledge Graph | Dependencies, relationships |
| QA Platform | Test coverage, pass rates |
| Master Journal | Bugs, incidents, fixes |
| Artifact Registry | Latest reports |
| Agent OS | Worker status, task metrics |

## Update Frequency

| Health Type | Frequency | Trigger |
|-------------|-----------|---------|
| Real-time | Every 1 min | Worker heartbeats |
| Project | Every 15 min | Scheduled + on event |
| Overall | Every 5 min | Scheduled |
| Alert | Immediate | On condition match |

## Success Criteria

- [ ] Health scores calculated for all projects
- [ ] Alerts trigger on threshold breach
- [ ] Dashboard shows real-time health
- [ ] CEO can ask "How is the company doing?"
- [ ] Health trends tracked over time
- [ ] Project owners notified of health drops
