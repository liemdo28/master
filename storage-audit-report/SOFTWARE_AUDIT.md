# SOFTWARE AUDIT
**Generated:** 2026-06-01 | **Phase 0: SCAN ONLY — no uninstall**

---

## Development Tools

| Software | Version | Install Date | Status |
|----------|---------|-------------|--------|
| Git | 2.54.0 | 2026-05-04 | ✅ ACTIVE |
| GitHub CLI | 2.87.3 | 2026-03-03 | ✅ ACTIVE |
| Node.js | 24.14.1 | 2026-03-25 | ✅ ACTIVE |
| Go | 1.26.3 | 2026-06-01 | ✅ ACTIVE (just installed) |
| Python 3.13.12 | 3.13.12 | 2026-02-26 | ✅ ACTIVE |
| Java 8 Update 491 (64-bit) | 8.0.491 | 2026-05-07 | ✅ ACTIVE (QuickBooks dep) |
| Eclipse Temurin JDK 17 | 17.0.18 | 2026-04-13 | ✅ ACTIVE (Android Studio) |
| Android Studio | 2025.3 | — | ✅ ACTIVE (mobile_taskflow) |
| Docker Desktop | 4.75.0 | — | ✅ ACTIVE |
| PowerShell 7 | 7.5.5 | 2026-03-25 | ✅ ACTIVE |
| PowerShell 7 Preview | 7.6.0 | 2026-03-04 | 🟡 DUPLICATE (7 preview + stable) |
| Visual Studio 2022 Community | 17.14 | 2026-03-26 | ✅ ACTIVE |

---

## Business Software

| Software | Version | Install Date | Size | Status |
|----------|---------|-------------|------|--------|
| QuickBooks Enterprise 24.0 | 34.0.4018 | 2026-02-26 | 2.4GB | ✅ ACTIVE |
| Adobe Photoshop 2025 | 26.1.0 | 2026-04-23 | 4.8GB | ✅ ACTIVE |
| Microsoft Office 365 | 16.0.14026 | 2026-02-24 | — | ✅ ACTIVE |
| Google Drive | 125.0.0 | — | — | ✅ ACTIVE |
| Google Chrome | 148.0 | 2023-04-22 | — | ✅ ACTIVE |
| Google Play Games | 26.5.511 | — | 3.0GB | 🟡 GAMING |
| ABS PDF Install | 4.6.0 | 2026-02-26 | 19MB | 🟡 RARELY USED |
| Foxit Reader | 9.7.2 | 2023-04-22 | 207MB | 🟡 OLD (2023) |

---

## System / Infrastructure

| Software | Version | Install Date | Status |
|----------|---------|-------------|--------|
| cloudflared | 2025.8.1 | 2026-05-07 | ✅ ACTIVE (tunnel) |
| Tailscale | 1.98.4 | 2026-05-29 | ✅ ACTIVE (VPN) |
| Private Internet Access | 3.7.0 | — | 🟡 VPN (may conflict with Tailscale) |
| AnyDesk | 9.6.11 | — | 🟡 REMOTE ACCESS |
| FileZilla | 3.69.6 | — | ✅ ACTIVE (SFTP deploys) |
| Google Cloud SDK | — | — | ✅ ACTIVE |
| K-Lite Codec Pack | 17.5.2 | 2023-04-22 | 🟡 OLD (2023) |
| AIDA64 Extreme | 8.20 | 2026-02-23 | 🟡 DIAGNOSTIC |
| CPUID CPU-Z | 2.17 | 2026-02-23 | 🟢 DIAGNOSTIC |
| OSFMount | 3.1.1003 | 2026-03-19 | 🟡 RARELY USED |
| Viber | 27.3.0 | 2026-02-26 | ✅ COMMUNICATION |
| AMD Settings + Software | 2026.05 | 2026-05-28 | ✅ REQUIRED (GPU) |

---

## Rarely Used / Old (Installed 2023)

| Software | Install Date | Notes |
|----------|-------------|-------|
| K-Lite Codec Pack | 2023-04-22 | Media codecs — may be unused |
| Foxit Reader | 2023-04-22 | PDF reader — Edge/Chrome can replace |
| Microsoft Visual C++ 2005–2013 | 2023-04-22 | Old redistributables — may be deps |
| ABS PDF Install | 2026-02-26 | Atlas Business Solutions |

---

## Duplicate / Redundant

| Item | Issue | Recommendation |
|------|-------|----------------|
| PowerShell 7 + PowerShell 7 Preview | Both installed | Remove Preview if stable works |
| Private Internet Access + Tailscale | Two VPN clients | Decide on one primary VPN |
| Multiple Visual C++ redistributables (2005-2022) | Many versions | Required by various apps — keep all |

---

## Space Usage (Development Tools)

| Tool | Est. Disk | Notes |
|------|-----------|-------|
| Visual Studio 2022 | ~50GB (C:\) | Full IDE |
| Adobe Photoshop 2025 | ~4.8GB | |
| QuickBooks Enterprise | ~2.4GB | |
| Google Play Games | ~3GB | Gaming platform |
| Docker Desktop | ~3.6GB | |
| Android Studio | — | Flutter dev |

---

## Notes

- All software appears legitimately installed
- No suspicious/unknown publishers
- No action recommended pending CEO review
- Java 8 (64-bit) is required for QuickBooks
- Google Cloud SDK likely for deployment pipelines
