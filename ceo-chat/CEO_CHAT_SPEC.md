# CEO CHAT SPEC

**Phase 8 of Master Intelligence Layer**

## Purpose

Natural language interface for the CEO to query, control, and understand the entire company without reading source code or attending meetings.

## Interface Architecture

```
CEO (Natural Language)
       │
       ▼
Command Parser (Intent Classification)
       │
       ├── Query Intent ──────▶ Knowledge Graph
       ├── Health Intent ────▶ Health Engine
       ├── Action Intent ─────▶ Agent OS / QA Platform
       ├── Analysis Intent ───▶ QA Platform / Journal
       └── Review Intent ─────▶ Review Board
       │
       ▼
Response Generator
       │
       ▼
CEO (Natural Response + Data)
```

## Command Categories

### Query Commands
Ask questions about projects, people, risks, bugs, dependencies.

| Example | Intent | Source |
|---------|--------|--------|
| "Project nào nguy hiểm nhất?" | query:risk | Knowledge Graph |
| "Ai sửa Dashboard hôm nay?" | query:activity | Master Journal |
| "Tại sao Payroll vừa thay đổi?" | query:change | Knowledge Graph |
| "QA coverage hiện tại là bao nhiêu?" | query:qa | Health Engine |
| "Có bug critical nào không?" | query:bugs | Knowledge Graph |
| "Project nào dùng Agent Core?" | query:dependencies | Knowledge Graph |

### Action Commands
Trigger operations across the company.

| Example | Intent | Action |
|---------|--------|--------|
| "Audit tất cả projects" | action:audit | Trigger QA audit |
| "Build Dashboard" | action:build | Run build |
| "Deploy Payroll" | action:deploy | Run deploy |
| "Tạo snapshot cho Agent OS" | action:snapshot | Create snapshot |
| "Chạy smoke test cho Bakudan" | action:test | Run QA |

### Analysis Commands
Deep dive into specific issues.

| Example | Intent | Source |
|---------|--------|--------|
| "Tại sao Dashboard QA giảm?" | analysis:degradation | QA Platform |
| "Root cause của bug #421?" | analysis:root_cause | Knowledge Graph |
| "So sánh Dashboard và Payroll" | analysis:compare | Health Engine |

### Health Commands
Check company and project health.

| Example | Intent | Source |
|---------|--------|--------|
| "Công ty có khỏe không?" | health:overview | Health Engine |
| "Payroll ổn không?" | health:project | Health Engine |
| "Workers đang online không?" | health:infra | Health Engine |

## Intent Parser

```typescript
class IntentParser {
  parse(command: string): ParsedCommand {
    const lower = command.toLowerCase();
    
    // Risk queries
    if (this.matches(lower, ['nguy hiểm', 'rủi ro', 'nguy cơ'])) {
      return { intent: 'query:risk', ... };
    }
    
    // Activity queries
    if (this.matches(lower, ['ai', 'sửa', 'thay đổi', 'hôm nay'])) {
      return { intent: 'query:activity', ... };
    }
    
    // Health queries
    if (this.matches(lower, ['khỏe', 'health', 'status', 'ổn'])) {
      return { intent: 'health:overview', ... };
    }
    
    // Action queries
    if (this.matches(lower, ['audit', 'quét'])) {
      return { intent: 'action:audit', ... };
    }
    
    // Analysis queries
    if (this.matches(lower, ['tại sao', 'tại sao', 'why', 'root cause'])) {
      return { intent: 'analysis:root_cause', ... };
    }
    
    // Default
    return { intent: 'unknown', command };
  }
}
```

## Response Templates

### Risk Response
```
🔴 PROJECT AT RISK: Payroll

Impact: Finance department affected
Health: 72% (Critical)
Status: Active

Known Issues:
• 1 open bug (P0 - Timezone)
• QA coverage: 71%

Last Action:
• Bug reported: 2 hours ago
• Owner notified: 1 hour ago

Recommendation:
Fix timezone bug before next release
```

### Health Overview
```
🟢 COMPANY HEALTH: 88%

Projects: 47 total
├── Healthy: 32 (68%)
├── Warning: 12 (26%)
└── Critical: 3 (6%)

Workers: 3/3 online

Open Risks: 7
Blocked Releases: 1
Critical Bugs: 0

Top Risks:
1. Payroll (P0) - Timezone bug
2. Agent Core (P0) - Memory usage
3. Dashboard (P1) - QA score drop
```

### Activity Response
```
📋 TODAY'S ACTIVITY

Agent OS:
• 5:30 PM - Build completed (PASS)
• 4:15 PM - Task completed: Index Dashboard

Dashboard:
• 5:00 PM - QA run started
• 3:30 PM - Bug fixed #421

Payroll:
• 2:00 PM - Release blocked (security gate)
• 11:00 AM - Deploy completed (v2.1.0)
```

## CEO Dashboard UI

```
┌─────────────────────────────────────────────────────────────────┐
│  CEO COMMAND CENTER                                      🟢 88% │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  "What can I help you with today?"                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Type a command or question...                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  SUGGESTED:                                                    │
│  ├── "Tổng quan công ty"                                       │
│  ├── "Project nào nguy hiểm nhất?"                             │
│  ├── "Có bug nào critical không?"                              │
│  └── "QA coverage hiện tại?"                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                                │
│  ├── 5:30 PM - Agent Core health checked (OK)                  │
│  ├── 5:15 PM - Payroll audit completed                         │
│  ├── 5:00 PM - Release blocked (security)                      │
│  └── 4:45 PM - Dashboard QA started                            │
└─────────────────────────────────────────────────────────────────┘
```

## Command Router

```typescript
class CommandRouter {
  async route(parsed: ParsedCommand): Promise<Response> {
    switch (parsed.intent) {
      // Knowledge Graph queries
      case 'query:risk':
        return await this.knowledgeGraph.findRisks(parsed);
      case 'query:dependencies':
        return await this.knowledgeGraph.findDependencies(parsed);
      case 'query:bugs':
        return await this.knowledgeGraph.findBugs(parsed);
      case 'query:activity':
        return await this.journal.getRecentActivity(parsed);
        
      // Health queries
      case 'health:overview':
        return await this.healthEngine.getOverview(parsed);
      case 'health:project':
        return await this.healthEngine.getProjectHealth(parsed);
        
      // Action commands
      case 'action:audit':
        return await this.qaPlatform.runAudit(parsed);
      case 'action:build':
        return await this.agentOS.runBuild(parsed);
      case 'action:deploy':
        return await this.agentOS.runDeploy(parsed);
        
      // Analysis
      case 'analysis:root_cause':
        return await this.knowledgeGraph.findRootCause(parsed);
      case 'analysis:degradation':
        return await this.qaPlatform.analyzeDegradation(parsed);
        
      default:
        return { error: "I don't understand. Try: 'Project nào nguy hiểm nhất?'" };
    }
  }
}
```

## Architecture

```
ceo-chat/
├── index.js              # Main entry
├── parser.js             # Intent parsing
├── router.js             # Command routing
├── templates/            # Response templates
│   ├── risk-template.md
│   ├── health-template.md
│   ├── activity-template.md
│   └── analysis-template.md
├── ui/
│   ├── dashboard.html    # Web dashboard
│   ├── dashboard.css
│   └── dashboard.js
├── config/
│   └── commands.yaml     # Command definitions
└── README.md
```

## Supported Languages

- Vietnamese (primary)
- English

Command parser recognizes both languages and returns responses in the same language as the query.

## Success Criteria

- [ ] CEO can ask any question about the company
- [ ] Responses are natural and actionable
- [ ] Actions can be triggered via chat
- [ ] Dashboard provides visual overview
- [ ] Supports Vietnamese and English
- [ ] CEO never needs to read source code to understand the company
