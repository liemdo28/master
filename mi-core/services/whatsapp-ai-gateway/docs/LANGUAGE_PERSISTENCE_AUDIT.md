# Language Persistence Audit

Date: 2026-06-05

## Failure

Vietnamese greeting/language question worked, but workflow prompts fell back to English.

## Fix

`/ldagent` now resolves language from `user_language_preferences` and stores it on:

`session.language`

Guided workflow receives that language and does not overwrite it on numeric replies.

## Proof

Smoke input:

`Biết tiếng Việt ko`

Stored memory:

- `language`: `vi`
- `source`: `auto_detected`

Then `/ldagent` returns:

```text
Tôi sẵn sàng hỗ trợ.

Chọn cửa hàng:

1 Rim
2 Stone Oak
3 Bandera
```

Screenshot:

`docs/screenshots/whatsapp-vietnamese-workflow.png`
