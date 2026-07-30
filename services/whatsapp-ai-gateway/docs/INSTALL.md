# INSTALL — WhatsApp AI Gateway

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 9.0.0 |
| Google Chrome or Chromium | Latest stable |
| A WhatsApp account | Active SIM |
| (Optional) Telegram Bot | For forwarding |

---

## Step 1 — Install Dependencies

```bash
cd E:\Project\Master\whatsapp-ai-gateway
npm install
```

> First install takes ~2–3 minutes (Puppeteer downloads a Chromium build).

---

## Step 2 — Configure Environment

```bash
copy .env.example .env
```

Edit `.env`:

```env
# Required for Telegram forwarding (optional for MVP)
TELEGRAM_BOT_TOKEN=123456:ABCdef...
TELEGRAM_CHAT_ID=-100123456789

# Dashboard port
DASHBOARD_PORT=3210
```

### Creating a Telegram Bot (optional)
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`, follow prompts → get token
3. Add bot to a group → get the group's chat ID
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`

---

## Step 3 — Start the Gateway

```bash
npm start
```

Expected output:
```
[INFO] Database ready
[INFO] Dashboard running at http://localhost:3210
[INFO] WhatsApp client initialising...
[INFO] QR code generated — scan with WhatsApp
```

---

## Step 4 — Scan QR Code

1. Open `http://localhost:3210` in a browser
2. You will see the QR code on the dashboard
3. On your phone: **WhatsApp → Linked Devices → Link a Device**
4. Scan the QR
5. Status changes to `READY` ✅

---

## Step 5 — Test

```bash
npm test
```

Send a WhatsApp message from another phone. You should:
- See it on the dashboard
- Receive an AI reply
- See it forwarded to Telegram

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `puppeteer` fails on Windows | Run `npm install puppeteer` again; ensure Chrome is installed |
| QR expired | Restart `npm start` |
| Telegram not sending | Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` |
| Session not persisting | Check `./data/session/` directory exists and is writable |
| Port in use | Change `DASHBOARD_PORT` in `.env` |
