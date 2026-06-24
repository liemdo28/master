# Bakudan Food Safety — Update Guide

## Checking for Updates (Dashboard)

1. Open the dashboard: http://localhost:3210
2. Scroll to **System Updates** section.
3. Click **Check for Updates**.
4. If an update is available, click **Install Update**.

## Updating from Desktop Shortcut

Double-click **Update Bakudan App** on the Desktop.

## Updating from Command Line (Admin)

```powershell
# Run as Administrator
powershell -ExecutionPolicy Bypass -File "C:\Program Files\BakudanFoodSafety\updater\bakudan-updater.ps1" update
```

## Safe Update Process

When you click Update, the updater will:

1. Download the new version package
2. Verify SHA256 checksum (rejects if mismatch)
3. Stop the app
4. Create a backup: `C:\ProgramData\BakudanFoodSafety\backups\backup-YYYYMMDD-HHMMSS-pre-vX.X.X\`
5. Extract new app to temp folder
6. Validate package structure
7. Replace `C:\Program Files\BakudanFoodSafety\app\`
8. Restart the app
9. Run health check

If any step fails: the updater rolls back automatically and restarts the previous version.

**Your data in `C:\ProgramData\BakudanFoodSafety\` is never deleted.**

## Rolling Back

```powershell
# Roll back to last backup
powershell -ExecutionPolicy Bypass -File "C:\Program Files\BakudanFoodSafety\updater\bakudan-updater.ps1" rollback latest

# Roll back to specific backup
powershell -ExecutionPolicy Bypass -File "C:\Program Files\BakudanFoodSafety\updater\bakudan-updater.ps1" rollback backup-20260610-143000-pre-v1.0.1
```

Or use the **Rollback.bat** shortcut in `C:\Program Files\BakudanFoodSafety\updater\`.

## Configuration

Set the update manifest URL in `C:\ProgramData\BakudanFoodSafety\config\.env`:

```
UPDATE_MANIFEST_URL=https://your-release-server/update-manifest.json
```

### Recommended Manifest Hosts

- **GitHub Releases**: Upload `update-manifest.json` as a release asset, use the raw URL
- **Private HTTPS server**: Host `update-manifest.json` at a stable URL

## Update Log

All update and rollback actions are logged to:
`C:\ProgramData\BakudanFoodSafety\logs\updates.log`

Visible in the dashboard under **System Updates → Update History**.

## Security

- Only HTTPS manifest URLs are accepted
- SHA256 checksum is verified before install
- Packages without `src/index.js` and `version.json` are rejected
- Rollback is admin-only
