# Notification Language QA Report

**Date:** 2026-06-22
**Status:** CODE VERIFIED — PENDING PRODUCTION VERIFICATION

## Summary

Notification system supports per-user language via `preferred_locale` column in `users` table.

## Code Verification

### 1. User Language Preference
- `preferred_locale` column exists in users table (VARCHAR(10), default 'en-US')
- `user_preferred_locale($user)` function in `config/i18n.php` reads from user record
- Falls back to session/cookie locale if user has no preference set

### 2. Notification Templates (email, in-app)
- Email templates in `emails/` directory use `t()` calls for all translatable strings
- Key notification strings defined:
  - `notification.task_assigned` — "Task assigned to you"
  - `notification.task_completed` — "Task completed"
  - `notification.bill_due_reminder` — "Bill due reminder"
  - `notification.penalty_alert` — "Penalty alert"
  - `notif.task_assigned` — "New task assigned to you"
  - `notif.task_due_soon` — "Task due tomorrow"
  - `notif.task_overdue` — "Task overdue"
  - `notif.task_overdue_critical` — "Related task is :days day(s) overdue"
  - `notif.bill_due_soon` — "Bill due in 3 days"

### 3. Email Notification Strings
- `email.task_assigned_subject` — 3 languages
- `email.task_assigned_body` — 3 languages with placeholders
- `email.task_due_subject` — 3 languages
- `email.task_due_body` — 3 languages
- `email.bill_due_subject` — 3 languages
- `email.bill_due_body` — 3 languages
- `email.comment_subject` — 3 languages
- `email.comment_body` — 3 languages

### 4. Telegram Integration
- Telegram notification strings share the same `notif.*` and `email.*` keys
- Bot messages use `t()` calls with user's preferred locale

## Test Scenarios (requires manual verification)

| Scenario | Expected Behavior |
|----------|-------------------|
| Task assigned (user prefers ES) | Notification text in Spanish |
| Task overdue (user prefers VI) | Overdue alert in Vietnamese |
| Bill reminder (user prefers EN) | Email in English |
| Penalty alert (user prefers ES) | Alert text in Spanish |
| Inbox summary (user prefers VI) | Summary in Vietnamese |

## How to Set User Language

```sql
-- Set user preferred language
UPDATE users SET preferred_locale = 'es-US' WHERE id = 1;
UPDATE users SET preferred_locale = 'vi-VN' WHERE id = 2;
UPDATE users SET preferred_locale = 'en-US' WHERE id = 3;
```

Or via Settings page (preferred language selector).
