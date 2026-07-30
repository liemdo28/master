# Accounting Role

## Role

`accounting`

The users table role enum now includes:

```sql
ENUM('ceo','admin','manager','accounting','member')
```

## Permissions

Accounting is intended for:

- Payment Verification
- Bill Verification
- Payroll Verification
- Financial Confirmation
- Financial Review

## Guardrail

Accounting does not receive system-wide admin privileges. Existing admin/manager checks are unchanged, so this role must be explicitly granted access only in verification, bill, payment, and payroll review surfaces.

## Future Role

The verification schema uses `assigned_role VARCHAR(60)` instead of a restrictive enum so future roles such as `auditor` can be added without redesigning the verification engine.
