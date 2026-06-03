# Phase O — Company Health Engine

## Overview

Health Engine theo dõi và báo cáo sức khỏe toàn doanh nghiệp.

---

## Health Dimensions

```
Company Health
 │
 ├── Project Health
 │   ├── Code Quality
 │   ├── Test Coverage
 │   ├── Security Posture
 │   └── Documentation
 │
 ├── QA Health
 │   ├── Test Automation
 │   ├── Bug Resolution
 │   └── Release Quality
 │
 ├── Release Health
 │   ├── Deployment Success
 │   ├── Rollback Rate
 │   └── Time to Production
 │
 ├── Infrastructure Health
 │   ├── Worker Status
 │   ├── System Resources
 │   └── Network Connectivity
 │
 └── Business Health
     ├── Revenue Impact
     ├── Customer Satisfaction
     └── Team Velocity
```

---

## Health Metrics

### Project Health Score

```
Score = (
  Code Quality (25%) +
  Test Coverage (25%) +
  Security Score (25%) +
  Documentation (15%) +
  Bug Count (10%)
)
```

### Infrastructure Health

| Metric | Healthy | Warning | Critical |
|--------|----------|----------|----------|
| Workers Online | 100% | 75% | <75% |
| CPU Usage | <70% | 70-90% | >90% |
| Memory Usage | <80% | 80-95% | >95% |
| Disk Usage | <70% | 70-85% | >85% |
| Network Latency | <100ms | 100-300ms | >300ms |

---

## Health Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  COMPANY HEALTH                                          88%   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ OVERALL HEALTH TREND                                      │   │
│  │                                                          │   │
│  │ 100% ───────────────────────────────────────────────    │   │
│  │  88% ───────────────────●                               │   │
│  │  75% ───●──●──●──●──●──●──●──●──●──●                │   │
│  │  Mon   Tue   Wed   Thu   Fri   Sat   Sun              │   │
│  │                                                          │   │
│  │  Current: 88% 🟡 | Trend: -3% | Target: 90%           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ PROJECT HEALTH  │  │ QA HEALTH       │  │ INFRA HEALTH  │  │
│  │     91% 🟢     │  │     85% 🟡     │  │    100% 🟢   │  │
│  │ ▲ +2% this week │  │ ▼ -3% this week │  │ ▲ +5% stable │  │
│  └──────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AT RISK PROJECTS                                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 🔴 Agent Core    Impact: 5 deps | Status: Healthy     │   │
│  │ 🔴 Payroll       Impact: Finance | Status: Warning     │   │
│  │ 🟡 Dashboard    Impact: Users | Status: Degraded       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ACTIVE WORKERS                                           │   │
│  │ PC-Worker-1  🟢 | PC-Worker-2  🟢 | Laptop-Worker  🟢 │   │
│  │                                                             │   │
│  │ CPU: 45% | RAM: 8.2GB/16GB | Disk: 45%                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [🔄 Refresh] [📊 Full Report] [⚠️ Alerts] [📧 Weekly Report] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Health API

### Get Overall Health
```
GET /api/health
```

```json
{
  "overall": 88,
  "project_health": 91,
  "qa_health": 85,
  "release_health": 78,
  "infrastructure_health": 100,
  "trend": -3,
  "last_updated": "2026-06-01T17:00:00Z"
}
```

### Get Detailed Health
```
GET /api/health/:dimension
```

```json
{
  "dimension": "project_health",
  "score": 91,
  "details": {
    "code_quality": 93,
    "test_coverage": 87,
    "security_score": 95,
    "documentation": 78,
    "bug_count": 12
  },
  "projects": [
    { "name": "Agent Core", "health": 98, "status": "healthy" },
    { "name": "Dashboard", "health": 87, "status": "warning" },
    { "name": "Payroll", "health": 88, "status": "warning" }
  ]
}
```

---

## Health Alerts

### Alert Levels

| Level | Condition | Action |
|-------|-----------|--------|
| 🟢 Info | Health > 90% | Log only |
| 🟡 Warning | Health 70-90% | Notify |
| 🔴 Critical | Health < 70% | Alert CEO |
| ⚫ Emergency | Health < 50% | Immediate action |

### Alert Triggers

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
```

---

## Health Reports

### Weekly CEO Report

```markdown
# Company Health Report
## Week of May 25 - May 31, 2026

## Overall Health: 88% (Target: 90%)

### Summary
- Projects: 47 total
- Healthy: 32 (68%)
- Warning: 12 (26%)
- Critical: 3 (6%)

### Highlights
✅ Agent Core stable (98%)
✅ 5 releases completed
❌ Dashboard QA score dropped 8%

### Risks
1. Payroll timezone bug (P0)
2. Dashboard regression (P1)
3. Marketing site outdated (P2)

### Actions Required
- [ ] Fix Payroll bug (assigned: Dev Lead)
- [ ] Review Dashboard regression (assigned: QA Lead)
- [ ] Schedule Marketing site audit (pending)

### Next Week
- Release v2.4.0 (if QA passes)
- Security audit
- Infrastructure upgrade
```

---

## Implementation

```typescript
class HealthEngine {
  async calculateHealth(): Promise<HealthReport> {
    const [
      projectHealth,
      qaHealth,
      releaseHealth,
      infraHealth
    ] = await Promise.all([
      this.calculateProjectHealth(),
      this.calculateQAHealth(),
      this.calculateReleaseHealth(),
      this.calculateInfraHealth(),
    ]);
    
    const overall = (
      projectHealth * 0.3 +
      qaHealth * 0.3 +
      releaseHealth * 0.2 +
      infraHealth * 0.2
    );
    
    return {
      overall,
      project_health: projectHealth,
      qa_health: qaHealth,
      release_health: releaseHealth,
      infrastructure_health: infraHealth,
      timestamp: new Date().toISOString(),
    };
  }
  
  async calculateProjectHealth(): Promise<number> {
    const projects = await this.db.projects.findAll();
    
    const scores = await Promise.all(
      projects.map(p => this.calculateProjectScore(p))
    );
    
    // Weighted average by criticality
    const weighted = scores.reduce((sum, s, i) => 
      sum + s.score * projects[i].weight, 0
    );
    const totalWeight = projects.reduce((sum, p) => sum + p.weight, 0);
    
    return Math.round(weighted / totalWeight);
  }
  
  async calculateInfraHealth(): Promise<number> {
    const workers = await this.db.workers.findAll();
    
    // Worker availability (40%)
    const availability = workers.filter(w => w.status === 'online').length / workers.length;
    
    // System resources (30%)
    const resources = await Promise.all(
      workers.map(w => this.getSystemHealth(w))
    );
    const avgResources = resources.reduce((a, b) => a + b, 0) / resources.length;
    
    // Network latency (30%)
    const latency = await this.measureLatency();
    const latencyScore = latency < 100 ? 100 : latency < 300 ? 80 : 50;
    
    return Math.round(
      availability * 40 +
      avgResources * 30 +
      latencyScore * 30
    );
  }
  
  async checkAlerts(report: HealthReport): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    if (report.overall < 70) {
      alerts.push({
        level: 'critical',
        message: 'Overall health below 70%',
        action: 'Review all health dimensions',
      });
    }
    
    if (report.infrastructure_health < 100) {
      const offline = await this.db.workers.count({ status: 'offline' });
      if (offline > 0) {
        alerts.push({
          level: 'warning',
          message: `${offline} worker(s) offline`,
          action: 'Check worker connections',
        });
      }
    }
    
    return alerts;
  }
}
```
