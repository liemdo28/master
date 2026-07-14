# SEO Route Security Matrix

Date: 2026-07-13
Verdict scope: controlled preview / disabled production load only.

All routes mounted under `/api/seo` pass through:

- `seoRateLimiter`: 90 requests/minute per standard express-rate-limit key.
- `requireSeoAccess`: strict Bearer session auth, no localhost bypass.
- Audit log: `reports/evidence/seo-security/seo-auth-audit.jsonl`.
- Read routes require `view`.
- Mutation routes require CSRF via `x-csrf-token`.
- Brand scope is checked when `brand_id` or `brandId` is present in params/body/query.
- Location scope is checked when `location_id` or `locationId` is present in params/body/query.

## Role Summary

| Role | Permission summary |
|---|---|
| SEO_VIEWER | `view` |
| SEO_MANAGER | `view`, keyword/brief/draft/audit/GBP draft/backlink evaluation |
| ADMIN | SEO_MANAGER plus schedule, connector, brand-config, non-production approval |
| CEO | ADMIN plus production, policy, rollback, GBP core-data approvals |

## Route Inventory

| Method | Path | Auth | Roles | Permission | CSRF | Approval | Brand Scope | Location Scope | Rate Limit | Audit Event |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/seo/brands` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/brands/:brandId` | Bearer session | all roles | `view` | no | no | yes | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/brands/:brandId/dashboard` | Bearer session | all roles | `view` | no | no | yes | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/brands/:brandId/locations` | Bearer session | all roles | `view` | no | no | yes | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/brands/:brandId/kpis` | Bearer session | all roles | `view` | no | no | yes | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/brands/:brandId/issues` | Bearer session | all roles | `view` | no | no | yes | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/brands/:brandId/opportunities` | Bearer session | all roles | `view` | no | no | yes | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/brands/:brandId/connectors/status` | Bearer session | all roles | `view` | no | no | yes | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/dashboard` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/kpis` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/locations` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/data-sources` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/agents/register` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/agents/:id/health` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/agents/:id/status` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/agents/:id/reports` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/dashboard/:id` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/agents/:id/tasks` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/agents/:id/config` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/agents/:id/status` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/agents` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/agents/:id/sync` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/tasks` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/tasks/:taskId/complete` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/reports/latest` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/sync-logs` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/connectors/status` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/connectors/run` | Bearer session | ADMIN, CEO | `manage_connectors` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/connectors/latest` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/issues` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/issues` | Bearer session | all roles | `view` | no | no | query when present | query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/opportunities` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/opportunities` | Bearer session | all roles | `view` | no | no | query when present | query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/orchestrator/run/:jobId` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/orchestrator/status` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/orchestrator/jobs` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/config/reload` | Bearer session | ADMIN, CEO | `manage_brand_config` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/keywords` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/keywords/discover` | Bearer session | SEO_MANAGER, ADMIN, CEO | `create_keyword` | yes | no | body `brand_id` | body `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/keywords/cluster` | Bearer session | SEO_MANAGER, ADMIN, CEO | `create_keyword` | yes | no | body `brand_id` | body `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/keywords/:id/approve` | Bearer session | SEO_MANAGER, ADMIN, CEO | `create_keyword` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/cannibalization` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/cannibalization` | Bearer session | SEO_MANAGER, ADMIN, CEO | `approve_non_production` | yes | no | body/query `brand_id` | body/query `location_id` | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/clusters` | Bearer session | all roles | `view` | no | no | query `brand_id` | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/clusters/generate` | Bearer session | SEO_MANAGER, ADMIN, CEO | `run_audit` | yes | no | body `brand_id` | body `location_id` when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/facts` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/facts` | Bearer session | SEO_MANAGER, ADMIN, CEO | `edit_draft` | yes | no | body `brand_id` | body `location_id` | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/facts/:id/verify` | Bearer session | SEO_MANAGER, ADMIN, CEO | `edit_draft` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/facts/check-claims` | Bearer session | SEO_MANAGER, ADMIN, CEO | `edit_draft` | yes | no | body `brand_id` | body `location_id` | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/keywords/classify-intent` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/internal-links` | Bearer session | all roles | `view` | no | no | query `brand_id` | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/internal-links/analyze` | Bearer session | SEO_MANAGER, ADMIN, CEO | `run_audit` | yes | no | body/query `brand_id` | body/query `location_id` | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/backlinks` | Bearer session | all roles | `view` | no | no | query `brand_id` | no | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/backlinks/evaluate` | Bearer session | SEO_MANAGER, ADMIN, CEO | `create_backlink_evaluation` | yes | no | body/query `brand_id` | body/query `location_id` | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/backlinks/:id/approve` | Bearer session | CEO | `production_approval` | yes | yes, fresh `approval_id` | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/backlinks/:id/reject` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/local` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/local/:locationId` | Bearer session | all roles | `view` | no | no | query `brand_id` | param `locationId` | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/local/:locationId/audit` | Bearer session | SEO_MANAGER, ADMIN, CEO | `run_audit` | yes | no | body/query `brand_id` | body/query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/local/:locationId/gbp-sync` | Bearer session | CEO | `gbp_core_data_approval` | yes | yes, fresh `approval_id` | body/query `brand_id` | body/query `location_id` when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/gbp/posts` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/gbp/posts/generate` | Bearer session | SEO_MANAGER, ADMIN, CEO | `create_gbp_post_draft` | yes | no | body `brand_id` | body `location_id` | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/gbp/posts/:id/approve` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/gbp/posts/:id/publish` | Bearer session | CEO | `production_approval` | yes | yes, fresh `approval_id` | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/publish/:brandId/preview` | Bearer session | SEO_MANAGER, ADMIN, CEO | `edit_draft` | yes | no | param `brandId` | body/query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/publish/:brandId/:snapshotId/publish` | Bearer session | CEO | `production_approval` | yes | yes, fresh `approval_id` | param `brandId` | body/query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/publish/:brandId/:snapshotId/rollback` | Bearer session | CEO | `rollback_approval` | yes | yes, fresh `approval_id` | param `brandId` | body/query `location_id` when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/reports` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` when present | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/reports/generate` | Bearer session | ADMIN, CEO | `approve_non_production` | yes | no | body/query `brand_id` | body/query `location_id` when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/evidence` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` when present | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/policy` | Bearer session | all roles | `view` | no | no | no | no | SEO standard | `seo_auth_allowed` |
| GET | `/api/seo/calendar` | Bearer session | all roles | `view` | no | no | query `brand_id` | query `location_id` | SEO standard | `seo_auth_allowed` |
| POST | `/api/seo/calendar/items` | Bearer session | ADMIN, CEO | `manage_schedule` | yes | no | body `brand_id` | body `location_id` | SEO standard | `seo_auth_allowed` |
| PATCH | `/api/seo/calendar/items/:id` | Bearer session | ADMIN, CEO | `manage_schedule` | yes | no | body/query when present | body/query when present | SEO standard | `seo_auth_allowed` |

## Certification Notes

- No mutation route is intentionally anonymous.
- No mutation route is allowed without CSRF.
- Production-impacting actions require CEO-only permission and a fresh approved approval gate action.
- Google connector live-data routes remain degraded while OAuth returns `invalid_grant`; dashboards must show Google-derived metrics as blocked, stale, or unavailable.
## PR #37 Security Review Remediation

Status: CHANGES_REQUIRED for full production readiness after the PR #37 authorization fixes and Round 2 hardening.

Auth:
- `POST /auth/login` assigns SEO role and scope only from trusted server-side mapping (`MI_AUTH_USER_MAP_JSON`) or trusted environment defaults.
- The selected mapped identity is server-selected through `MI_AUTH_DEFAULT_USER`; request body `user_id` and `username` are ignored and cannot select a more privileged mapping.
- Request body `role`, `brand_scope`, and `location_scope` are not trusted and cannot expand privileges.
- Invalid trusted roles and missing trusted user mappings fail closed.
- SEO routes require `Authorization: Bearer`; `?token=` is rejected for `/api/seo/*`.

Approval binding:
- High-risk SEO approval checks now require an SEO approval binding record keyed by approval ID.
- The binding covers category, action key, target, brand, optional location, optional actor, optional payload hash, and consumption metadata.
- Approval freshness is measured from `approval_queue.resolved_at`, not `created_at`.
- Bound approvals are claimed before route side effects run, then transition through READY, CLAIMED, EXECUTING, SUCCEEDED, FAILED, FINALIZATION_FAILED, CANCELLED, STALE, or MANUAL_RECONCILED.
- `consumed_at` and generic approval execution are written only after successful operation finalization.
- Operation success plus finalization failure returns `operation_succeeded_finalize_failed`, stores execution evidence, marks `FINALIZATION_FAILED`, disables automatic retry, and requires CEO reconciliation.
- Actor and payload bindings are strict: if either side has an actor or payload hash mismatch or omission, the approval is rejected.
- Payload hashes are stable canonical JSON hashes rather than order-sensitive `JSON.stringify` hashes.
- Legacy unbound approvals are rejected for SEO high-risk operations.

Resource-aware scope:
- Object-ID mutation routes resolve canonical resource scope from SQLite before permission is granted.
- Protected resources include publish snapshots, GBP SEO actions, backlinks, content calendar items, keywords, business facts, and local-location operations.
- Client-supplied brand/location fields cannot override stored resource scope.

Unknown mutation policy:
- Mutation routes under `/api/seo/*` must match an explicit policy entry.
- Unknown `POST`, `PATCH`, `PUT`, or `DELETE` paths fail closed with `seo_route_policy_missing`.

Audit durability:
- Authorization audit events record role, hashed session identifier, method, normalized route, resource, brand/location, permission, approval ID, and decision.
- Read-only routes may continue if audit persistence is unavailable.
- High-risk mutation routes block with `seo_audit_unavailable` if the authorization allow decision cannot be durably audited.
