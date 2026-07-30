# MI GAP ANALYSIS
**Date:** 2026-06-09
**Comparing:** Current State vs Target Architecture
**Version:** 1.0.0

---

## Gap Summary Matrix

| Layer | Current | Target | Gap Type |
|-------|---------|--------|----------|
| L1: Owner Brain | 85% | 100% | Enhancement |
| L2: Memory System | 85% | 100% | Enhancement |
| L3: Knowledge Federation | 60% | 100% | **Major Gap** |
| L4: Universal Visibility | 65% | 100% | **Major Gap** |
| L5: Project Registry | 80% | 100% | Enhancement |
| L6: Connector Layer | 60% | 100% | **Major Gap** |
| L7: Approval Gate | 90% | 100% | Enhancement |
| L8: Execution Engine | 50% | 100% | **Major Gap** |
| L9: QA + Security | 70% | 100% | Enhancement |
| L10: Remote Control | 85% | 100% | Enhancement |

---

## L1: Owner Brain — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| Profile Engine | Full | Full | — | — | — |
| Personality Engine | Basic regex | Full NLP | `intelligence/personality-engine.ts` | personality matching | — |
| Mode System | 7 modes | 7+2 modes | — | — | Add `emergency`, `finance_expert` modes |
| Executive Reasoning Chain | Partial | Full | `intelligence/executive-context.ts` upgrade | reasoning chain, context builder | — |
| Context Window Management | None | Full | `intelligence/context-manager.ts` | sliding window, priority queue | — |

**Files required:**
- `server/src/intelligence/personality-engine.ts` (new)
- `server/src/intelligence/context-manager.ts` (new)
- `server/src/intelligence/context-truncator.ts` (new)

**APIs required:**
- `POST /api/brain/mode` — switch mode
- `GET /api/brain/context` — get current context window
- `GET /api/brain/personality` — get personality profile

---

## L2: Memory System — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| Executive Memory V2 | Full | Full | — | — | — |
| Vector Memory | **Missing** | Full | `memory/vector-memory.ts` (new) | embedding store, similarity search | — |
| Memory TTL/Expiry | **Missing** | Full | `memory/memory-expiry.ts` (new) | TTL scheduler, auto-cleanup | — |
| Cross-Session Context | None | Full | `memory/context-fuser.ts` (new) | session fusion, priority scoring | — |
| Memory Consolidation | None | Full | `memory/consolidator.ts` (new) | deduplication, summarization | — |
| Personal Memory (Consent) | Basic | Full | Upgrade existing | consent verification | — |

**Files required:**
- `server/src/memory/vector-memory.ts` (new)
- `server/src/memory/memory-expiry.ts` (new)
- `server/src/memory/context-fuser.ts` (new)
- `server/src/memory/consolidator.ts` (new)

**APIs required:**
- `GET /api/memory/vector/search` — semantic memory search
- `POST /api/memory/consolidate` — run consolidation
- `GET /api/memory/stats` — memory usage stats

---

## L3: Knowledge Federation — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| SQLite FTS5 | Full | Full | — | — | — |
| Embedding Vector Search | **Missing** | Full | `knowledge/vector-index.ts` (new) | embedding service, index | `POST /api/knowledge/embed` |
| Knowledge Packs | **Empty dir** | 5 packs | `knowledge/packs/*/` (15-25 files) | pack installer | `POST /api/knowledge/packs/install` |
| Agent KB Unification | **No connection** | Full | `knowledge/kb-bridge.ts` (new) | KB federation | `GET /api/knowledge/agent-search` |
| Active Learning | **Missing** | Full | `knowledge/active-learner.ts` (new) | conversation extraction | — |
| Web Crawling | **Missing** | Full | `knowledge/web-crawler.ts` (new) | scraper, rate limiter | `POST /api/knowledge/crawl` |

**Files required:**
- `server/src/knowledge/vector-index.ts` (new)
- `server/src/knowledge/kb-bridge.ts` (new)
- `server/src/knowledge/active-learner.ts` (new)
- `server/src/knowledge/web-crawler.ts` (new)
- `server/src/knowledge/packs/business/` (3-5 files)
- `server/src/knowledge/packs/health/` (3-5 files)
- `server/src/knowledge/packs/technology/` (3-5 files)
- `server/src/knowledge/packs/restaurant/` (3-5 files)
- `server/src/knowledge/packs/finance/` (3-5 files)

**APIs required:**
- `POST /api/knowledge/embed` — generate embedding
- `POST /api/knowledge/search` — hybrid search (FTS5 + vector)
- `GET /api/knowledge/packs` — list available packs
- `POST /api/knowledge/packs/install` — install a pack
- `POST /api/knowledge/crawl` — crawl a URL
- `GET /api/knowledge/stats` — KB size and health

**UI required:**
- `ui/knowledge.html` — knowledge search and management page

---

## L4: Universal Visibility — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| Visibility Hub | Full | Full | — | — | — |
| Real-Time Push | **Missing** | Full | `visibility/push-engine.ts` (new) | WebSocket broadcast, chokidar | — |
| Connector Failure Alerts | **Missing** | Full | `visibility/alert-engine.ts` (new) | failure detection, alert routing | — |
| Data Freshness Metrics | **Missing** | Full | `visibility/freshness.ts` (new) | age calculation, staleness detection | — |
| Rate-Limit Aware Sync | **Missing** | Full | `visibility/rate-limit-scheduler.ts` (new) | backoff, jitter, priority queue | — |
| Daily Snapshot Auto-Email | **Missing** | Full | `visibility/snapshot-emailer.ts` (new) | email formatter, scheduler | — |

**Files required:**
- `server/src/visibility/push-engine.ts` (new)
- `server/src/visibility/alert-engine.ts` (new)
- `server/src/visibility/freshness.ts` (new)
- `server/src/visibility/rate-limit-scheduler.ts` (new)
- `server/src/visibility/snapshot-emailer.ts` (new)

**APIs required:**
- `GET /api/visibility/freshness` — per-connector freshness status
- `POST /api/visibility/sync/:connector` — trigger sync
- `GET /api/visibility/alerts` — current alerts
- `POST /api/visibility/alert-dismiss` — dismiss alert

**UI required:**
- `ui/health.html` — connector health dashboard
- `ui/visibility.html` — visibility management page

---

## L5: Project Registry — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| Project Scanner | Full | Full | — | — | — |
| Dependency Analyzer | **Missing** | Full | `projects/dependency-analyzer.ts` (new) | dependency tree, vulnerability scan | — |
| Build Status Reporter | **Missing** | Full | `projects/build-reporter.ts` (new) | build runner, status aggregator | — |
| CI/CD Integration | **Missing** | Full | `projects/cicd-connector.ts` (new) | GitHub Actions, Vercel, Netlify | — |
| Watch Mode (Auto-Update) | **Missing** | Full | `projects/watch-mode.ts` (new) | chokidar, debounce, event emitter | — |
| Project Health Score | Basic | Full | `projects/health-scorer.ts` (new) | composite score, trend analysis | — |

**Files required:**
- `server/src/projects/dependency-analyzer.ts` (new)
- `server/src/projects/build-reporter.ts` (new)
- `server/src/projects/cicd-connector.ts` (new)
- `server/src/projects/watch-mode.ts` (new)
- `server/src/projects/health-scorer.ts` (new)

**APIs required:**
- `POST /api/projects/:id/build` — trigger build
- `GET /api/projects/:id/dependencies` — list dependencies
- `GET /api/projects/:id/health-score` — composite health
- `GET /api/projects/:id/cicd-status` — CI/CD pipeline status

---

## L6: Connector Layer — Gap Analysis

| Connector | Current | Target | Files Required | Status |
|-----------|---------|--------|----------------|--------|

| Connector | Current | Target | Files Required | Status |
|-----------|---------|--------|----------------|--------|
| raw-website-connector | ✅ Operational | ✅ | — | Complete |
| bakudan-website-connector | ✅ Operational | ✅ | — | Complete |
| dashboard-connector | ✅ Operational | ✅ | — | Complete |
| remote-proxy-connector | ✅ Operational | ✅ | — | Complete |
| project-connector | ✅ Operational | ✅ | — | Complete |
| local-projects | ✅ Full | ✅ | — | Complete |
| accounting-connector | ⚠️ Partial | ✅ | Upgrade existing | Fix: add cache + error recovery |
| food-safety-connector | ⚠️ Partial | ✅ | Upgrade existing | Fix: add live sync option |
| asana-connector | ⚠️ Partial | ✅ | Upgrade existing | Fix: set ASANA_TOKEN, test flow |
| gmail-connector | ⚠️ Partial | ✅ | `visibility/connectors/google/gmail-connector.ts` upgrade | Fix: OAuth refresh handling |
| calendar-connector | ⚠️ Partial | ✅ | `visibility/connectors/google/calendar-connector.ts` upgrade | Fix: same as gmail |
| drive-connector | ⚠️ Partial | ✅ | `visibility/connectors/google/drive-connector.ts` upgrade | Fix: same as gmail |
| health-connector | ⚠️ Stub | ✅ | `visibility/connectors/health/health-connector.ts` (new) | Fix: live Huawei Health API |
| stub-connector | ✅ Operational | ✅ | — | Complete |
| slack-connector | ❌ Missing | ✅ | `visibility/connectors/slack-connector.ts` (new) | **New** |
| github-connector | ❌ Missing | ✅ | `visibility/connectors/github-connector.ts` (new) | **New** |
| vercel-connector | ❌ Missing | ✅ | `visibility/connectors/vercel-connector.ts` (new) | **New** |
| jira-connector | ❌ Missing | ✅ | `visibility/connectors/jira-connector.ts` (new) | **New** |
| aws-cost-connector | ❌ Missing | ✅ | `visibility/connectors/aws-cost-connector.ts` (new) | **New** |

**Missing connectors (total: 5 new + 6 upgrades = 11 items):**

#### New Connectors Needed

| Connector | Priority | Files Required | APIs Required |
|-----------|----------|----------------|---------------|
| Slack | High | `visibility/connectors/slack-connector.ts` | `POST /api/visibility/slack/send` |
| GitHub Actions | High | `visibility/connectors/github-connector.ts` | `GET /api/projects/:id/ci-status` |
| Vercel/Netlify | Medium | `visibility/connectors/vercel-connector.ts` | `POST /api/visibility/deploy/:project` |
| Jira | Medium | `visibility/connectors/jira-connector.ts` | `GET /api/visibility/jira/tickets` |
| AWS/Azure Cost | Low | `visibility/connectors/aws-cost-connector.ts` | `GET /api/visibility/cloud-costs` |

#### Connector Upgrades Needed

| Connector | Upgrade Required | Effort |
|-----------|-----------------|--------|
| Gmail | OAuth token auto-refresh + error messages | 3h |
| Calendar | Same as Gmail | 2h |
| Drive | Same as Gmail | 2h |
| Asana | Test and activate with ASANA_TOKEN | 2h |
| Health | Replace file-export with live API | 4h |
| Accounting | Add retry + cache fallback | 2h |

---

## L7: Approval Gate — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| Level 1-3 | Full | Full | — | — | — |
| Persistent Queue | **Missing** | Full | `approval/persistence.ts` (new) | file/DB persistence, recovery | — |
| Approval Timeouts | **Missing** | Full | `approval/timeout-manager.ts` (new) | auto-expire, reminder | — |
| Escalation Path | **Missing** | Full | `approval/escalation.ts` (new) | notify alternate, escalation rules | — |
| Approval Analytics | **Missing** | Full | `approval/analytics.ts` (new) | metrics, patterns, reports | — |

**Files required:**
- `server/src/approval/persistence.ts` (new)
- `server/src/approval/timeout-manager.ts` (new)
- `server/src/approval/escalation.ts` (new)
- `server/src/approval/analytics.ts` (new)

**APIs required:**
- `GET /api/approval/history` — past approvals
- `GET /api/approval/analytics` — approval metrics
- `POST /api/approval/:id/timeout` — configure timeout

---

## L8: Execution Engine — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| Agent Engine Bridge | ⚠️ Buggy | Full | `agent-engine/bridge.mjs` fix | Error boundary | — |
| Patch Pipeline | Full | Full | — | — | — |
| Deployment Executor | **Missing** | Full | `autonomous-coding/DeploymentExecutor.js` (new) | build → deploy → verify | — |
| Rollback Automation | **Missing** | Full | `autonomous-coding/RollbackEngine.js` (new) | snapshot, revert, verify | — |
| Cline Bridge | Partial | Full | `autonomous-coding/ClineControlBridge.js` | Wire to route | — |
| Autonomous Decision Engine | Partial | Full | `autonomous/AutonomousDecisionEngine.js` | Wire to route | — |
| Learning Loop | Partial | Full | `autonomous/LearningLoop.js` | Wire to route | — |

**Files required:**
- `agent-engine/autonomous-coding/DeploymentExecutor.js` (new)
- `agent-engine/autonomous-coding/RollbackEngine.js` (new)
- `agent-engine/autonomous-coding/ClineControlBridge.js` (upgrade)

**APIs required:**
- `POST /api/agent-engine/deploy` — trigger deployment
- `POST /api/agent-engine/rollback` — trigger rollback
- `GET /api/agent-engine/deployment-status` — deployment progress

---

## L9: QA + Security — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| QA Modules | Partial | Full | Upgrade all `autonomous-qa/` | Wire to bridge | — |
| CI Integration | **Missing** | Full | `.github/workflows/qa.yml` (new) | CI trigger, report | — |
| Regression Detection | **Missing** | Full | `qa/regression-detector.ts` (new) | diff analysis, baseline | — |
| Performance Benchmarks | **Missing** | Full | `qa/benchmark-runner.ts` (new) | perf metrics, comparison | — |
| CSP Headers | **Missing** | Full | `index.ts` upgrade | — | — |
| HTTPS | **Missing** | Full | `index.ts` upgrade | TLS cert handling | — |
| Encryption at Rest | **Missing** | Full | `security/encryption.ts` (new) | AES-256, key management | — |
| Secrets Rotation | **Missing** | Full | `security/rotation.ts` (new) | schedule, audit | — |

**Files required:**
- `.github/workflows/qa.yml` (new)
- `server/src/qa/regression-detector.ts` (new)
- `server/src/qa/benchmark-runner.ts` (new)
- `server/src/security/encryption.ts` (new)
- `server/src/security/rotation.ts` (new)

**APIs required:**
- `POST /api/qa/run` — trigger QA pipeline
- `GET /api/qa/results/:project` — QA results
- `GET /api/qa/regression` — regression report

---

## L10: Remote Control — Gap Analysis

| Component | Current | Target | Files Required | Modules Required | APIs Required |
|-----------|---------|--------|----------------|------------------|---------------|
| Remote Auth | Full | Full | — | — | — |
| mi-remote-agent | Full | Full | — | — | — |
| Health Heartbeat | **Missing** | Full | `mi-remote-agent/index.mjs` upgrade | PING/PONG, reconnect | — |
| Auto-Discovery | **Missing** | Full | `mi-remote-agent/discovery.ts` (new) | mDNS/broadcast | — |
| Encrypted Channel | **Missing** | Full | `mi-remote-agent/crypto.ts` (new) | TLS, key exchange | — |
| Multi-Hop Routing | **Missing** | Full | `projects/connectors/remote-proxy-connector.ts` upgrade | chain proxy | — |

**Files required:**
- `mi-remote-agent/discovery.ts` (new)
- `mi-remote-agent/crypto.ts` (new)
- `server/src/projects/connectors/remote-proxy-connector.ts` (upgrade)

**APIs required:**
- `GET /api/remote/discover` — list available agents
- `POST /api/remote/agent/:id/ping` — health check
- `POST /api/remote/chain` — multi-hop command

---

## Total Gap Summary

### New Files Required: 42 files

| Category | Count | Key Files |
|----------|-------|-----------|
| Intelligence | 3 | personality-engine.ts, context-manager.ts, context-truncator.ts |
| Memory | 4 | vector-memory.ts, memory-expiry.ts, context-fuser.ts, consolidator.ts |
| Knowledge | 9 | vector-index.ts, kb-bridge.ts, active-learner.ts, web-crawler.ts + 5 pack dirs |
| Visibility | 5 | push-engine.ts, alert-engine.ts, freshness.ts, rate-limit-scheduler.ts, snapshot-emailer.ts |
| Projects | 5 | dependency-analyzer.ts, build-reporter.ts, cicd-connector.ts, watch-mode.ts, health-scorer.ts |
| Connectors | 5 | slack-connector.ts, github-connector.ts, vercel-connector.ts, jira-connector.ts, aws-cost-connector.ts |
| Approval | 4 | persistence.ts, timeout-manager.ts, escalation.ts, analytics.ts |
| Execution | 3 | DeploymentExecutor.js, RollbackEngine.js, ClineControlBridge upgrade |
| QA + Security | 5 | qa.yml, regression-detector.ts, benchmark-runner.ts, encryption.ts, rotation.ts |
| Remote | 3 | discovery.ts, crypto.ts, remote-proxy upgrade |

### New APIs Required: 24 endpoints

| Category | Count | Notes |
|----------|-------|-------|
| Brain | 3 | mode switch, context, personality |
| Memory | 3 | vector search, consolidate, stats |
| Knowledge | 6 | embed, search, packs, crawl, stats |
| Visibility | 4 | freshness, sync, alerts, dismiss |
| Projects | 4 | build, deps, health-score, cicd |
| Approval | 3 | history, analytics, timeout |
| Agent Engine | 3 | deploy, rollback, deployment-status |
| QA | 3 | run, results, regression |
| Remote | 3 | discover, ping, chain |

### New UIs Required: 5 pages

| Page | URL | Purpose |
|------|-----|---------|
| health.html | /health.html | Connector health dashboard |
| visibility.html | /visibility.html | Visibility management |
| knowledge.html | /knowledge.html | Knowledge search and management |
| remote.html | /remote.html | Remote agent health dashboard |
| qa.html | /qa.html | QA results and regression reports |

### Immediate Fix (No new file — existing code)

| Bug | File | Fix |
|-----|------|-----|
| `await` in non-async handler | `agent-engine/bridge.mjs:199` | Add `async` to route handler |
| Empty knowledge packs | `server/src/knowledge/packs/` | Create pack content files |
| Google OAuth token refresh | `visibility/connectors/google/google-auth.ts` | Add auto-refresh on 401 |
| Approval queue not persisted | `approval/gate.ts` | Add JSON file persistence |
| Owner-profile JSON files not synced | `owner-profile/` | Deprecate in favor of executive-memory |
