# CEO Start Guide — WhatsApp AI Gateway

## Quick Start (Double-Click to Launch)

### Windows (Recommended)
1. Double-click **`start-whatsapp-ai-gateway.bat`**
2. Browser opens automatically to http://localhost:3210
3. Terminal stays open showing real-time logs
4. Done!

Or use the PowerShell version:
- Double-click **`start-whatsapp-ai-gateway.ps1`**
- Same behavior, more detailed logging

### Mac
1. Double-click **`start-whatsapp-ai-gateway.command`**
2. Browser opens automatically to http://localhost:3210
3. Terminal stays open showing real-time logs

### Linux
1. Make executable: `chmod +x start-whatsapp-ai-gateway.command`
2. Double-click to run
3. Browser opens to http://localhost:3210

---

## First-Time Setup

### Step 1: Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials:
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_CHAT_ID
```

### Step 2: Install Dependencies (automatic)
The launcher scripts will do this automatically on first run.
Or manually:
```bash
npm install
```

---

## After Launch

### 1. Click Resume AI
On the dashboard at http://localhost:3210, find the **Safety Controls** tab and click **▶ Resume AI**.

### 2. Scan WhatsApp QR
A QR code appears in the terminal (ASCII art). Scan it with your WhatsApp:
- WhatsApp → ⋮ → Linked Devices → Link a Device → Scan QR

### 3. Dashboard
The dashboard shows:
- WhatsApp connection status (should be `READY`)
- AI Engine status (should be `ACTIVE`)
- All incoming messages
- All AI replies
- Escalation alerts

---

## How to Test

### From a second phone, message the connected WhatsApp:

| Message | Expected Response |
|---|---|
| `Hello` | AI greeting |
| `What time does Stone Oak open?` | Stone Oak hours |
| `Where is Bandera?` | Bandera address |
| `I want a refund` | Escalates to Telegram |
| `I need the manager` | Escalates to Telegram |
| `asdfqwert123` | Escalates (no hallucination) |

### Safety Controls (Dashboard):
- **⏸ Pause AI** — stops all auto-replies
- **Takeover** — stops AI for one phone only
- **Block** — silently drops messages from one phone

---

## How to Stop

### Option 1: Close the terminal window
The server stops immediately.

### Option 2: Ctrl + C in the terminal
Graceful shutdown.

---

## Troubleshooting

### "Port 3210 is already in use"
Close the old gateway window, then run the launcher again.
The PowerShell launcher (`.ps1`) will show you which process is using the port.

### WhatsApp not connecting
- Check the terminal for QR code
- If QR expired, stop app (Ctrl+C) and restart

### Telegram not working
- Check `.env` has `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Make sure the bot is added to your Telegram group

### node_modules missing
Run `npm install` in the project folder.

---

## File Locations

| File | Purpose |
|---|---|
| `start-whatsapp-ai-gateway.bat` | Windows launcher |
| `start-whatsapp-ai-gateway.ps1` | Windows PowerShell launcher |
| `start-whatsapp-ai-gateway.command` | Mac/Linux launcher |
| `dashboard` | http://localhost:3210 |
| `logs/` | Real-time application logs |
| `screenshots/` | Evidence screenshots |
| `docs/PHASE_2_LIVE_TEST_REPORT.md` | Live test template |
| `docs/PILOT_READINESS_CHECKLIST.md` | Pilot checklist |
| `docs/MANUAL_LIVE_VALIDATION_REPORT.md` | Test result capture |
| `docs/INTERNAL_PILOT_PLAN.md` | 7-day pilot plan |
