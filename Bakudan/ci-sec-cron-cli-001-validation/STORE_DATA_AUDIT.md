# STORE DATA AUDIT

**Date:** 2026-06-22  
**Status:** ✅ PASS

## Schema Changes (migration_store_command_recovery.sql)

### New Columns Added to `stores`
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| store_code | VARCHAR(20) | NULL | Internal code (e.g., "B1", "B2") |
| store_type | ENUM('corporate','franchise') | 'corporate' | Ownership type |
| region | VARCHAR(100) | NULL | Geographic region |
| operating_hours | VARCHAR(255) | NULL | Hours of operation |
| phone | VARCHAR(30) | NULL | Contact phone |
| email | VARCHAR(255) | NULL | Contact email |
| manager_id | INT UNSIGNED | NULL | Primary manager FK |
| assistant_manager_id | INT UNSIGNED | NULL | Assistant manager FK |
| opened_at | DATE | NULL | Opening date |
| status | ENUM('active','inactive','opening_soon','closed') | 'active' | Store status |

### New Tables
- **store_manager_assignments**: Maps managers to stores (supports multi-store)
- **store_health_scores**: Historical health score records

## Required Fields Coverage

| Field | Source | Status |
|-------|--------|--------|
| Store Name | stores.name | ✅ |
| Store Code | stores.store_code | ✅ (new) |
| Store Type | stores.store_type | ✅ (new) |
| Status | stores.status | ✅ (new) |
| Region | stores.region | ✅ (new) |
| Address | stores.address | ✅ |
| Phone | stores.phone | ✅ (new) |
| Email | stores.email | ✅ (new) |
| Operating Hours | stores.operating_hours | ✅ (new) |
| Manager | stores.manager_id + users.name | ✅ (new join) |
| Assistant Manager | stores.assistant_manager_id | ✅ (new) |
| Opening Date | stores.opened_at | ✅ (new) |
| Health Score | store_health_scores.score | ✅ (computed) |
| Active Employees | tasks.assignee_id COUNT DISTINCT | ✅ (computed) |
| Open Tasks | tasks.is_completed=0 | ✅ (computed) |
| Critical Tasks | tasks.priority='urgent' | ✅ (computed) |
| Bills | bills.count WHERE store_id | ✅ |
| Unpaid Bills | bills WHERE overdue/pending | ✅ |
