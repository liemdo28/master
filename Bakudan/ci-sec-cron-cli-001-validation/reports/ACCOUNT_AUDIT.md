# Phase 12.4 Account Audit

Generated: 2026-05-31 15:40 Asia/Ho_Chi_Minh

Evidence:
- `reports/phase12_4/logs/server_audit_20260531_152101.txt`
- `reports/phase12_4/screenshots/preview/admin_login.png`
- `reports/phase12_4/screenshots/preview/manager_login.png`
- `reports/phase12_4/screenshots/preview/member_login.png`

## SQL Export

```sql
SELECT id,name,email,role,status
FROM users
ORDER BY role,id;
```

Actual schema uses `is_active` as account status.

| ID | Name | Email | Role | Active | Last Login | Store Assignment |
|---:|---|---|---|---|---|---|
| 1 | admin | liem.dt0208@gmail.com | admin | Active | 2026-05-13 10:14:04 | None |
| 3 | Hoang Le | hoangdle@gmail.com | manager | Active | 2026-05-30 14:13:08 | None |
| 4 | Nguyễn Nguyên | nkthanhnguyen09@gmail.com | staff | Active | 2026-05-28 09:53:45 | None |
| 6 | David | ccdave20@yahoo.com | staff | Active | Never | None |
| 7 | Miles | yurimotohaliwell@yahoo.com | staff | Active | Never | None |
| 8 | Omar | omarmm81@gmail.com | staff | Active | Never | None |
| 9 | Edgar | enavarro@bakudanramen.com | staff | Active | Never | None |

## Canonical Accounts

| Account Type | Email | Role | Status |
|---|---|---|---|
| CEO | liem.dt0208@gmail.com | admin | Active; no separate `ceo` role account exists |
| Admin | liem.dt0208@gmail.com | admin | Active |
| Manager | hoangdle@gmail.com | manager | Active |
| Member | nkthanhnguyen09@gmail.com | staff | Active |

## Password Reset

Admin Account: admin  
Email: liem.dt0208@gmail.com  
Temporary Password: 123456  
Password Change Required: YES

Evidence:
- Production admin reset timestamp: `2026-05-31 15:20:36`
- Preview QA passwords set for ids `1`, `3`, `4` at `2026-05-31 15:20:36`

Note: the database has `password_reset_at` and `password_reset_by`, but no enforced `force_password_change` column. Password change requirement is therefore an operational requirement after login, not a verified application-enforced gate.
