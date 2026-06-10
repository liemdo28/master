# Bakudan Food Safety — Windows Install Guide

## Requirements

- Windows 10 or Windows 11
- Administrator account
- Internet connection (optional — installer is fully offline)

## One-Click Install

1. Copy the installer folder to the laptop.
2. Right-click **Install Bakudan Food Safety.bat** → **Run as administrator**.
3. Follow on-screen prompts. The installer will:
   - Create app folder: `C:\Program Files\BakudanFoodSafety\app\`
   - Create data folder: `C:\ProgramData\BakudanFoodSafety\`
   - Install Node.js and Chrome (bundled, offline)
   - Create Desktop and Start Menu shortcuts
   - Register auto-start on Windows login
   - Start the app and open the dashboard

## Folder Structure After Install

```
C:\Program Files\BakudanFoodSafety\
  app\          ← App source (replaced on update)
  updater\      ← Updater scripts

C:\ProgramData\BakudanFoodSafety\
  data\         ← Runtime data
  db\           ← SQLite database (gateway.db)
  uploads\      ← Photos and uploaded files
  logs\         ← App and update logs
  config\       ← .env and credentials
  backups\      ← Pre-update backups
```

**Important:** The `C:\ProgramData\BakudanFoodSafety\` folder is NEVER deleted during updates.

## Desktop Shortcuts

| Shortcut | Action |
|---|---|
| Start Bakudan Gateway | Start the app |
| Stop Bakudan Gateway | Stop the app |
| Open Bakudan Dashboard | Open dashboard in browser |
| Update Bakudan App | Check and install updates |

## After Install

1. If WhatsApp shows a QR code in the dashboard — scan it with the store phone.
2. Place Google credentials at:
   `C:\ProgramData\BakudanFoodSafety\config\google-service-account.json`
3. Configure WhatsApp group mappings in the dashboard.

## Troubleshooting

- **Dashboard not loading:** Run "Start Bakudan Gateway" shortcut.
- **Port conflict:** Edit `C:\ProgramData\BakudanFoodSafety\config\.env` and change `DASHBOARD_PORT`.
- **Install fails:** Make sure you right-clicked → Run as administrator.
