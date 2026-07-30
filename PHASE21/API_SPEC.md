# Phase 21 — API Endpoints Specification

## Executive API Routes

### 1. GET /api/executive/snapshot

Full executive view data - the primary endpoint for the landing screen.

**Response:**
```json
{
  "executive": {
    "greeting": {
      "time": "evening",
      "message": "Everything is healthy.",
      "status": "healthy"
    },
    "health": [...],
    "missions": [...],
    "insights": [...],
    "approvals": [...],
    "timeline": [...]
  },
  "meta": {
    "generated_at": "2026-06-29T22:02:00Z",
    "cache_ttl": 30
  }
}
```

### 2. GET /api/executive/health

Business health grid data.

**Response:**
```json
{
  "departments": [
    {
      "id": "revenue",
      "name": "Revenue",
      "icon": "$",
      "status": "healthy",
      "metric": "+12%",
      "change": "+12%",
      "trend": "up",
      "description": "DoorDash Campaign A performing well"
    }
  ]
}
```

### 3. GET /api/executive/missions

Today's mission center data.

**Response:**
```json
{
  "missions": [
    {
      "id": "m1",
      "title": "Review DoorDash Weekly Report",
      "priority": "critical",
      "department": "Marketing",
      "due": "2026-06-29T14:00:00Z",
      "estimatedMinutes": 5,
      "description": "Campaign #3 is underperforming",
      "state": "pending"
    }
  ],
  "summary": {
    "critical": 2,
    "important": 5,
    "normal": 12,
    "total": 19
  },
  "estimatedMinutes": 14
}
```

### 4. GET /api/executive/insights

AI recommendations and insights.

**Response:**
```json
{
  "insights": [
    {
      "id": "i1",
      "type": "marketing",
      "title": "DoorDash Campaign #3 is underperforming",
      "rootCause": "CPC increased by 45% while conversion rate dropped 12%",
      "recommendation": "Pause Campaign #3 and reallocate budget to Campaign #1",
      "impact": "Potential savings: $1,200/week",
      "confidence": 87,
      "dismissed": false
    }
  ]
}
```

### 5. GET /api/executive/approvals

Pending approvals.

**Response:**
```json
{
  "approvals": [
    {
      "id": "a1",
      "title": "DoorDash Campaign Budget Increase",
      "department": "Operations",
      "requestedBy": "Dev1",
      "requestedAt": "2026-06-29T20:02:00Z",
      "priority": "high",
      "current": "$500/week",
      "requested": "$750/week",
      "change": "+50%",
      "reason": "Campaign #1 is exceeding targets. We need more budget to scale.",
      "evidence": [
        { "type": "report", "title": "Campaign Performance", "url": "/reports/campaign.pdf" }
      ]
    }
  ],
  "count": 2,
  "estimatedMinutes": 4
}
```

### 6. GET /api/executive/timeline

Activity timeline.

**Query Params:** `?from=2026-06-29&limit=50`

**Response:**
```json
{
  "timeline": [
    {
      "id": "t1",
      "timestamp": "2026-06-29T22:02:00Z",
      "type": "workflow",
      "title": "DoorDash optimized",
      "description": "Campaign #1 budget adjusted +$200",
      "url": "/details/t1"
    }
  ]
}
```

### 7. POST /api/executive/approvals/:id/action

Take action on an approval.

**Request:**
```json
{
  "action": "approve",
  "comment": "Approved. Let's scale."
}
```

**Actions:** `approve`, `reject`, `delegate`, `request_changes`, `snooze`

## Project & Connector APIs

### 8. GET /api/projects/health

Project health overview.

**Response:**
```json
{
  "projects": [
    {
      "id": "doordash",
      "name": "DoorDash Operations",
      "status": "healthy",
      "lastAction": "2026-06-29T22:00:00Z",
      "workflows": {
        "active": 4,
        "queued": 1,
        "failed": 0
      }
    }
  ]
}
```

### 9. GET /api/connectors/health

Connector status grid.

**Response:**
```json
{
  "connectors": [
    {
      "id": "whatsapp",
      "name": "WhatsApp",
      "status": "healthy",
      "lastMessage": "2026-06-29T22:01:00Z"
    },
    {
      "id": "quickbooks",
      "name": "QuickBooks",
      "status": "offline",
      "lastSync": "2026-06-29T18:29:00Z",
      "error": "Desktop app offline"
    }
  ]
}
```

## WebSocket Events

### Connection
`ws://host/ws`

### Subscribe
```json
{ "type": "subscribe", "channels": ["health", "missions", "approvals"] }
```

### Events

| Event | Payload |
|-------|---------|
| `health.update` | `{ department: string, status: string }` |
| `mission.complete` | `{ mission_id: string }` |
| `mission.update` | `{ mission: Mission }` |
| `approval.required` | `{ approval_id: string }` |
| `approval.action` | `{ approval_id: string, action: string }` |
| `insight.new` | `{ insight: Insight }` |
