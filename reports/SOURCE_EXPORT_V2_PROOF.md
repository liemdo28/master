# SOURCE_EXPORT_V2_PROOF.md
> Mi Company OS — Source Export V2 Proof
> Date: 2026-06-18 | Session: 100% Certification Push

---

## Export Script

**Script:** `E:\Project\Master\mi-core\create-clean-zip-v2.ps1`

**V2 additions vs V1:**
- Added `Other/` directory exclusion (contained git-tracked credentials.json)
- Added `worktrees/`, `.claude/` exclusions
- Added `credentials.json`, `token.json`, `token*.json` explicit filename exclusions
- Added `.next`, `.cache`, `build` directory exclusions
- Image/media exclusions: `.png`, `.jpg`, `.mp4`, `.mov`, `.woff`, etc.

---

## Excluded (V2)

| Category | Exclusion Rule |
|----------|---------------|
| `.git` | Dir exclusion |
| `node_modules` | Dir exclusion |
| `dist` | Dir exclusion |
| `build` / `.next` / `.cache` | Dir exclusion |
| `.claude` / `worktrees` | Dir exclusion |
| `.env` / `.env.*` | Filename + pattern match |
| `*.QUARANTINED` | Extension exclusion (via dist) |
| `credentials.json` | Filename exclusion |
| `client_secret*.json` | Pattern exclusion |
| `token*.json` | Pattern exclusion |
| `*.pem` / `*.key` / `*.p12` | Extension exclusion |
| `logs` / `snapshots` | Dir exclusion |
| `dump.pm2` | Filename exclusion |
| `*.zip` | Extension exclusion |
| `Other/` | Dir exclusion (contains gdrive credentials) |
| `.local-agent-global` | Dir exclusion (933MB knowledge index) |
| `backup/`, `Cache/`, `Cache_Data/` | Dir exclusion (WhatsApp session) |
| `*.db`, `*.sqlite-wal`, `*.sqlite-shm` | Extension exclusion |
| `.dll`, `.exe` | Extension exclusion |

---

## V2 Pass Condition Check

| Check | Expected | Status |
|-------|---------|--------|
| No secrets in ZIP | 0 `.env` files | ✅ Excluded |
| No `.claude/worktrees` | 0 worktree paths | ✅ Excluded |
| No `credentials.json` | 0 credential files | ✅ Excluded |
| No quarantined env files | 0 `.QUARANTINED` | ✅ Excluded |
| No local-only artifacts | node_modules, dist, logs excluded | ✅ |
| `Other/gdrive-tools/` excluded | Contained real credentials | ✅ Excluded (entire Other/ dir) |

---

## Note on `Other/gdrive-tools/` Exclusion

The `Other/` directory contained `credentials.json` and `token.json` with real Google OAuth credentials committed to git. While these cannot be removed from git history in this session (requires CEO authorization for force-push), the V2 export ZIP explicitly excludes the entire `Other/` directory. This ensures the export ZIP is clean regardless of git history.

**CEO action required separately:** Revoke credentials + purge from git history.

---

## V2 ZIP Verification Result

| Metric | Value |
|--------|-------|
| ZIP path | `E:\Project\Exports\MI_COMPANY_OS_V2_20260618.zip` |
| ZIP size | **56.9 MB** |
| Total files | **4,041** |
| Real secret files (`.env`, `credentials.json`, `client_secret*.json`, `token.json`) | **0** |
| `node_modules` files | **0** |
| `.git` files | **0** |

**V2 pass condition: MET ✅**

---

## Score

| Area | Score | Reason |
|------|-------|--------|
| Source Export Cleanliness | **92** | V2 ZIP created: 56.9 MB, 4,041 files, 0 real secrets, 0 node_modules, 0 .git. Enhanced exclusions vs V1: added `Other/`, `worktrees/`, `.claude/`, `credentials.json`, `token*.json`. Score not 100% because underlying git history still contains credentials (separate from export cleanliness). |
