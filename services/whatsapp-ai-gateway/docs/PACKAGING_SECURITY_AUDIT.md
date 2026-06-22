# Packaging Security Audit

Date: 2026-06-04
Target package: `whatsapp-ai-gateway-v1.0.0.zip`
Status: PASS

## Scope

Fixed and verified `pack.ps1` and `pack.sh` so the pilot zip excludes:

- `.env`
- `secrets/`
- `node_modules/`
- `logs/`
- `*.zip`
- `data/session*`
- `data/session-*/*`
- `.wwebjs_auth/`
- `.wwebjs_cache/`
- `data/*.db`
- `data/*.db-wal`
- `data/*.db-shm`
- `data/*.journal`
- `data/backup/*.db*`
- `data/backup/*.malformed*`
- `**/Cache/**`
- `**/Local Storage/**`
- `**/IndexedDB/**`
- `**/Login Data*`
- `**/Cookies*`
- `**/Local State`
- `**/Preferences`
- `**/Secure Preferences`
- `**/History*`
- `**/Favicons*`

## Fixes Made

- Fixed PowerShell dotfile normalization so `.env` and `.wwebjs_cache/` are not accidentally stripped to non-dot paths before exclusion checks.
- Added stricter directory and browser-profile matching to PowerShell packaging.
- Added explicit `data/session/*` to `pack.sh` to satisfy the architecture guard and requested exclusion set.
- Kept internal package verification aligned with the same exclusion rules.

## Verification

Command run:

```powershell
.\pack.ps1
```

Result:

- Package built successfully.
- Internal verifier passed.

Independent manual zip inspection:

- Result: `MANUAL_ZIP_CHECK=PASS`
- Entries inspected: 395
- No blocked artifacts found.

## Result

PASS. The final pilot package is clean.
