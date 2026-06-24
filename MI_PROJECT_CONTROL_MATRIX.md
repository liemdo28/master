# MI_PROJECT_CONTROL_MATRIX.md
Generated: 2026-06-24T05:27:00Z

## Control Status Legend

- **CONTROLLED** = Mi knows project, can audit, build, test, and report
- **PARTIAL** = Mi knows project, some capabilities only
- **READ_ONLY** = Mi can read/scan but not execute
- **NOT_CONNECTED** = Mi sees it but cannot interact
- **BROKEN** = Project is down or unreachable

---

## Project Control Matrix

### mi-core (The Brain)
| Capability | Status | Evidence |
|-----------|--------|---------|
| Repo exists? | YES | E:\Project\Master\mi-core |
| Local path exists? | YES | Confirmed |
| Mi knows project? | YES | /api/projects lists it |
| Mi can audit project? | YES | scanAllProjects() active |
| Mi can create task? | YES | autonomous scheduler has 6 tasks |
| Mi can run build? | YES | `tsc` build command exists |
| Mi can run test? | PARTIAL | No test script in root package.json |
| Mi can collect evidence? | YES | evidence store at E:\Project\Master\mi-core\data\evidence |
| Mi can create PR/patch? | NO | Git remote not configured |
| Mi can report status? | YES | 75 objective runs recorded |
| **FINAL STATUS** | **CONTROLLED** | Self-referential — Mi IS mi-core |

---

### antigravity-gateway
| Capability | Status | Evidence |
|-----------|--------|---------|
| Repo exists? | NO | No git_remote |
| Local path exists? | YES | E:/Project/Master/Agent/agent-coding-api-keys |
| Mi knows project? | YES | Scanned by /api/projects |
| Mi can audit project? | YES | file_count: 249 |
| Mi can create task? | PARTIAL | Via /api/projects/command |
| Mi can run build? | YES | tsc build_cmd exists |
| Mi can run test? | YES | npm run build + 4 test scripts |
| Mi can collect evidence? | YES | QA connectors available |
| Mi can create PR/patch? | NO | Git not configured |
| Mi can report status? | YES | health endpoint available |
| **FINAL STATUS** | **PARTIAL** | Build/test OK; no git integration |

---

### doordash-campaign-agent
| Capability | Status | Evidence |
|-----------|--------|---------|
| Repo exists? | NO | No git_remote |
| Local path exists? | YES | E:/Project/Master/Agent/doordash-compaigns |
| Mi knows project? | YES | Scanned |
| Mi can audit project? | YES | 137 files |
| Mi can create task? | PARTIAL | Via /api/projects/command |
| Mi can run build? | YES | tsc && vite build |
| Mi can run test? | YES | tsx src/tests/run-tests.ts |
| Mi can collect evidence? | NO | No evidence path registered |
| Mi can create PR/patch? | NO | Git not configured |
| Mi can report status? | YES | http://localhost:3000/health |
| **FINAL STATUS** | **PARTIAL** | Build/test OK; no git or evidence integration |

---

### ai-search-tool (Agent/ai-search-tool AND Other/dau-tu)
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | 2 instances |
| Mi knows project? | YES | Scanned |
| Mi can audit project? | YES | 77 + 163 files |
| Mi can create task? | NO | No connector |
| Mi can run build? | NO | Wrangler-based, no local connector |
| Mi can run test? | NO | No test_cmd |
| Mi can collect evidence? | NO | Not registered |
| **FINAL STATUS** | **READ_ONLY** | Cloud-only (Workers/Pages) |

---

### bakudan-website
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | E:/Project/Master/Bakudan/bakudanramen.com-current |
| Mi knows project? | YES | bakudan-website project_id |
| Mi can audit project? | YES | 1277 files |
| Mi can create task? | YES | Dedicated connector: bakudan-website-connector |
| Mi can run build? | YES | syncBakudanWebsite() connector |
| Mi can run test? | YES | runBakudanQA() connector |
| Mi can collect evidence? | YES | sync + qa connectors |
| Mi can report status? | YES | http://localhost:5181/health |
| **FINAL STATUS** | **BROKEN** | health connector reports "server down" |

---

### dashboard-bakudanramen-qa
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | PHP/MySQL dashboard |
| Mi knows project? | YES | dashboard-bakudanramen-qa |
| Mi can audit project? | YES | 1953 files |
| Mi can create task? | YES | syncDashboardProject() |
| Mi can run build? | NO | No build_cmd |
| Mi can run test? | YES | runDashboardQA() |
| Mi can collect evidence? | YES | QA connector available |
| **FINAL STATUS** | **PARTIAL** | QA OK; no build, PHP-based |

---

### integration-system
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | E:/Project/Master/Bakudan/integration-system |
| Mi knows project? | YES | Listed as remote |
| Mi can audit project? | YES | 880 files |
| Mi can create task? | NO | INTEGRATION_SYSTEM_HOST not set |
| Mi can run build? | NO | No remote connection |
| Mi can run test? | NO | Remote not configured |
| Mi can collect evidence? | NO | Remote not reachable |
| **FINAL STATUS** | **NOT_CONNECTED** | Host env var not set; remote unreachable |

---

### mobile_taskflow
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | 159 files |
| Mi knows project? | YES | mobile_taskflow project |
| Mi can create task? | NO | No connector |
| Mi can run build? | NO | No build_cmd |
| Mi can report status? | NO | No health endpoint |
| **FINAL STATUS** | **NOT_CONNECTED** | No integration |

---

### packing-list-automation
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | 630 files |
| Mi knows project? | YES | packing-list-automation |
| Mi can create task? | NO | No connector |
| Mi can run build? | YES | cd v2-react/client && npm run build |
| Mi can report status? | NO | No health endpoint |
| **FINAL STATUS** | **PARTIAL** | Build known; no run/test integration |

---

### review-automation-system
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | 183 files |
| Mi knows project? | YES | review-automation-system |
| Mi can create task? | NO | No connector |
| Mi can run test? | NO | No test_cmd |
| Mi can report status? | YES | http://localhost:4001/health |
| **FINAL STATUS** | **PARTIAL** | Health OK; no build/test/task |

---

### growth-dashboard
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | 36 files |
| Mi knows project? | YES | growth-dashboard |
| Mi can create task? | NO | No connector |
| Mi can run build? | YES | node scripts/export-static.mjs |
| Mi can report status? | NO | No health endpoint |
| **FINAL STATUS** | **PARTIAL** | Build known; no test/run integration |

---

### Agent/agent-coding (Bakudan/Agent-Coding)
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | 1233 files |
| Mi knows project? | YES | agent-coding |
| Mi can create task? | PARTIAL | Via /api/projects/command |
| Mi can run build? | YES | node scripts/build-check.js |
| Mi can run test? | YES | node --test tests/*.test.js |
| Mi can report status? | YES | http://localhost:4001/health |
| **FINAL STATUS** | **PARTIAL** | Build/test OK; git not configured |

---

### Bakudan/Agent-Coding (duplicate)
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | Same as above |
| Mi knows project? | YES | Listed twice |
| **FINAL STATUS** | **PARTIAL** | Duplicate entry |

---

### SEO Agents (7 agents, all online)
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | SEO/ directory |
| Mi knows project? | YES | 7 agents scanned |
| Mi can audit project? | YES | uptime, tasks_completed tracked |
| Mi can create task? | YES | /api/seo/tasks POST |
| Mi can run test? | YES | node test.js per agent |
| Mi can collect evidence? | YES | /api/seo/reports/latest |
| Mi can report status? | YES | /api/seo/agents/:id/status |
| **FINAL STATUS** | **CONTROLLED** | All 7 online; orchestration active |

---

### cv-builder
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | Directory exists |
| Files inside? | NO | Empty directory |
| **FINAL STATUS** | **NOT_CONNECTED** | Not initialized |

---

### Other/* projects (LinkTreeHL, phuyen-2026, openclaw, tuya, tu-vi)
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | Various Other/ paths |
| Mi knows project? | PARTIAL | Some scanned, some not |
| Mi can create task? | NO | No connectors |
| Mi can run build? | PARTIAL | Some have build commands |
| **FINAL STATUS** | **NOT_CONNECTED** | No integration |

---

### RawSushi/RawWebsite
| Capability | Status | Evidence |
|-----------|--------|---------|
| Local path exists? | YES | 370 files |
| Mi knows project? | YES | rawwebsite |
| Mi can create task? | NO | No connector |
| Mi can run build? | YES | node build.mjs |
| Mi can run test? | YES | node --test tests/*.test.js |
| Mi can report status? | NO | No health endpoint |
| **FINAL STATUS** | **PARTIAL** | Build/test known; no run or evidence |

---

## Summary by Status

| Status | Count | Projects |
|--------|-------|---------|
| CONTROLLED | 2 | mi-core (self), SEO agents (7-in-1) |
| PARTIAL | 8 | antigravity-gateway, doordash, dashboard, agent-coding (Bakudan), packing-list, growth-dashboard, rawwebsite, review-automation-system |
| READ_ONLY | 2 | ai-search-tool (x2) |
| NOT_CONNECTED | 6 | integration-system, mobile_taskflow, cv-builder, Other/* projects |
| BROKEN | 1 | bakudan-website (server down) |

---

## Gaps Summary

1. **No GitHub integration** — 0/36 projects have git remotes configured
2. **bakudan-website DOWN** — must be restarted
3. **integration-system** — missing INTEGRATION_SYSTEM_HOST
4. **cv-builder empty** — never initialized
5. **Evidence paths unknown** — most projects lack evidence collection
6. **Remote connectors un