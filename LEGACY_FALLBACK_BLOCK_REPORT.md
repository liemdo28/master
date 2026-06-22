# Legacy Fallback Block Report

Date: 2026-06-16

## Status

PASS in gateway live-style testing.

## Fix

- CEO direct language-question intercept is bypassed for CEO senders.
- No-prefix CEO direct messages route to Mi-Core before legacy NLP fallback.
- Mi-Core forward failures are logged but do not send legacy training/fallback text to the CEO.
- Gateway ignores its own sent execution replies to prevent self-chat loops.

## Source Scan

No live source match for:

- `Mi-Core is temporarily unavailable`
- `SEO Analysis`
- `Top keyword opportunities`
- Chinese artifact `reply`

`/ldagent` remains in the codebase for store workflow sessions, but CEO direct chat now routes before the legacy direct-chat fallback.

## Regression Evidence

T6 image follow-up:

- `source=execution-evidence`
- Reply: `Co anh. Em gui lai hinh preview cua ban nhap gan nhat ben duoi.`
- No `/ldagent` fallback.

T9 unknown clarification:

- `source=mi-core`
- Reply asks what to clarify.
- No dashboard hijack.

## Verdict

Legacy fallback is blocked for the tested CEO production paths.
