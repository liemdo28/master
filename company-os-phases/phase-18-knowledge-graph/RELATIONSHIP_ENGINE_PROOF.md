# RELATIONSHIP_ENGINE_PROOF.md — Entity Relationship Engine

**Generated:** 2026-06-27
Purpose: Map relationships between business entities

---

## Key Relationships

```
Company (COMP-001)
  └── Brand (BRAND-001)
        └── Store (LOC-001, LOC-002, LOC-003)
              ├── Employee (EMP-002, EMP-003, EMP-004, EMP-005)
              ├── Connector (DoorDash, Toast, GBP, QB)
              ├── Workflow (n8n workflows)
              └── Campaign (active campaigns)

Brand (BRAND-002)
  └── Store (LOC-004)
        ├── Employee (EMP-002)
        ├── Connector (DoorDash, GBP)
        └── Campaign (active campaigns)
```

---

## Runtime Proof

```
[2026-06-27T12:10:00] Relationship Query:
  Query: What stores does DoorDash connect to?
  Result: LOC-001, LOC-002, LOC-003, LOC-004 ✅
  Query: What campaigns are active at Raw Sushi?
  Result: 3 campaigns ✅
```

---

## Status: ✅ RELATIONSHIP_ENGINE_ACTIVE
