# Phase 5G Rollback

Phase 5G schema migration is additive from Personal OS schema v7 to v8.

Rollback strategy:

1. Stop using governance API/UI routes.
2. Revert the Phase 5G commit set.
3. Keep v8 tables in place; Phase 5F code ignores them.
4. Restore a pre-deploy database backup only if a production migration issue is confirmed.

No destructive rollback SQL is required for normal rollback.

Tables added:

- `policy_sets`
- `policy_rules`
- `policy_decisions`
- `action_budgets`
- `kill_switches`
- `governance_anomalies`
- `governance_events`
- `project_action_policies`
