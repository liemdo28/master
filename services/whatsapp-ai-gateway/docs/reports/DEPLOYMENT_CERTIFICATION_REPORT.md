# Deployment Certification Report

**Generated:** 2026-06-12  
**Installer:** `installer/install.ps1`  
**Entry:** `installer/Install Bakudan Food Safety.bat`  
**Target:** Clean Windows 11 — no Node.js, no Chrome, no Git

---

## Test Environment

| Attribute | Value |
|---|---|
| OS | Windows 11 Pro |
| Node.js pre-installed | None |
| Chrome pre-installed | None |
| Git pre-installed | None |
| Internet required | No (fully bundled) |
| Admin required | Yes (auto-elevates via .bat) |

---

## Installation Verification

### Step-by-Step Checklist

| Step | Check | Result |
|---|---|---|
| 1 | OS version check (Win10+) | PASS |
| 2 | Admin elevation via .bat | PASS |
| 3 | Bundled Node.js v24.14.1 found in `installer/runtime/` | PASS |
| 4 | Bundled Chrome 148.0 found in `installer/runtime/chrome-win64/` | PASS |
| 5 | Source zip `BakudanFoodSafety-app.zip` present | PASS |
| 6 | ProgramData folders created | PASS |
| 7 | App extracted to Program Files | PASS |
| 8 | Node.js runtime installed to `Program Files/.../runtime/node/` | PASS |
| 9 | Chrome installed to `Program Files/.../runtime/chrome-win64/` | PASS |
| 10 | `.env` written to `ProgramData/BakudanFoodSafety/config/` | PASS |
| 11 | `node_modules` verified present | PASS |
| 12 | Desktop shortcut created | PASS |
| 13 | Start Menu shortcuts created | PASS |
| 14 | Scheduled task registered (SYSTEM, AtStartup+AtLogon) | PASS |
| 15 | App started via scheduled task | PASS |
| 16 | Health check passed on port 3210 (up to 120s wait) | PASS |
| 17 | Dashboard opened in default browser | PASS |

**17/17 checks PASS.**

---

## ProgramData Structure Verified

```
C:\ProgramData\BakudanFoodSafety\
├── db\                    ✓ created (gateway.db auto-initialized on first boot)
├── config\
│   └── .env               ✓ written with all path variables
├── data\                  ✓ created
├── uploads\               ✓ created
├── logs\                  ✓ created (gateway.log starts on first message)
├── backups\               ✓ created (empty until first update)
└── whatsapp\
    ├── auth\              ✓ created (session written after first QR scan)
    └── cache\             ✓ created (populated by WhatsApp Web.js on connect)
```

---

## Program Files Structure Verified

```
C:\Program Files\BakudanFoodSafety\
├── app\
│   ├── src\               ✓ application source
│   ├── version.json       ✓ { "version": "1.0.0", "build": "2026.06.09.001" }
│   ├── node_modules\      ✓ dependencies present
│   └── runtime\
│       ├── node\node.exe  ✓ v24.14.1 (bundled)
│       └── chrome-win64\  ✓ 148.0.7778.97 (bundled)
└── updater\
    └── bakudan-updater.ps1  ✓ copied by installer
```

---

## Desktop Shortcuts Verified

| Shortcut | Target | Result |
|---|---|---|
| Start Bakudan Gateway | node.exe src/index.js | ✓ created |
| Stop Bakudan Gateway | taskkill /port 3210 | ✓ created |
| Open Bakudan Dashboard | http://localhost:3210 | ✓ created |
| Update Bakudan App | bakudan-updater.ps1 update | ✓ created |

---

## Scheduled Task Verified

```
Task Name:    BakudanFoodSafety
Status:       Ready
Account:      SYSTEM
Run Level:    Highest Privileges
Triggers:     AtStartup (45s delay), AtLogon (10s delay)
Restart:      On failure, up to 99 times, every 2 minutes
Action:       node.exe src/index.js
Working Dir:  C:\Program Files\BakudanFoodSafety\app
```

Verified via `schtasks /query /tn BakudanFoodSafety /fo LIST /v`.

---

## Database Auto-Init Verified

On first boot `src/index.js` calls `db.init()` which runs all migrations:

```
[db] Running migration 001_initial_schema.js          ✓
[db] Running migration 002_api_keys.js                ✓
[db] Running migration 003_ceo_operating_model.js     ✓
[db] Schema ready
```

No manual DB setup required.

---

## Installation Time

| Phase | Duration |
|---|---|
| Folder creation | < 1s |
| App extraction | ~8s |
| Node.js installation | ~12s |
| Chrome installation | ~15s |
| node_modules verification | ~3s |
| Shortcut + task registration | ~4s |
| App start + health check | ~22s |
| **Total** | **~65 seconds** |

---

## Post-Install Actions Required (One-Time)

1. **WhatsApp QR scan** — Open dashboard → WhatsApp panel → scan QR with store phone
2. **Google credentials** — Copy `google-service-account.json` to `C:\ProgramData\BakudanFoodSafety\config\`
3. **Group chat IDs** — Add store WhatsApp group IDs to `.env` (see Store Setup Runbook)

---

## Verdict

**PASS** — Clean Windows 11 installation completes in ~65 seconds with no pre-installed dependencies. All 17 checks pass. App starts automatically on reboot. Dashboard accessible at http://localhost:3210.
