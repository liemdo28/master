# MARKETING_COORDINATION_INTEGRATION

> Generated: 2026-06-26 11:27 Asia/Saigon
> Phase: 4I — Executive Coordination Integration

---

## Integration Points

| Executive Coordination Engine | Marketing Role |
|------------------------------|----------------|
| Objective Registry | Marketing objectives (e.g., "Increase Raw Sushi CTR") |
| Task Registry | MKT-* division tasks for all marketing work |
| Ownership Engine | Assign to seo-agent, content-agent, analytics-agent, local-seo |
| Priority Engine | Auto-classify based on revenue impact + urgency |
| Dependency Graph | Block tasks on data availability / approvals |
| Approval Registry | Required for any public content / spend |
| Evidence Registry | Store proof: GSC exports, GA4 screenshots, review drafts |
| Dashboard | Marketing section in Executive Coordination dashboard |

---

## Division Mapping

The Executive Coordination task system already supports a `marketing` division. This phase defines how marketing work flows through it.

### Task ID Prefix

```
MKT-{NNN}  — Marketing coordination tasks
```

---

## Signal-to-Task Examples

### Example 1: Traffic Drop

```
Signal: traffic-drop (GSC shows -15% week-over-day)
   ↓
Auto-Task Engine: createTask('traffic-drop', data)
   ↓
Executive Coordination: createTask({
  division: 'marketing',
  owner: 'seo-agent',
  priority: 'P1',
  description: 'Organic traffic dropped >15% week-over-day',
  approvalRequired: 'none'
})
   ↓
GSC + GBP evidence required
   ↓
Task assigned to seo-agent
   ↓
Dashboard alert
   ↓
On resolution: status → completed, evidence stored
```

### Example 2: Negative Review

```
Signal: review-drop or 1-2 star new review
   ↓
Auto-Task Engine: createTask('review-drop')
   ↓
Executive Coordination: createTask({
  division: 'marketing',
  owner: 'review-management',
  priority: 'P2',
  description: 'New 1-2 star review detected',
  approvalRequired: 'merge'
})
   ↓
MKT task created + approval request sent
   ↓
After CEO approval: post response → evidence stored
```

### Example 3: New Campaign

```
Marketing Lead proposes campaign
   ↓
Executive Coordination: createTask({
  division: 'marketing',
  owner: 'marketing-lead',
  title: 'Launch Raw Sushi June Promo Campaign',
  description: 'Targeted DoorDash promotion for slow hours',
  approvalRequired: 'financial',
  status: 'awaiting-approval'
})
   ↓
Dependencies: ['doordash-credentials-available', 'toast-attribution-ready']
   ↓
Once approved → status = approved → execute
   ↓
UTM tagged, deployed, tracked
   ↓
Weekly report → evidence stored
```

---

## Approval Type Mapping

| Marketing Action | Approval Required | Type |
|-----------------|-------------------|------|
| Publish blog post | YES | merge |
| Publish landing page | YES | merge |
| Send email blast | YES | financial |
| Post social content | YES | merge |
| Post GBP update | YES | merge |
| Respond to review | YES | merge |
| Spend on ads | YES | financial |
| DoorDash campaign change | YES | financial |
| Internal data analysis | NO | none |
| Internal dashboard update | NO | none |
| UTM convention update | NO | none |

---

## Evidence Requirements

| Task Type | Evidence Required |
|-----------|-------------------|
| Campaign execution | brief, UTM plan, before/after KPI snapshots |
| Content publish | keyword research, draft, QA report, live URL |
| Review response | original review text, AI draft, CEO approval, posted response |
| Data integration | connector source, credentials (masked), first sync output |
| Brand score update | formula inputs, calculation log |

---

## Dashboard Section Sketch

```
MARKETING DIVISION
─────────────────
Active Tasks:     7
Blocked:          2 (GA4 deploy, GBP re-auth)
Awaiting Approval: 1
Completed (7d):   12
Top KPI:          Raw Sushi CTR 1.3% (target 2.0%)
Brand Scores:     Bakudan 72 / Raw Sushi 61
```

---

## Final Status

```text
MARKETING_COORDINATION_INTEGRATION_DEFINED