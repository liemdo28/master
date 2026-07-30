# False Failure Root Cause Report

Timestamp: 2026-06-15 21:56 Asia/Saigon

## Symptom

Real phone screenshot showed a successful workflow reply followed by:

```text
Mi-Core is temporarily unavailable. Please try again later.
```

Successful workflow:

```text
SEO-CONTENT-20260615-998
APPR-mqfbtovl-526
```

## Investigation

Checked:

- Duplicate execution
- Timeout
- Fallback route
- Callback failure
- Self-chat reprocessing

## Root Cause

Most likely root cause: **self-chat reprocessing of Mi's own successful reply**.

The gateway listens to:

```text
client.on('message_create')
```

For self-chat testing, `fromMe` messages are allowed when configured. The listener already tried to ignore gateway-sent messages with `replyService.isGatewaySentMessage(msg)`, but if that ID/text marker misses, the successful workflow reply can be treated as a new no-prefix CEO message and forwarded back to Mi-Core.

The no-prefix path also sent fallback text whenever `forwardResult.reply` existed, even if `forwardResult.ok` was false. That allowed a secondary unavailable bubble after a valid first response.

## Fixes

Updated:

```text
E:\Project\Master\whatsapp-ai-gateway\src\whatsapp\message-listener.js
```

Added a guard:

```text
isMiExecutionReplyText()
```

It ignores self-chat messages containing execution reply signatures:

- `SEO-CONTENT-*`
- `Approval ID: APPR-*`
- `APPROVE / EDIT / CANCEL`
- `Status: Draft ready` plus `Reference: SEO-CONTENT-*`

Also changed the no-prefix Mi path:

```text
Send WhatsApp reply only when forwardResult.ok === true.
```

Failed no-prefix forwards are logged but no longer send a false user-facing fallback bubble.

## Verification

Gateway diagnostic after fixes:

```json
{
  "status": 200,
  "result_ok": true,
  "workflow_id": "SEO-CONTENT-20260615-999",
  "approval_id": "APPR-mqfc16pt-913"
}
```

Reply checks:

```json
{
  "has_slug": false,
  "has_word_count": false,
  "has_type": false,
  "has_chinese": false,
  "has_status": true,
  "has_title": true,
  "has_approval": true,
  "has_images": true
}
```

## Remaining Risk

This was verified through source inspection and gateway diagnostic routing. A final real-phone repeat should confirm that only one success bubble appears.

## Verdict

P4 False Failure Investigation: **FIXED WITH REAL-PHONE RETEST RECOMMENDED**

Final target:

```text
PHONE_WHATSAPP_PRODUCTION_READY
```

Status: **READY FOR FINAL PHONE RETEST**
