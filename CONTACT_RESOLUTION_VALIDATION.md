# CONTACT_RESOLUTION_VALIDATION
**Generated:** 2026-06-09

## Resolution Pipeline Tests

### Test 1: Known team member (PeopleMemory → direct hit)
```
Input: "Maria"
→ PeopleMemory.resolve("Maria") → { name: "Maria", role: "manager", id: "maria" }
→ contacts.json → { email: "maria@rawsushibar.com" }
→ { email: "maria@rawsushibar.com", source: "people_memory", resolved: true }
✅ PASS
```

### Test 2: Unknown external contact
```
Input: "David"
→ PeopleMemory → no match
→ contacts.json → no match
→ Gmail history cache → no match (not configured)
→ { resolved: false, message: "Email của David là gì? Mi sẽ lưu lại để lần sau." }
✅ PASS — asks CEO instead of guessing
```

### Test 3: Ambiguous contact
```
Input: "John" (multiple John entries in contacts.json)
→ PeopleMemory → no match
→ contacts.json → 2 matches: [John Smith, John Doe]
→ { ambiguous: true, candidates: [...], message: "Tìm thấy 2 người tên John. CEO chọn ai?" }
✅ PASS — never auto-picks when ambiguous
```

### Test 4: Vietnamese nickname resolution
```
Input: "Nguyên"
→ PeopleMemory aliases: ["nguyen", "nguyên", "nguyên staff"]
→ Match: { name: "Nguyên", role: "staff" }
✅ PASS — diacritics handled
```

### Test 5: Self-reference
```
Input: "tôi" / "anh" / "ceo"
→ PeopleMemory.resolve → { id: "ceo", name: "CEO" }
→ Returns CEO profile
✅ PASS
```

## Contact Save Flow
```
CEO provides email for unknown contact:
"David's email is david@company.com"
→ ContactResolver.save({ name: "David", email: "david@company.com", source: "ceo_provided" })
→ Persisted to contacts.json
→ Next resolve("David") → hits contacts.json → resolved: true
✅ PASS — contacts persist across sessions
```

## Security Rules
- Emails from Gmail history never saved without consent
- Ambiguous contacts never auto-resolved — always asks CEO
- No email addresses leaked in logs or responses (only shown in approval drafts)
- CEO email never stored as a contact (self-reference excluded)

---
CONTACT_RESOLUTION_VALIDATION_COMPLETE
