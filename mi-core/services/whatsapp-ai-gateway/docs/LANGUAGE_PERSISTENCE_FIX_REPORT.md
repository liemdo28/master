# Language Persistence Fix Report

Date: 2026-06-05

## Fixed

When language is detected, the runtime stores it in:

- `user_language_preferences`
- active `session.language`

Priority:

1. Active session language
2. User saved language
3. Message detected language
4. Store default language
5. English fallback

## Vietnamese Proof

Input:

`Biết tiếng Việt ko`

Reply:

`Được. Tôi có thể hỗ trợ bằng tiếng Việt. Gõ /ldagent để bắt đầu.`

Next input:

`/ldagent`

Reply includes:

`Chọn cửa hàng:`

Screenshots:

- `docs/screenshots/whatsapp-vietnamese-ldagent.png`
- `docs/screenshots/whatsapp-vietnamese-daily-entry.png`
