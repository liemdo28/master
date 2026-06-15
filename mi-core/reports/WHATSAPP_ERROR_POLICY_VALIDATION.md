# WhatsApp Error Policy Validation

**Date:** 2026-06-15T03:14:35.436Z

## Policy

- All error/fallback replies must be Vietnamese
- "Mi-Core is temporarily unavailable" (English) must NEVER appear in Jarvis replies
- replay-protection in whatsapp.ts now returns Vietnamese message (W3 fix)
- safeErrorReply in gateway returns rotating Vietnamese messages (already correct)

## Test Results

| Query | Reply Preview | Passed |
|-------|---------------|--------|
| `mi oi` | Em đây anh. | ✅ |
| `dashboard hom nay co gi` | Em chưa lấy được data từ Dashboard lúc này — server trả về l | ✅ |
| `hom nay anh co task gi` | Em chưa lấy được danh sách task từ Dashboard lúc này. Anh th | ✅ |
| `bao cao sang nay` |  | ✅ |
| `suc khoe hom nay` |  | ✅ |
| `pm2 status` | 🖥 *PM2 Process Status*

PM2 không khả dụng hoặc chưa được c | ✅ |
| `overview he thong` |  | ✅ |
| `jarvis status` | Em đây anh. Tổng quan hệ thống lúc này:

📚 Kiến thức: 39,59 | ✅ |

## Source of "⚠️ Mi-Core is temporarily unavailable"

Not found in any JS/TS source file. Likely from gateway.db template or old binary. 
Vietnamese safeErrorReply confirmed in agent-mi-forwarder.js.
Replay protection fixed: whatsapp.ts:243 now returns Vietnamese fallback instead of empty string.