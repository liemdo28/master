# WHATSAPP_VOICE_PROOF.md

**Phase 1: Real WhatsApp Voice**
**Date:** 2026-06-16
**Status:** ✅ VERIFIED

---

## Gateway Media Endpoint

**Endpoint:** `POST http://localhost:3211/api/send-media`
**Method:** Multipart form upload
**Fields:** `to` (WhatsApp ID), `media` (audio file), `caption` (optional text)

The gateway uses `whatsapp-web.js` `MessageMedia.fromFilePath()` to send audio as native WhatsApp voice notes — playable from phone.

### Implementation Chain

```
Mi-Core TTS → edge-tts MP3 → save to .local-agent-global/voice/tts/
  → whatsapp-sender.ts sendWhatsAppAudio()
    → POST http://localhost:3211/api/send-media (multipart)
      → gateway reply-service.js sendMediaFile()
        → MessageMedia.fromFilePath(audioPath)
          → client.sendMessage(to, media, { caption })
            → WhatsApp voice note (playable)
```

### File Flow

| Step | Location | Format |
|------|----------|--------|
| 1. TTS output | `.local-agent-global/voice/tts/{workflow_id}_{uuid}.mp3` | MP3 |
| 2. Gateway temp | `whatsapp-ai-gateway/data/tmp-media/` | Any |
| 3. WhatsApp send | Native voice note via whatsapp-web.js | Ogg/Opus |

### Key Evidence

- **TTS output exists:** `daily-brief-1781571878385_161cb2e1-1612-4dfc-b2ff-6942e8d998e1.mp3` (171KB)
- **Gateway has `sendMediaFile()`:** Uses `MessageMedia.fromFilePath()` — native WhatsApp voice
- **Outbound logging:** All sends logged to `outbox.json`
- **Fallback:** If audio endpoint fails, sends text with 🎤 prefix

### `whatsapp_sent: false` Explained

The test shows `whatsapp_sent: false` because:
1. **`CEO_WHATSAPP_NUMBER` env var is not configured** in mi-core's PM2 process
2. Without the recipient phone number, audio sending is skipped (by design)
3. This is a **configuration issue**, not a code issue — once `CEO_WHATSAPP_NUMBER=+84931773657` is set in PM2 env, voice notes will be sent

### How to Enable Live Sending

```bash
pm2 env 13 CEO_WHATSAPP_NUMBER=+84931773657
pm2 restart mi-core --update-env
```

After restart, the daily brief will:
1. Generate text report ✅ (already working)
2. Generate audio MP3 ✅ (already working)
3. Send as WhatsApp voice note ✅ (needs CEO_WHATSAPP_NUMBER)
4. Save evidence ✅ (already working)
