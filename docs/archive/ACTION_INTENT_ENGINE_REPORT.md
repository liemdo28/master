# ACTION INTENT ENGINE REPORT

## Phase E1 — CERTIFIED

### Module
`server/src/execution/action-intent-engine.ts`

### Classification Schema

| Message Class | Description | Example |
|---|---|---|
| `informational_question` | CEO wants info | "QB sao rồi?", "Hôm nay có gì?" |
| `action_request` | CEO wants Mi to DO something | "Tạo bài SEO cho Raw Sushi" |
| `approval_response` | CEO responding to approval | "approve", "duyet", "cancel" |
| `dangerous_action` | High-risk action | "Deploy production", "Pay bill" |
| `followup` | Continuing conversation | "Thêm nữa", "Tiếp" |
| `unknown_clarify` | Can't determine | Unclear messages |

### Acceptance Test

Input: "Mi ơi, t muốn post 1 bài trên Raw website, thu hút SEO"

Result:
- message_class: `action_request` ✅
- domain: `seo_content` ✅
- target_entity: `Raw Sushi` ✅
- approval_required: `true` ✅
- workflow_types: `['SEO_CONTENT', 'WEBSITE_POST']` ✅

### Key Design Decisions

1. **Dangerous actions checked FIRST** — before any other classification
2. **Creation intent detection** — "t muốn", "muốn", "can" triggers action even without explicit verbs
3. **Entity resolution** — 10+ known entities with aliases (Raw Sushi, Bakudan, Maria, DoorDash, etc.)
4. **Domain-to-workflow mapping** — automatic workflow type selection based on domain

### Test Results
- 25 test cases (TC001-TC025)
- 100% pass on action vs informational distinction
- 0 false informational classifications for action requests

### Gates
- [x] ACTION_INTENT_ENGINE_CERTIFIED
