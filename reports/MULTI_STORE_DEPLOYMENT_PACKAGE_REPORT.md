# Multi-Store Deployment Package Report — DEV2
**Date:** 2026-06-12
**Stores:** Stone Oak | Rim | Bandera
**Platform:** Bakudan Food Safety WhatsApp AI Gateway v1.0.0

---

## Overall Result: PASS ✅

---

## Store Roster

| Store ID | Name | Location | WhatsApp Client ID | Port |
|----------|------|----------|--------------------|------|
| `stone-oak` | Bakudan Ramen — Stone Oak | San Antonio, TX (Stone Oak) | `bakudan-stone-oak` | 3211 |
| `rim` | Bakudan Ramen — Rim | San Antonio, TX (Rim) | `bakudan-rim` | 3212 |
| `bandera` | Bakudan Ramen — Bandera | San Antonio, TX (Bandera) | `bakudan-bandera` | 3213 |

> **Note:** Each store runs on its own dedicated laptop. Ports only matter if multiple stores share a single machine (not recommended).

---

## Deployment Package Contents

Each store receives an identical installer folder with one per-store customization: the `.env` override file.

```
BakudanFoodSafety-[StoreName]-Installer\
  Install Bakudan Food Safety.bat     ← Double-click to install
  install.ps1                         ← Core installer (shared)
  store-config.env                    ← Per-store env overrides
  README-QUICKSTART.txt               ← Quick start guide (plain text)
  TROUBLESHOOTING.txt                 ← Troubleshooting guide
  runtime\
    node-v24.14.1-win-x64.zip
    chrome-win64\
  source\
    BakudanFoodSafety-app.zip
  updater\
    bakudan-updater.ps1
    Update App.bat
    Rollback.bat
    Status.bat
```

---

## Per-Store `.env` Overrides

### Stone Oak

```env
WHATSAPP_CLIENT_ID=bakudan-stone-oak
DASHBOARD_PORT=3211
STORE_ID=stone-oak
STORE_NAME=Bakudan Ramen Stone Oak
MI_CORE_URL=http://[CEO-PC-TAILSCALE-IP]:4001
MI_CORE_API_KEY=[contact Dev1 for key]
UPDATE_MANIFEST_URL=https://raw.githubusercontent.com/liemdo28/bakudan-releases/main/update-manifest.json
UPDATE_CHECK_INTERVAL_HOURS=6
```

### Rim

```env
WHATSAPP_CLIENT_ID=bakudan-rim
DASHBOARD_PORT=3212
STORE_ID=rim
STORE_NAME=Bakudan Ramen Rim
MI_CORE_URL=http://[CEO-PC-TAILSCALE-IP]:4001
MI_CORE_API_KEY=[contact Dev1 for key]
UPDATE_MANIFEST_URL=https://raw.githubusercontent.com/liemdo28/bakudan-releases/main/update-manifest.json
UPDATE_CHECK_INTERVAL_HOURS=6
```

### Bandera

```env
WHATSAPP_CLIENT_ID=bakudan-bandera
DASHBOARD_PORT=3213
STORE_ID=bandera
STORE_NAME=Bakudan Ramen Bandera
MI_CORE_URL=http://[CEO-PC-TAILSCALE-IP]:4001
MI_CORE_API_KEY=[contact Dev1 for key]
UPDATE_MANIFEST_URL=https://raw.githubusercontent.com/liemdo28/bakudan-releases/main/update-manifest.json
UPDATE_CHECK_INTERVAL_HOURS=6
```

---

## Quick Start Guide

```
====================================================
 Bakudan Food Safety — Store Setup Quick Start
====================================================

WHAT YOU NEED
─────────────
• Windows 10 or Windows 11 laptop
• Admin account (or ask IT to run for you)
• Store phone with WhatsApp installed
• Tailscale installed and connected (ask Dev1)

INSTALL STEPS
─────────────
1. Copy the installer folder to the laptop Desktop.

2. Open the folder. Right-click:
   "Install Bakudan Food Safety.bat"
   → select "Run as administrator"

3. Wait 2–3 minutes. The installer will:
   ✓ Install the app
   ✓ Set up all folders
   ✓ Register auto-start on Windows boot
   ✓ Open the dashboard automatically

4. When the dashboard opens in the browser:
   → Go to Settings → WhatsApp
   → A QR code will appear
   → Open WhatsApp on the STORE PHONE
   → Tap Menu (⋮) → Linked Devices → Link a Device
   → Scan the QR code

5. Test it:
   → Send a message from the store phone
   → You should see it in the dashboard

DONE. The app will start automatically every time
the laptop turns on.

DAILY USE
─────────
• Leave the laptop on and connected to the internet.
• The gateway runs silently in the background.
• Use Desktop shortcut "Open Bakudan Dashboard"
  to check status at any time.

UPDATES
───────
• Click "Update Bakudan App" on the Desktop.
• Updates take 2–3 minutes and preserve all data.
• Do NOT update during a busy service period.

CONTACTS
────────
• Technical issues: Dev1 (WhatsApp or Slack)
• Dashboard login: Ask manager for password
• CEO notifications: Automated via Mi-Core
```

---

## Runbook: New Store Setup

### Pre-Deployment Checklist (Dev1)

- [ ] Laptop is Windows 10/11, has Admin account
- [ ] Tailscale installed + connected to CEO PC network
- [ ] CEO PC Mi-Core is running (`http://[tailscale-ip]:4001/api/health`)
- [ ] Store phone WhatsApp is active with a dedicated number
- [ ] `store-config.env` has correct `WHATSAPP_CLIENT_ID` (unique per store)
- [ ] Installer folder copied to laptop

### Installation Steps (Dev1 on-site or remote via Tailscale)

```powershell
# 1. Right-click installer bat → Run as Administrator
# OR from PowerShell (admin):
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install.ps1

# 2. After install, apply per-store config:
$configFile = 'C:\ProgramData\BakudanFoodSafety\config\.env'
$storeEnv   = Get-Content .\store-config.env
foreach ($line in $storeEnv) {
  if ($line -match '^(\w+)=') {
    $key = $matches[1]
    # Replace or append the line
    $content = Get-Content $configFile -Raw
    if ($content -match "(?m)^$key=") {
      $content = $content -replace "(?m)^$key=.*", $line
    } else {
      $content += "`r`n$line"
    }
    Set-Content $configFile -Value $content
  }
}

# 3. Copy config to app folder
Copy-Item $configFile 'C:\Program Files\BakudanFoodSafety\app\.env' -Force

# 4. Restart the app
Stop-ScheduledTask -TaskName 'BakudanFoodSafety' -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName 'BakudanFoodSafety'

# 5. Verify health
Start-Sleep 15
Invoke-RestMethod http://localhost:[PORT]/api/health
```

### Post-Install Verification

- [ ] Dashboard loads at `http://localhost:[PORT]`
- [ ] WhatsApp QR code displayed in dashboard
- [ ] Store phone scanned QR — session shows "Connected"
- [ ] Test message received in dashboard
- [ ] Mi-Core `/api/health` shows this store client connected
- [ ] Auto-start verified: reboot laptop → app starts within 60s

---

## Runbook: Update Existing Store

```
Method A — Dashboard (Recommended)
  1. Open Bakudan Dashboard
  2. Go to System → Updates
  3. Click "Check for Updates"
  4. If update available, click "Install Update"
  5. Wait 2–3 minutes. Dashboard will reload on new version.

Method B — Desktop Shortcut
  1. Double-click "Update Bakudan App" on Desktop
  2. Wait for completion message

Method C — PowerShell (Remote / Admin)
  powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File "C:\Program Files\BakudanFoodSafety\updater\bakudan-updater.ps1" `
    update
```

---

## Runbook: Rollback

```
Method A — Desktop Shortcut
  1. Double-click "Rollback.bat" on Desktop

Method B — PowerShell (Admin)
  powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File "C:\Program Files\BakudanFoodSafety\updater\bakudan-updater.ps1" `
    rollback

  # To rollback to a specific backup:
  bakudan-updater.ps1 rollback backup-20260612-100000-pre-v1.0.1

Method C — Check available backups first
  bakudan-updater.ps1 status
```

---

## Troubleshooting Guide

### App won't start

```
Symptom : Dashboard not loading at http://localhost:[PORT]
Check   : Open Task Manager → look for "node.exe" process
Fix A   : Double-click "Start Bakudan Gateway" on Desktop
Fix B   : Restart the scheduled task:
          PowerShell (Admin): Start-ScheduledTask -TaskName BakudanFoodSafety
Fix C   : Check logs: C:\ProgramData\BakudanFoodSafety\logs\
```

### WhatsApp QR code not appearing

```
Symptom : Dashboard shows "WhatsApp: Disconnected" or blank QR
Check   : Dashboard → Settings → WhatsApp → Force Re-auth
Fix A   : Delete session and re-scan:
          Stop the app
          Delete: C:\ProgramData\BakudanFoodSafety\whatsapp\auth\*
          Start the app
          Scan QR with store phone
Fix B   : Check internet connectivity on the laptop
Fix C   : Contact Dev1 — may need WHATSAPP_TAKEOVER_ON_CONFLICT=true
```

### WhatsApp messages not reaching Mi-Core

```
Symptom : Messages arrive in gateway dashboard but no reply from Mi-Core
Check 1 : Tailscale connected? Run: tailscale status
Check 2 : CEO PC online? ping [MI_CORE_URL from .env]
Check 3 : MI_CORE_API_KEY matches CEO PC config?
Fix     : Verify .env values, restart app, test with: /mi ping
```

### Update fails / app won't start after update

```
Symptom : "Update rolled back because health check failed"
Fix     : Rollback ran automatically. Check logs\updates.log for reason.
          Contact Dev1 with the log file.
```

### Disk space low

```
Symptom : App errors, uploads failing
Check   : C:\ProgramData\BakudanFoodSafety\backups\ may have many old backups
Fix     : Delete old backups (keep last 2):
          Get-ChildItem C:\ProgramData\BakudanFoodSafety\backups | 
            Sort-Object Name -Descending | Select-Object -Skip 2 | 
            Remove-Item -Recurse -Force
```

### Port already in use

```
Symptom : App fails to start — "EADDRINUSE :3211"
Fix     : Find and kill the process using the port:
          $p = (Get-NetTCPConnection -LocalPort 3211 -State Listen).OwningProcess
          Stop-Process -Id $p -Force
          Then restart the app.
```

---

## Deployment Status

| Store | Package Ready | Install Runbook | WhatsApp Runbook | Troubleshooting |
|-------|--------------|-----------------|------------------|-----------------|
| Stone Oak | ✅ | ✅ | ✅ | ✅ |
| Rim | ✅ | ✅ | ✅ | ✅ |
| Bandera | ✅ | ✅ | ✅ | ✅ |

---

## Notes for Deployer

1. **One laptop per store.** Never share a `WHATSAPP_CLIENT_ID` between two running instances — causes session conflicts.
2. **WhatsApp session is precious.** The `whatsapp\auth\` folder contains the authenticated session. Never delete it unless re-pairing. It survives all updates and reinstalls.
3. **Tailscale must be running** before the gateway starts — otherwise Mi-Core URL is unreachable and messages won't be processed.
4. **Avoid updates during service hours** (11am–2pm, 5pm–9pm). Schedule updates early morning.
5. **CEO PC must be running** for Mi-Core processing. Gateway can receive messages offline, but AI processing requires Mi-Core connection.
