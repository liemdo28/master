# SOURCE_AUDIT_EXPORT_MANIFEST.md
> Mi Company OS — Export Manifest
> Date: 2026-06-18
> Export Path: E:\Project\Exports\MI_COMPANY_OS_SOURCE_AUDIT_20260618_1143
> ZIP: E:\Project\Exports\MI_COMPANY_OS_SOURCE_AUDIT_20260618_1143.zip

---

## ZIP Summary

| Metric | Value |
|--------|-------|
| Total files | 8,159 |
| ZIP size | 179.7 MB |
| .env files | 0 |
| node_modules | 0 |
| client_secret files | 0 |
| .local-agent-global | 0 |
| WhatsApp session data | 0 |
| DLL / binary files | 0 |
| SQLite DB files | 0 |

---

## Export Folder Structure

```
MI_COMPANY_OS_SOURCE_AUDIT_20260618_1143/
├── CEO_README.md                             ← Deployment guide
├── mi-core/                                  ← Main CEO OS
│   ├── server/src/                           ← TypeScript source (full)
│   ├── server/package.json + tsconfig.json
│   ├── services/
│   │   ├── whatsapp-ai-gateway/src/          ← WhatsApp source
│   │   ├── accounting-engine/api/            ← Accounting source
│   │   ├── qb-ops-agent/                     ← QB agent source
│   │   ├── food-safety-gateway/              ← Food safety source
│   │   └── mi-ceo-observer/src/              ← CEO observer source
│   ├── ecosystem.config.js                   ← PM2 config
│   ├── .env.example                          ← Template (no secrets)
│   ├── reports/                              ← All certification reports
│   │   ├── PHASE_14_*.md (9 files)
│   │   ├── SOURCE_AUDIT_*.md (8 files)
│   │   └── MI_COMPANY_OS_*.md
│   ├── tests/                                ← Acceptance tests
│   └── ui/                                   ← Dashboard HTML/CSS
├── bakudan-dashboard/                        ← CEO dashboard frontend
├── review-automation-system/                 ← Review automation Python
├── bakudan-integration-system/               ← Toast POS integration app
├── doordash-campaign-agent/                  ← DoorDash campaigns
└── CEO_README.md
```

---

## Files INCLUDED

| Category | Status |
|----------|--------|
| TypeScript source (.ts) | ✅ |
| JavaScript source (.js, .mjs) | ✅ |
| Python source (.py) | ✅ |
| package.json / package-lock.json | ✅ |
| tsconfig.json | ✅ |
| ecosystem.config.js | ✅ |
| .env.example templates | ✅ |
| README.md files | ✅ |
| Certification reports (*.md) | ✅ |
| Tests | ✅ |
| Migration files | ✅ |
| UI static files (.html, .css) | ✅ |

---

## Files EXCLUDED

| Category | Reason |
|----------|--------|
| node_modules | Rebuildable — `npm install` |
| dist/ | Rebuildable — `npx tsc` |
| .git/ | Version history not in ZIP |
| .env (all) | Contains real secrets |
| logs/ | Runtime logs |
| *.dll / *.exe | Binary binaries |
| *.db / SQLite | Runtime databases |
| .local-agent-global/ | Runtime data (large — 933MB knowledge index) |
| .venv / venv | Python virtualenv (rebuildable) |
| backup/ | WhatsApp session backups |
| WhatsApp session data | Auth tokens — security risk |
| Cache / Cache_Data | Browser cache |
| client_secret*.json | OAuth credential (was found on disk — rotate!) |
| snapshots / credentials | Auth data |

---

## Security Issues Fixed During Export

| Issue | Action |
|-------|--------|
| Google OAuth client_secret JSON found on disk | Removed from export. **CEO: Rotate credentials immediately.** |
| WhatsApp session backup dirs included initially | Excluded from ZIP (auth cache data) |
| .local-agent-global 933MB search index included | Excluded from ZIP |
| node_modules included in first pass | Removed |

---

## ZIP Pass Condition: MET

- ✅ No secrets in ZIP
- ✅ No node_modules in ZIP
- ✅ No .git in ZIP
- ✅ No logs or PM2 dumps
- ✅ No credentials or session data
- ✅ .env.example only (no real .env)
