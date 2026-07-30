# N8N WORKFLOW LIBRARY (C4)
**Date:** 2026-06-24  
**Total:** 15 workflows across 5 departments

---

## EXECUTIVE (3 workflows)

### 1. Daily Executive Brief (`exec-daily-brief`)
**Schedule:** 07:00 ICT daily  
**Flow:**
1. HTTP Request → `GET /api/health` (mi-core status)
2. HTTP Request → `GET /api/company-os/services/health` (service matrix)
3. HTTP Request → `GET /api/tasks/today` (today's tasks)
4. HTTP Request → `GET /api/agenview/overview` (system state)
5. Code Node → Format WhatsApp morning briefing
6. HTTP Request → `POST /api/n8n/evidence` (return to Mi)

**Output Evidence:**
```json
{ "workflow_id": "exec-daily-brief", "status": "success",
  "evidence": ["briefing_text", "service_health_matrix", "task_count"],
  "duration_ms": 1200 }
```

### 2. Weekly Executive Brief (`exec-weekly-brief`)
**Schedule:** Monday 08:00 ICT  
**Flow:**
1. HTTP Request → `GET /api/strategic/trends` (7-day trends)
2. HTTP Request → `GET /api/improvement/report` (skill performance)
3. HTTP Request → `GET /api/company-os/pipelines` (execution history)
4. Code Node → Calculate KPIs, format weekly report
5. HTTP Request → POST evidence

### 3. Monthly Executive Report (`exec-monthly-report`)
**Schedule:** 1st of month 09:00 ICT | **Requires approval**  
**Flow:**
1. HTTP Request → accounting-engine stats
2. HTTP Request → strategic memory 30-day summary
3. HTTP Request → self-improvement 30-day report
4. Code Node → P&L summary, goal vs actual
5. HTTP Request → POST evidence with PDF flag

---

## FINANCE (3 workflows)

### 4. QuickBooks Sync (`finance-qb-sync`)
**Schedule:** Every 6 hours | **Medium risk** | **Rollback available**  
**Flow:**
1. HTTP Request → `GET /api/qb-agent/status`
2. HTTP Request → `POST /api/qb-agent/sync` (trigger pull)
3. Wait Node → 30 seconds
4. HTTP Request → `GET /api/qb-agent/transactions/latest`
5. HTTP Request → accounting-engine ingest
6. Code Node → Compare previous vs new transaction count
7. If Node → Alert if discrepancy > $500
8. HTTP Request → POST evidence

### 5. Tax Reminder (`finance-tax-reminder`)
**Schedule:** 1st and 15th of month 09:00 ICT  
**Flow:**
1. HTTP Request → `GET /api/accounting/risks` (tax exposure)
2. Code Node → Calculate days until deadline, estimated payment
3. HTTP Request → Format WhatsApp reminder
4. HTTP Request → POST evidence

### 6. Payroll Reminder (`finance-payroll-reminder`)
**Schedule:** 25th of month | **Requires approval**  
**Flow:**
1. HTTP Request → `GET /api/accounting/costs/payroll`
2. Code Node → Compare to prior month, flag anomalies
3. If Node → Route based on discrepancy
4. HTTP Request → Request CEO approval if variance > 5%
5. HTTP Request → POST evidence

---

## OPERATIONS (3 workflows)

### 7. Daily Store Health (`ops-daily-store-health`)
**Schedule:** 06:00 ICT daily  
**Flow:**
1. HTTP Request → food-safety-gateway submissions for yesterday
2. HTTP Request → Toast POS last-night sales (when connected)
3. HTTP Request → DoorDash rating/reviews check
4. Code Node → Build store health matrix (Green/Yellow/Red)
5. If Node → Alert CEO for any Red store
6. HTTP Request → POST evidence

### 8. Compliance Summary (`ops-compliance-summary`)
**Schedule:** Monday 07:00 ICT  
**Flow:**
1. HTTP Request → food-safety-gateway weekly report
2. Code Node → Calculate compliance rate per store
3. If Node → Flag stores below 100% compliance
4. HTTP Request → POST evidence

### 9. Missed Task Alert (`ops-missed-task-alert`)
**Schedule:** 14:00 ICT daily  
**Flow:**
1. HTTP Request → `GET /api/tasks/overdue`
2. Code Node → Filter tasks overdue > 24h
3. If Node → Skip if no overdue tasks
4. Code Node → Format alert with task list
5. HTTP Request → POST evidence

---

## MARKETING (3 workflows)

### 10. SEO Summary (`mkt-seo-summary`)
**Schedule:** Monday 08:00 ICT  
**Flow:**
1. HTTP Request → `GET /api/seo/weekly`
2. Code Node → Format keyword movements, traffic delta
3. HTTP Request → POST evidence

### 11. Review Summary (`mkt-review-summary`)
**Schedule:** Monday 09:00 ICT  
**Flow:**
1. HTTP Request → `GET http://localhost:8000/api/reviews/weekly` (review-api)
2. Code Node → Sentiment analysis, unanswered count
3. If Node → Alert if rating dropped
4. HTTP Request → POST evidence

### 12. Campaign Summary (`mkt-campaign-summary`)
**Schedule:** Monday 10:00 ICT  
**Flow:**
1. HTTP Request → DoorDash agent campaign metrics
2. Code Node → Calculate ROI, CPO, impressions
3. HTTP Request → POST evidence

---

## ENGINEERING (3 workflows)

### 13. PM2 Health Monitor (`eng-pm2-health`)
**Schedule:** Every 15 minutes  
**Flow:**
1. HTTP Request → `GET /api/company-os/services/health`
2. Code Node → Check for unhealthy services
3. If Node → Skip if all healthy
4. HTTP Request → `POST /api/company-os/command` {"command": "self-heal services"}
5. HTTP Request → POST evidence with alert

### 14. Build Monitor (`eng-build-monitor`)
**Schedule:** On push (webhook trigger)  
**Flow:**
1. Webhook Node → receives git push payload
2. Execute Command → `cd mi-core/server && npx tsc --noEmit`
3. If Node → Route success vs failure
4. HTTP Request → POST evidence with build status

### 15. Error Monitor (`eng-error-monitor`)
**Schedule:** Every 30 minutes  
**Flow:**
1. Read Binary Files Node → mi-core error log (last 1000 lines)
2. Code Node → Parse exceptions, classify severity
3. If Node → Skip if no new errors
4. Code Node → Format error digest
5. HTTP Request → POST evidence

---

## Evidence Return Contract (all workflows)
```json
{
  "workflow_id": "wf-id-here",
  "status": "success | error | partial",
  "evidence": ["item1", "item2"],
  "duration_ms": 1500
}
```
POST to: `http://host.docker.internal:4001/api/n8n/evidence`

**Status:** N8N_WORKFLOW_LIBRARY_READY — 15 workflows designed, 3 departments fully covered.
