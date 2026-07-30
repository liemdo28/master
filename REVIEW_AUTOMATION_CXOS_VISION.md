# Review Automation → Customer Experience Operating System
## Vision Document — Mi Core Project

---

## 1. Current State (v1 — 30–40% Complete)

Current workflow (`review-monitoring.json`) only handles:

```
Schedule (hourly)
    │
    ▼
Intake Event
    │
    ▼
Dispatch Review Check
    │
    ▼
Approval Check
    │
    ▼
Log Result
```

Limited to:
- Hourly schedule trigger (n8n)
- Mi-Core intake event
- Mi-Core dispatch task
- Mi-Core approval request
- Mi-Core workflow log

**Gap:** No connector, no normalize, no store resolver, no knowledge graph, no sentiment engine, no risk classification, no revenue impact, no department routing, no draft response, no publish, no evidence, no learning memory, no executive report.

**Existing star-rating rules preserved but not yet enforced in code** — Mi decides based on `decision_needed: "auto_reply_or_manual_review"`.

---

## 2. Target State: Customer Experience Operating System

### Full Workflow

```
Review Connector
        │
        ▼
Normalize
        │
        ▼
Store Resolver
        │
        ▼
Business Knowledge Graph
        │
        ▼
Customer History
        │
        ▼
Sentiment
        │
        ▼
Risk Classification
        │
        ▼
Revenue Impact
        │
        ▼
Department Routing
        ├── Marketing
        ├── Operations
        ├── Kitchen
        ├── HR
        ├── Finance
        │
        ▼
Draft Response
        │
        ▼
Approval Policy
        │
        ▼
Publish
        │
        ▼
Evidence
        │
        ▼
Learning Memory
        │
        ▼
Executive Report
```

### Star-Rating Rules (Preserve)

| Rating | Rule |
|--------|------|
| ⭐⭐⭐⭐⭐ | Auto reply |
| ⭐⭐⭐⭐ | Auto if confidence high, else review |
| ⭐⭐⭐ | Review required |
| ⭐⭐ | Always approval |
| ⭐ | Always approval |
| + Blacklist keywords | Always approval |

---

## 3. Business Knowledge Graph

The platform must understand **why** a review happened — not just **what** was said.

### Example: 1★ Review on DoorDash

```
Raw Sushi
    ↓
Stone Oak location
    ↓
1★ review: "Delivery took 90 minutes"
    ↓
Business Knowledge Graph traces:
        │
        ├── Store → Shift → Employee
        ├── Store → Menu
        ├── Campaign → Volume spike
        ├── Order → DoorDash → Driver
        └── Revenue impact
    ↓
Diagnosis:
        Not food quality issue
        DoorDash driver delay
        Active campaign increased volume
        Kitchen not overloaded
        Driver was the bottleneck
    ↓
Action:
        NO task for Kitchen
        Flag DoorDash logistics
        Route to Operations + Finance
```

This is what differentiates Mi from a simple reply bot.

---

## 4. Department Routing

| Trigger | Route To |
|---------|----------|
| Food quality complaint | Kitchen / Operations |
| Delivery delay | DoorDash / Operations |
| Pricing complaint | Finance |
| Staff behavior | HR |
| Marketing promise mismatch | Marketing |
| Repeat customer complaint | Customer Success |
| Health/safety issue | Operations + Legal |

---

## 5. Integration Points

| System | Role |
|--------|------|
| Google Reviews | Review source |
| Yelp | Review source |
| DoorDash | Review source + Order data |
| Facebook | Review source |
| Mi-Core | Central brain |
| Company OS | Business context |
| Knowledge Graph | Root cause analysis |
| Learning Memory | Pattern learning |
| Executive Dashboard | Visibility |

---

## 6. Value Proposition

This platform connects:

- Marketing
- Customer Experience
- Operations
- DoorDash
- Finance
- Knowledge Graph
- Learning Memory
- Executive Dashboard

Into **one unified workflow** — not just a reply bot.

---

## 7. Implementation Roadmap

### Phase 2 — Knowledge Graph Foundation (Priority: HIGH)
- [ ] Create `review-normalize.js` — standardize review format from Google/Yelp/DoorDash/Facebook
- [ ] Create `store-resolver.js` — map review location → store → shift → employee
- [ ] Create `customer-history.js` — track customer past reviews, orders, sentiment trends
- [ ] Create `review-knowledge-graph.js` — trace review → store → campaign → order → driver
- [ ] Update `review-monitoring.json` — add normalize + store resolve steps before approval check

### Phase 3 — Intelligence Layer (Priority: HIGH)
- [ ] Create `sentiment-engine.js` — classify tone, extract entities, map to topics
- [ ] Create `risk-classifier.js` — score risk (financial, operational, brand)
- [ ] Create `revenue-impact.js` — estimate revenue at risk per review
- [ ] Create `department-router.js` — route to correct department based on trigger taxonomy
- [ ] Create `draft-response.js` — generate AI draft with store context + knowledge graph data

### Phase 4 — Enforcement & Publishing (Priority: MEDIUM)
- [ ] Create `approval-policy-engine.js` — enforce star-rating rules + blacklist keyword logic
- [ ] Create `review-publisher.js` — post approved reply back to Google/Yelp/DoorDash/Facebook
- [ ] Create `evidence-store.js` — attach context (graph, draft, approval) to every reply
- [ ] Create `learning-memory.js` — write outcomes back to memory for pattern learning
- [ ] Create `executive-report.js` — daily/weekly report: volume, sentiment, routing, risk

### Phase 5 — Integration with Company OS (Priority: MEDIUM)
- [ ] Wire review events into Company OS event bus
- [ ] Surface review alerts in Executive Dashboard
- [ ] Connect Knowledge Graph to Company OS asset graph

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Auto-reply rate (5★) | >95% |
| False positive rate | <2% |
| Time to respond | <1 hour |
| Knowledge Graph accuracy | >90% |
| Department routing accuracy | >85% |
| Executive report coverage | 100% of reviews |

---

*Documented for Mi Core — Review Automation CXOS Vision*
*Last updated: 2026-06-29*