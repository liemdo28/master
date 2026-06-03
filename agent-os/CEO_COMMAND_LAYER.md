# Phase N — CEO Command Layer

## Overview

CEO Command Layer cho phép điều khiển Agent OS bằng ngôn ngữ tự nhiên.

---

## Command Interface

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
     └── Health Intent ───▶ Health Engine
     │
     ▼
Response Generation
     │
     ▼
CEO (Natural Response)
```

---

## Natural Commands

### Query Commands

```json
{
  "command": "Project nào nguy hiểm nhất hiện nay?",
  "intent": "query:risk",
  "source": "knowledge_graph",
  "response": {
    "answer": "Agent Core là project nguy hiểm nhất vì 5 projects phụ thuộc nó. Nếu nó chết, Dashboard, Payroll, Review Auto, QA Platform, và Agent Worker sẽ bị ảnh hưởng.",
    "details": {
      "project": "Agent Core",
      "impact_score": 5,
      "status": "healthy",
      "recommendation": "Ensure backup worker is available"
    }
  }
}
```

### Action Commands

```json
{
  "command": "Audit tất cả projects",
  "intent": "action:audit",
  "source": "agent_os",
  "tasks": [
    { "type": "audit", "project": "E:\\Project\\Master\\Agent" },
    { "type": "audit", "project": "E:\\Project\\Master\\Bakudan" }
  ],
  "response": {
    "status": "started",
    "estimated_time": "15 minutes",
    "tasks_created": 12
  }
}
```

### Analysis Commands

```json
{
  "command": "Tại sao Dashboard QA score giảm?",
  "intent": "analysis:qa_degradation",
  "source": "qa_platform",
  "response": {
    "root_cause": "Test coverage giảm từ 95% xuống 87% sau release v2.3.0",
    "contributing_factors": [
      "2 new bugs in auth module",
      "Missing regression tests for login flow",
      "Deprecated packages not updated"
    ],
    "recommendation": "Add 15 regression tests before next release"
  }
}
```

---

## Command Parser

```typescript
class CommandParser {
  parse(command: string): ParsedCommand {
    const lower = command.toLowerCase();
    
    // Intent: Query
    if (this.matches(lower, ['nguy hiểm', 'rủi ro', 'nguy cơ'])) {
      return { intent: 'query:risk', ... };
    }
    
    if (this.matches(lower, ['phụ thuộc', 'liên quan', 'dependency'])) {
      return { intent: 'query:dependency', ... };
    }
    
    if (this.matches(lower, ['bug', 'lỗi', 'vấn đề'])) {
      return { intent: 'query:bugs', ... };
    }
    
    // Intent: Action
    if (this.matches(lower, ['audit', 'quét', 'scan'])) {
      return { intent: 'action:audit', ... };
    }
    
    if (this.matches(lower, ['build', 'build'])) {
      return { intent: 'action:build', ... };
    }
    
    if (this.matches(lower, ['deploy', 'release'])) {
      return { intent: 'action:deploy', ... };
    }
    
    // Intent: Health
    if (this.matches(lower, ['sức khỏe', 'health', 'status'])) {
      return { intent: 'query:health', ... };
    }
    
    // Intent: Analysis
    if (this.matches(lower, ['tại sao', 'why', 'cause'])) {
      return { intent: 'analysis:root_cause', ... };
    }
    
    if (this.matches(lower, ['so sánh', 'compare'])) {
      return { intent: 'analysis:compare', ... };
    }
    
    // Default
    return { intent: 'unknown', command };
  }
}
```

---

## CEO Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  CEO COMMAND CENTER                                🟢 91%   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👋 "What can I help you with today?"                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Type a command or question...                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  SUGGESTED COMMANDS:                                        │
│  ├── "Tổng quan công ty"                                  │
│  ├── "Project nào nguy hiểm nhất?"                         │
│  ├── "Audit tất cả projects"                               │
│  ├── "QA status Dashboard"                                  │
│  └── "Có bug nào critical không?"                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                            │
│  ├── 5:30 PM - Agent Core health checked (OK)             │
│  ├── 5:15 PM - Payroll audit completed                     │
│  ├── 5:00 PM - Release blocked (security issue)            │
│  └── 4:45 PM - 3 workers online                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Response Templates

### Risk Response

```
🔴 PROJECT AT RISK: Agent Core

Impact: 5 projects depend on this
Status: Healthy (but critical)

If Agent Core fails:
├── Dashboard        ❌ Down
├── Payroll         ❌ Down
├── Review Auto     ❌ Down
├── QA Platform     ❌ Down
└── Agent Worker    ❌ Down

Recommendation:
✓ Ensure backup worker available
✓ Monitor memory usage
✓ Daily health checks
```

### Health Response

```
🟢 COMPANY HEALTH: 91%

Projects: 47 total
├── Healthy: 32 (68%)
├── Warning: 12 (26%)
└── Critical: 3 (6%)

Workers: 4/4 online

Last Issues:
├── 2:00 PM - Agent Core memory spike (resolved)
├── 3:30 PM - Payroll timeout (resolved)
└── 4:15 PM - Dashboard slow (investigating)

Top Risks:
1. Agent Core (P0)
2. Payroll (P0)
3. Auth System (P0)
```

### Analysis Response

```
📊 QA SCORE ANALYSIS: Dashboard

Current Score: 87% (was 95%)

Root Cause: Test coverage dropped after v2.3.0

Contributing Factors:
├── 2 new bugs in auth module
├── 15 missing regression tests
├── Deprecated packages detected
└── 3 critical paths untested

Recommended Actions:
1. Add regression tests (15)
2. Update deprecated packages
3. Fix auth module bugs
4. Re-run full QA suite

Estimated Effort: 4 hours

Block Release Until: Score > 90%
```

---

## Natural Language Templates

CEO có thể hỏi:

```txt
"Project nào" → Query projects
"Tại sao" → Root cause analysis
"Có gì mới" → Recent activity
"Khi nào" → Timeline/schedule
"Ai" → Ownership queries
"Bao nhiêu" → Metrics
"Ở đâu" → Location queries
"Làm sao" → Instructions
"Như thế nào" → How-to queries
"Có không" → Boolean queries
```

---

## Implementation

```typescript
class CEOService {
  async processCommand(command: string): Promise<Response> {
    // 1. Parse intent
    const parsed = this.commandParser.parse(command);
    
    // 2. Route to appropriate engine
    switch (parsed.intent) {
      case 'query:risk':
        return await this.knowledgeGraph.findRisks(parsed);
        
      case 'query:health':
        return await this.healthEngine.getStatus(parsed);
        
      case 'query:bugs':
        return await this.knowledgeGraph.findBugs(parsed);
        
      case 'action:audit':
        return await this.agentOS.runAudit(parsed);
        
      case 'action:build':
        return await this.agentOS.runBuild(parsed);
        
      case 'analysis:root_cause':
        return await this.qaPlatform.analyze(parsed);
        
      default:
        return { error: "I don't understand. Try: 'Project nào nguy hiểm nhất?'" };
    }
  }
  
  async generateResponse(data: any, intent: string): Promise<string> {
    // Use template based on intent
    const template = this.templates[intent];
    return this.templateEngine.render(template, data);
  }
}
```
