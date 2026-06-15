# MI_SKILLS_REPORT

Generated: 2026-06-12
Status: PASS

## Summary

6 new structured skills added for restaurant operations and CEO workflows.
Skills route BEFORE human assistant layer to ensure priority matching.

## Skills

| Skill | Category | Approval | Trigger Examples |
|---|---|---|---|
| food-safety-summary | restaurant-ops | No | "food safety summary", "vệ sinh thực phẩm" |
| task-proposal | project-management | **Yes** | "tạo task cho Maria", "giao task" |
| action-item-extraction | project-management | No | "action items từ cuộc họp", "trích xuất" |
| manager-briefing | executive | No | "daily briefing hôm nay", "tóm tắt hôm nay" |
| store-status | restaurant-ops | No | "store status bakudan", "cửa hàng hôm nay" |
| compliance-summary | compliance | No | "compliance summary", "health code" |

## Routing Order

```
POST /api/whatsapp/mi
  → Approval commands (/mi approve/reject)
  → findSkill(normalized)           ← skills have priority
  → handleMiHumanAssistant()        ← fallback
  → routeCeoCommand()               ← structured CEO commands
  → runPipeline()                   ← Ollama AI
```

## Approval Flow (task-proposal)

1. CEO sends "tạo task cho Maria..."
2. `findSkill` → `task-proposal` → `requires_approval: true`
3. `enqueue()` creates approval item in gate
4. Reply includes Approval ID + `/mi approve <ID>` instruction
5. CEO sends `/mi approve <ID>` → task executed

## Validation Results

| Skill | Test Message | Result |
|---|---|---|
| food-safety-summary | "food safety summary" | PASS (skill_food-safety-summary) |
| task-proposal | "tạo task cho Maria..." | PASS (approval_required=true) |
| action-item-extraction | "action items từ cuộc họp" | PASS (skill_action-item-extraction) |
| manager-briefing | "daily briefing hôm nay" | PASS (skill_manager-briefing) |
| store-status | "store status bakudan hôm nay" | PASS (skill_store-status) |
| compliance-summary | "compliance summary tháng này" | PASS (skill_compliance-summary) |

## Verdict: PASS — 6/6 skills operational
