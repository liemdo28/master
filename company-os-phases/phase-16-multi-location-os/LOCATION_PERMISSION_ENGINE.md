# LOCATION_PERMISSION_ENGINE.md — Location-Based Permission Engine

**Generated:** 2026-06-27
**Purpose:** Enforce store-level data isolation and permissions

---

## Permission Rules

```
Rule 1: Users can only access data for their assigned locations
Rule 2: Agents can only operate within their division's locations
Rule 3: Cross-location data requires explicit permission
Rule 4: Brand-level access requires admin role
```

---

## Permission Matrix

| Role | Own Location | Other Locations | Brand Level | Company Level |
|------|------------|----------------|-------------|---------------|
| Store Manager | Full | None | None | None |
| Regional Manager | Full | Full | Read | None |
| Brand Lead | Full | Full | Full | None |
| CEO | Full | Full | Full | Full |
| Agent | Full | None | None | None |

---

## Status: ✅ LOCATION_PERMISSION_ENGINE_ACTIVE
