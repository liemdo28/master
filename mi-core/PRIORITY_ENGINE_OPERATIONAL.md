# PRIORITY_ENGINE_OPERATIONAL.md
**Status:** OPERATIONAL | **Phase:** 0G | **Engine:** `src/executive-coordination/priority-engine.ts`

## Priority Rules
P0 (Company critical): revenue stopped, production down, security incident, payroll failure, outage, emergency
P1 (High impact): revenue opportunity, broken conversion, major SEO, failed workflow
P2 (Normal): content, optimization, reports, minor bug (DEFAULT)
P3 (Low): docs, documentation, refactor, cleanup, nice-to-have

## Business Rules
- Revenue impact outranks documentation
- Production outage outranks feature work
- Security outranks convenience
- Compliance outranks marketing
- CEO override is allowed but must be logged

## APIs
POST /api/coordination/priority/score | GET /api/coordination/priority/rules | POST /api/coordination/priority/override

## Certification Test
Compare: Fix website checkout button (P0/P1) > Write new blog post (P2) > Update docs (P3)
