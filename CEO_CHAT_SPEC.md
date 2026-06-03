# CEO Chat — Specification

> **Status:** P0 — Phase 8  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

CEO Chat provides a **natural language interface** for the CEO to interact with the entire Master Intelligence Layer. The CEO asks questions in Vietnamese or English, and the system answers using data from the Knowledge Graph, Health Engine, QA Platform, and Master Journal — without reading source code.

---

## 2. Architecture

```
CEO (Natural Language)
     │
     ▼
Command Parser
     │
     ▼
Intent Classification
     │
     ├── Query Intent ──────▶ Knowledge Graph
     ├── Action Intent ─────▶ Agent OS
     ├── Analysis Intent ──▶ QA Platform
     ├── Health Intent ────▶ Health Engine
     └── History Intent ───▶ Master Journal
     │
     ▼
Response Generation
     │
     ▼
CEO (Natural Response)
```

---

## 3. Supported Languages

- Vietnamese (primary)
- English (secondary)
- Mixed (Vietnamese + English technical terms)

---

## 4. Intent Classification

### 4.1 Query Intents

| Pattern | Intent | Source |
|---------|--------|--------|
| "Project nào..." | `query:project` | Knowledge Graph |
| "Ai..." | `query:owner` | Knowledge Graph |
| "Phụ thuộc..." | `query:dependency` | Knowledge Graph |
| "Bug nào..." | `query:bugs` | Master Journal |
| "Rủi ro..." | `query:risk` | Health Engine |
| "Bao nhiêu..." | `query:metrics` | Source Indexer |

### 4.2 Health Intents

| Pattern | Intent | Source |
|---------|--------|--------|
| "Sức khỏe..." | `health:overall` | Health Engine |
| "...ổn không?" | `health:project` | Health Engine |
| "Status..." | `health:status` | Health Engine |
| "Health..." | `health:overall` | Health Engine |

### 4.3 Action Intents

| Pattern | Intent | Source |
|---------|--------|--------|
| "Audit..." | `action:audit` | QA Platform |
| "Test..." | `action:test` | QA Platform |
| "Build..." | `action:build` | Agent OS |
| "Deploy..." | `action:deploy` | Agent OS |
| "Scan..." | `action:scan` | QA Platform |

### 4.4 Analysis Intents

| Pattern | Intent | Source |
|---------|--------|--------|
| "Tại sao..." | `analysis:root_cause` | Knowledge Graph |
| "So sánh..." | `analysis:compare` | Health Engine |
| "Trend..." | `analysis:trend` | Health Engine |
| "Why..." | `analysis:root_cause` | Knowledge Graph |

### 4.5 History Intents

| Pattern | Intent | Source |
|---------|--------|--------|
| "Có gì mới..." | `history:recent` | Master Journal |
| "Hôm nay..." | `history:today` | Master Journal |
| "Tuần này..." | `history:week` | Master Journal |
| "Ai sửa..." | `history:changes` | Master Journal |

---

## 5. Example Conversations

### 5.1 Health Query

```
CEO: Payroll ổn không?

Agent: 🟡 Payroll Health: 88%

Open Bugs: 2
├── #421 Timezone offset (High)
└── #398 Leap year calc (Low)

Known Risks:
├── Timezone handling
└── Overtime rounding

Last Build: PASS (2026-06-01 16:30)
Last Release: v2.1.0 (2026-05-25)

Recommendation: Fix bug #421 before next release.
```

### 5.2 Risk Query

```
CEO: Project nào nguy hiểm nhất?

Agent: 🔴 Highest Risk: Agent Core

Impact Score: 5 (5 projects depend on it)
If Agent Core fails:
├── Dashboard        ❌ Down
├── Payroll         ❌ Down
├── Review Auto     ❌ Down
├── QA Platform     ❌ Down
└── Agent Worker    ❌ Down

Status: Healthy (but critical single point of failure)
Recommendation: Add redundancy and failover.
```

### 5.3 Activity Query

```
CEO: Ai sửa Dashboard hôm nay?

Agent: Dashboard changes today (2026-06-01):

├── 14:30 - Agent OS Worker 1
│   └── Fixed auth timeout (commit abc123)
├── 15:00 - Agent OS Worker 2
│   └── Updated dependencies (commit def456)
└── 16:30 - Build completed (PASS)

Total: 2 changes, 1 build, 0 bugs introduced.
```

### 5.4 QA Query

```
CEO: QA coverage hiện tại là bao nhiêu?

Agent: 📊 Company QA Coverage: 87%

By Project:
├── Agent Core     98%  🟢
├── Review Auto    95%  🟢
├── Dashboard      92%  🟢
├── Payroll        91%  🟢
├── QA Platform    85%  🟡
├── Bakudan        78%  🟡
└── Marketing      65%  🔴

Trend: -2% this week (Bakudan dropped)
Target: 90%
Gap: 3% (need 15 more tests)
```

### 5.5 Top Risks

```
CEO: Top 10 rủi ro của công ty?

Agent: 🔴 Company Risk Register (Top 10):

1. Agent Core (P0) — Single point of failure, 5 deps
2. Payroll timezone (P0) — Wrong salary calculation
3. Auth system (P0) — Security breach risk
4. Bakudan QA decline (P1) — Coverage dropping
5. Outdated deps (P1) — 4 projects affected
6. No backup worker (P1) — If primary fails
7. Dashboard regression (P2) — Auth module
8. Marketing site (P2) — Outdated content
9. Missing DNA files (P2) — 3 projects
10. Stale snapshots (P3) — 2 projects not snapshotted

Actions Required: 3 (P0), 3 (P1), 3 (P2), 1 (P3)
```

---

## 6. Command Parser

```typescript
class CommandParser {
  parse(command: string): ParsedCommand {
    const lower = command.toLowerCase();
    
    // Health queries
    if (this.matches(lower, ['ổn không', 'health', 'sức khỏe', 'status'])) {
      const project = this.extractProject(command);
      return { intent: 'health:project', project };
    }
    
    // Risk queries
    if (this.matches(lower, ['nguy hiểm', 'rủi ro', 'risk', 'nguy cơ'])) {
      return { intent: 'query:risk' };
    }
    
    // Bug queries
    if (this.matches(lower, ['bug', 'lỗi', 'vấn đề', 'issue'])) {
      const project = this.extractProject(command);
      return { intent: 'query:bugs', project };
    }
    
    // Dependency queries
    if (this.matches(lower, ['phụ thuộc', 'dependency', 'depend'])) {
      const project = this.extractProject(command);
      return { intent: 'query:dependency', project };
    }
    
    // Activity queries
    if (this.matches(lower, ['ai sửa', 'who changed', 'hôm nay', 'today'])) {
      const project = this.extractProject(command);
      return { intent: 'history:changes', project };
    }
    
    // Root cause
    if (this.matches(lower, ['tại sao', 'why', 'nguyên nhân'])) {
      return { intent: 'analysis:root_cause', query: command };
    }
    
    // Actions
    if (this.matches(lower, ['audit', 'quét', 'scan'])) {
      return { intent: 'action:audit' };
    }
    
    // Metrics
    if (this.matches(lower, ['bao nhiêu', 'coverage', 'score'])) {
      return { intent: 'query:metrics' };
    }
    
    return { intent: 'unknown', command };
  }
}
```

---

## 7. Response Templates

### 7.1 Health Response

```
{emoji} {Project} Health: {score}%

Open Bugs: {count}
{bug_list}

Known Risks:
{risk_list}

Last Build: {status} ({date})
Last Release: {version} ({date})

Recommendation: {recommendation}
```

### 7.2 Risk Response

```
🔴 Highest Risk: {project}

Impact Score: {score}
If {project} fails:
{impact_list}

Status: {status}
Recommendation: {recommendation}
```

### 7.3 Activity Response

```
{project} changes {period}:

{activity_list}

Total: {changes} changes, {builds} builds, {bugs} bugs introduced.
```

---

## 8. CEO Chat API

### 8.1 Send Command

```
POST /api/ceo/chat
{ "command": "Payroll ổn không?" }
```

### 8.2 Get Suggestions

```
GET /api/ceo/suggestions
```

### 8.3 Get Recent Activity

```
GET /api/ceo/activity?hours=24
```

---

## 9. Integration Points

| System | Integration |
|--------|-------------|
| Knowledge Graph | Answers dependency, risk, project queries |
| Health Engine | Answers health and status queries |
| QA Platform | Answers QA coverage and test queries |
| Master Journal | Answers history and activity queries |
| Source Indexer | Answers metrics and inventory queries |
| Agent OS | Executes action commands |

---

## 10. Security

- CEO Chat requires authentication
- All commands are logged in Master Journal
- Action commands require confirmation before execution
- Destructive actions (deploy, rollback) require double confirmation
