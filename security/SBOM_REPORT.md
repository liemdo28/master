# SBOM REPORT — Mi-Core Server

## Generated: 2026-06-09
## Format: CycloneDX 1.6
## Tool: @cyclonedx/cyclonedx-npm v4.2.1
## File: security/sbom/cyclonedx-sbom.json

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Components** | 207 |
| **Direct Dependencies** | 14 |
| **Dev Dependencies** | 7 |
| **Transitive Dependencies** | 186 |
| **Licenses Identified** | 100% |
| **Known Vulnerabilities** | 0 (post-upgrade) |

## Dependency Breakdown

### Direct Runtime Dependencies (14)

| Package | Version | License | Type |
|---------|---------|---------|------|
| @googleapis/calendar | 15.0.0 | Apache-2.0 | Google API |
| @googleapis/gmail | 17.0.0 | Apache-2.0 | Google API |
| @types/better-sqlite3 | 7.6.13 | MIT | Type defs |
| better-sqlite3 | 12.10.0 | MIT | Database |
| chokidar | 5.0.0 | MIT | File watcher |
| cors | 2.8.5 | MIT | CORS middleware |
| dotenv | 16.6.1 | BSD-2-Clause | Env config |
| express | 4.22.2 | MIT | Web framework |
| express-rate-limit | 7.5.1 | MIT | Rate limiting |
| googleapis | 173.0.0 | Apache-2.0 | Google API client |
| helmet | 7.2.0 | MIT | Security headers |
| node-cron | 4.2.1 | ISC | Task scheduler |
| node-fetch | 3.3.2 | MIT | HTTP client |
| **uuid** | **11.1.1** | MIT | **⬆️ UPGRADED** |
| ws | 8.18.0 | MIT | WebSocket |

### Dev Dependencies (7)

| Package | Version | License |
|---------|---------|---------|
| @types/cors | 2.8.19 | MIT |
| @types/express | 4.17.25 | MIT |
| @types/node | 20.19.42 | MIT |
| @types/uuid | 10.0.0 | MIT |
| @types/ws | 8.18.1 | MIT |
| tsx | 4.15.7 | MIT |
| typescript | 5.9.3 | Apache-2.0 |

### Key Transitive Dependencies

| Package | Version | License |
|---------|---------|---------|
| google-auth-library | 10.7.0 | Apache-2.0 |
| googleapis-common | 8.0.2 | Apache-2.0 |
| gaxios | 7.1.5 | Apache-2.0 |
| gcp-metadata | 8.1.2 | Apache-2.0 |
| gtoken | 8.0.0 | MIT |
| https-proxy-agent | 7.0.6 | MIT |

## Vulnerability Scan

- **npm audit**: 0 vulnerabilities found
- **Highest severity**: None
- **Action required**: No immediate action needed

## Upgrade History

| Package | Before | After | Reason |
|---------|--------|-------|--------|
| uuid | 10.0.0 | 11.1.1 | Deprecated/unmaintained (HIGH) |

## Recommendations

1. **Monthly SBOM regeneration** — Keep `cyclonedx-sbom.json` updated
2. **Integrate into CI** — Run CycloneDX generation on every release
3. **Monitor googleapis** — Currently at latest (173.0.0), but MEDIUM findings may resolve in future releases
4. **Consider Drive write scope** — Not currently scoped; current Drive scope is read-only
