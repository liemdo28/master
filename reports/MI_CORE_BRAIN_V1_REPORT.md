# MI_CORE_BRAIN_V1_REPORT

**Date:** 2026-06-09  
**Verdict:** MI_CORE_BRAIN_V1_READY (pending Ollama live test)

## Layer 1 — Universal Visibility

| Component | Status | Location |
|-----------|--------|----------|
| Connector Registry | ✓ READY | `visibility/connector-registry.ts` |
| Visibility Hub | ✓ READY | `visibility/visibility-hub.ts` |
| Local Projects Connector | ✓ CONNECTED | scans E:/Project/Master |
| Dashboard Connector | ✓ CONNECTED | reads dashboard.bakudanramen.com |
| Asana Connector | STUB — not configured | needs ASANA_TOKEN |
| Gmail Connector | STUB — not configured | needs Google OAuth |
| Google Calendar | STUB — not configured | needs Google OAuth |
| Google Drive | STUB — not configured | needs Google OAuth |
| Huawei Health | STUB — export only | drop file to .local-agent-global/visibility/health/export/ |
| rawsushibar.com | ✓ CONNECTED | reads RawSushi folder |
| bakudanramen.com | ✓ CONNECTED | reads Bakudan folder |

### Cache structure
```
.local-agent-global/visibility/
  connector-registry.json
  daily-snapshot.json
  projects/ {data.json, summary.json, last_sync.json, errors.json}
  dashboard/ {data.json, summary.json, last_sync.json, errors.json}
  gmail/ (empty — not configured)
  asana/ (empty — not configured)
  health/ (empty — export not found)
```

### CEO Questions Coverage
- "Hôm nay anh có gì cần làm?" → getDailySnapshot() ✓
- "Project nào đang lỗi?" → getProjectsWithIssues() ✓
- "File/report nằm đâu?" → searchProjects() + KB search ✓
- "Sức khỏe hôm nay?" → readHealthExport() — needs export file
- "Email nào quan trọng?" → STUB: Gmail not configured
- "Calendar hôm nay?" → STUB: Calendar not configured

**Verdict: UNIVERSAL_VISIBILITY_READY (local connectors), PARTIAL (cloud connectors)**

---

## Layer 2 — Executive Knowledge Database

| Component | Status |
|-----------|--------|
| SQLite FTS5 | ✓ READY |
| Ingestion Engine | ✓ READY |
| Search (full-text) | ✓ READY — FTS5 unicode61 |
| Category search | ✓ READY |
| Source catalog | ✓ READY |
| Stats tracking | ✓ READY |
| Incremental ingest | ✓ READY |
| Rebuild/clear | ✓ READY |

**Storage:** `.local-agent-global/knowledge-db/knowledge.db`  
**Ingest scope:** Master Workspace (.md, .txt, .json, .ts, .js, .php, .py, .html)  
**Exclude:** node_modules, .git, dist, build, vendor, cache, tmp

**Verdict: EXECUTIVE_KNOWLEDGE_DB_READY**

---

## Layer 3 — Executive Memory V2

| Memory Category | Persistent | Consent Gate |
|----------------|-----------|-------------|
| Owner Profile | ✓ JSON file | — |
| Preferences | ✓ JSON file | — |
| Business Memory | ✓ JSON file | — |
| Decision Memory | ✓ JSON file | — |
| Workflow Memory | ✓ JSON file | — |
| Personal/Health | ✓ JSON file | ✓ REQUIRED |
| Consent Log | ✓ JSON file | — |

**Storage:** `.local-agent-global/executive-memory-v2/`  
**Survives restart:** YES — file-based  
**Health rule:** No diagnose, consent required for save  

**Verdict: EXECUTIVE_MEMORY_V2_READY**

---

## Pipeline Integration

```
CEO message
→ Executive Memory retrieval (getRelevantMemoryForMessage)
→ Knowledge DB search (FTS5)
→ Universal Visibility snapshot (if needed by mode)
→ Project search (if "tìm X")
→ Pending approvals check
→ Enriched system prompt → AI
→ Session history update
```

**Verdict: MI_CORE_BRAIN_V1_READY**
