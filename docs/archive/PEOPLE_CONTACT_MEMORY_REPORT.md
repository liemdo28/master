# PEOPLE_CONTACT_MEMORY_REPORT
**Generated:** 2026-06-09

## PeopleMemory Built-in Profiles

| ID | Name | Role | Stores | Aliases |
|---|---|---|---|---|
| `maria` | Maria | Manager | raw-sushi, bakudan | maria, maria manager |
| `hoang` | Hoang | Operations | raw-sushi | hoang, hoàng, hoang ops |
| `nguyen` | Nguyên | Staff | raw-sushi, bakudan | nguyen, nguyên, nguyên staff |
| `ceo` | CEO (Anh) | Owner | raw-sushi, bakudan | anh, tôi, ceo, sen, owner |

## ContactResolver Resolution Order

```
resolve("Maria")
  → Step 1: PeopleMemory.resolve("Maria") → { name: "Maria", role: "manager" }
  → Step 2: contacts.json lookup → { email: "maria@rawsushibar.com" }
  → Return: { email, name, source: "people_memory", resolved: true }

resolve("David")
  → Step 1: PeopleMemory → no match
  → Step 2: contacts.json → check work contacts
  → Step 3: Gmail history cache → find emails from David
  → Step 4: None found → return { resolved: false, message: "Email của David là gì?" }
```

## Ambiguous Contact Handling

```
resolve("John")
  → PeopleMemory: no match
  → contacts.json: [John Smith (john@co.com), John Doe (johnd@other.com)]
  → Return {
      ambiguous: true,
      candidates: [{ name: "John Smith", email: "..." }, ...],
      message: "Tìm thấy 2 John. CEO chọn ai?"
    }
```

## Contact Persistence

New contacts learned during action workflows → saved to `contacts.json`:
```json
{
  "contacts": [
    { "name": "David", "email": "david@example.com", "source": "ceo_provided", "added": "2026-06-09" }
  ]
}
```

## People Data Used in Pipeline

`resolvePerson(text)` called in `response-pipeline.ts` section 4b2:
- Injects person context into AI prompt
- "Person: Maria — role: Manager, stores: Raw Sushi + Bakudan"
- Helps AI understand who CEO is talking about

## getByStore() Function

```
PeopleMemory.getByStore("raw-sushi")
→ [Maria (Manager), Hoang (Ops), Nguyên (Staff)]

PeopleMemory.getByStore("bakudan")  
→ [Maria (Manager), Nguyên (Staff)]
```

---
PEOPLE_CONTACT_MEMORY_COMPLETE
