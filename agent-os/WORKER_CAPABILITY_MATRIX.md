# Agent OS - Worker Capability Matrix

## Capability Overview

| Capability | L1 | L2 | L3 |
|------------|----|----|-----|
| **Filesystem** | | | |
| Read all files | ✅ | ✅ | ✅ |
| Write in E:\Project\Master | ✅ | ✅ | ✅ |
| Write outside E:\ | ❌ | ❌ | ❌ |
| Delete files | ❌ | ❌ | ❌ |
| **Git** | | | |
| Status/log/diff | ✅ | ✅ | ✅ |
| Pull/fetch | ✅ | ✅ | ✅ |
| Add/commit | ✅ | ✅ | ✅ |
| Push | ❌ | ✅ | ✅ |
| **Apps** | | | |
| Open approved apps | ✅ | ✅ | ✅ |
| Open blocked apps | ❌ | ❌ | ❌ |
| **Scripts** | | | |
| Run approved scripts | ✅ | ✅ | ✅ |
| Run any script | ❌ | ❌ | ❌ |
| **Development** | | | |
| Build projects | ✅ | ✅ | ✅ |
| Run QA tests | ✅ | ✅ | ✅ |
| Deploy to staging | ❌ | ✅ | ✅ |
| Deploy to production | ❌ | ❌ | ❌ |
| **Cline Control** | | | |
| Open Cline/Antigravity | ❌ | ✅ | ✅ |
| Inject task prompt | ❌ | ✅ | ✅ |
| Monitor output | ❌ | ✅ | ✅ |
| **API Proxy** | | | |
| Start API proxy | ❌ | ✅ | ✅ |
| Stop API proxy | ❌ | ✅ | ✅ |
| View proxy logs | ❌ | ✅ | ✅ |
| **Cloud** | | | |
| Gmail | ❌ | ❌ | 🔐 |
| Email | ❌ | ❌ | 🔐 |
| DreamHost | ❌ | ❌ | 🔐 |
| Cloudflare | ❌ | ❌ | 🔐 |
| Google Drive | ❌ | ❌ | 🔐 |
| GitHub API | ❌ | ❌ | 🔐 |
| **Dangerous** | | | |
| DNS changes | ❌ | ❌ | ❌ |
| Production DB | ❌ | ❌ | ❌ |
| Delete cloud | ❌ | ❌ | ❌ |

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Allowed by default |
| ❌ | Denied (requires explicit approval) |
| 🔐 | Requires separate Level 3 token |
| ⏳ | Requires CEO approval |

## Capability Details

### Filesystem Capabilities

```
filesystem:read
├── Read any file on PC
├── List directories
├── Search files
└── Get file stats

filesystem:write
├── Write in E:\Project\Master
├── Write in E:\Agent
├── Write in D:\ (if exists)
├── Write in F:\ (if exists)
└── Write in G:\My Drive (if exists)

filesystem:write:strict
├── Write outside E:\Project\Master
├── Write to system directories
└── Write to user home (except E:\)
    └── ⛔ DENIED

filesystem:delete
├── Delete any file
└── ⛔ DENIED (unless CEO approved)
```

### Git Capabilities

```
git:read
├── git status
├── git log
├── git diff
├── git branch -a
├── git remote -v
└── git show

git:write
├── git add
├── git commit
└── git checkout

git:push
├── git push origin branch
├── git push --force
└── ⛔ Requires CHANGE_SUMMARY.md
```

### App Launcher

```
APPROVED_APPS = [
  "code",           // VS Code
  "cursor",         // Cursor
  "chrome",         // Chrome
  "msedge",         // Edge
  "firefox",        // Firefox
  "wt",             // Windows Terminal
  "bash",           // Git Bash
  "docker",         // Docker Desktop
  "github",         // GitHub Desktop
  "postman",        // Postman
  "npm",            // npm
  "node",           // Node.js
  "python",         // Python
  "code.cmd",       // VS Code (alt)
  "explorer",       // File Explorer
]

BLOCKED_APPS = [
  "whatsapp",
  "viber",
  "zalo",
  "telegram",
  "discord",
  "skype",
]
```

### Script Permissions

```
APPROVED_SCRIPTS = [
  "*.build.ps1",
  "*.build.bat",
  "*.test.ps1",
  "*.deploy.ps1",
  "start-proxy*.bat",
  "sync-*.ps1",
  "git-*.ps1",
]

APPROVED_SCRIPT_PATHS = [
  "E:\\Project\\Master\\*",
  "E:\\Agent\\*",
]

RESTRICTED_PATTERNS = [
  "rm -rf",
  "del /s /q",
  "format",
  "net user",
  "reg delete",
]
```

---

## Implementation

```typescript
// Capability matrix check
const CAPABILITIES: Record<string, Record<string, boolean>> = {
  L1: {
    'filesystem:read': true,
    'filesystem:write': true,
    'filesystem:write:strict': false,
    'filesystem:delete': false,
    'git:read': true,
    'git:write': true,
    'git:push': false,
    'apps:open': true,
    'scripts:run': true,
    'cline:control': false,
    'api:proxy': false,
    'deploy:production': false,
    'cloud:*': false,
  },
  L2: {
    'filesystem:read': true,
    'filesystem:write': true,
    'filesystem:write:strict': false,
    'filesystem:delete': false,
    'git:read': true,
    'git:write': true,
    'git:push': true,
    'apps:open': true,
    'scripts:run': true,
    'cline:control': true,
    'api:proxy': true,
    'deploy:staging': true,
    'deploy:production': false,
    'cloud:*': false,
  },
  L3: {
    'filesystem:read': true,
    'filesystem:write': true,
    'filesystem:write:strict': false,
    'filesystem:delete': false,
    'git:read': true,
    'git:write': true,
    'git:push': true,
    'apps:open': true,
    'scripts:run': true,
    'cline:control': true,
    'api:proxy': true,
    'deploy:staging': true,
    'deploy:production': false,
    'cloud:gmail': true,
    'cloud:email': true,
    'cloud:dreamhost': true,
    'cloud:cloudflare': true,
    'cloud:gdrive': true,
    'cloud:github': true,
    'dns:change': false,
    'db:production': false,
  },
};
```
