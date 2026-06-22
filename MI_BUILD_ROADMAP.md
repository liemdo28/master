# MI BUILD ROADMAP V1
**Date:** 2026-06-09
**Status:** PLANNING — Ready to execute
**Version:** 1.0.0

---

## Sprint Structure

Each sprint = 1-3 days of focused work. Order is optimized for:
1. **Dependencies** — do prerequisite modules first
2. **Value** — highest-impact features earliest
3. **Risk** — risky items started early with buffer
4. **Testing** — each sprint ends with verification

---

## Priority 1: Universal Visibility (Days 1-3)

### Sprint 1.1 — Visibility Stability (Day 1)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Fix Google OAuth token refresh | `visibility/connectors/google/google-auth.ts` | 4h |
| Add connector failure alerts via WebSocket | `visibility/visibility-hub.ts` | 2h |
| Add data freshness metrics (last_sync age) | `visibility/connector-registry.ts` | 1h |
| Add sync error propagation to UI | `routes/visibility.ts` | 1h |

**Dependencies:** None (improves existing system)

### Sprint 1.2 — Real-Time Push (Day 2)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Add push-based connector update (chokidar watcher for local) | `visibility/visibility-hub.ts` | 3h |
| WebSocket broadcast on all sync events | `index.ts` | 2h |
| LiveBoard auto-refresh on push | `ui/liveboard.html` | 2h |

**Dependencies:** Sprint 1.1

### Sprint 1.3 — Health Dashboard (Day 3)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Live connector health page at `/health-dashboard` | `ui/health.html` | 3h |
| Health check API with per-connector status | `routes/health.ts` | 2h |

**Dependencies:** Sprint 1.1-1.2

---

## Priority 2: Project Connectors (Days 4-6)

### Sprint 2.1 — Connector Expansion (Day 4)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Slack connector (read messages, channels) | `visibility/connectors/slack-connector.ts` | 3h |
| GitHub Actions connector (workflow status) | `visibility/connectors/github-connector.ts` | 3h |

**Dependencies:** Priority 1

### Sprint 2.2 — Connector Router Enhancement (Day 5)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Improve NLP intent → connector matching | `projects/connector-router.ts` | 3h |
| Add connector auto-discovery (detect new projects) | `projects/project-scanner.ts` | 2h |
| Add connector health to briefing engine | `connectors/briefing-engine.ts` | 1h |

**Dependencies:** Sprint 2.1

### Sprint 2.3 — Website Connectors Deep Sync (Day 6)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Raw Sushi — add Astro build status detection | `projects/connectors/raw-website-connector.ts` | 2h |
| Bakudan — add live site check (HTTP ping) | `projects/connectors/bakudan-website-connector.ts` | 2h |
| Dashboard — add task reading from PHP | `projects/connectors/dashboard-connector.ts` | 2h |

**Dependencies:** Sprint 2.2

---

## Priority 3: Knowledge Federation (Days 7-9)

### Sprint 3.1 — Knowledge Pack Delivery (Day 7)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Create Business knowledge pack | `knowledge/packs/business/` (3-5 files) | 3h |
| Create Health knowledge pack | `knowledge/packs/health/` (3-5 files) | 2h |
| Create Technology knowledge pack | `knowledge/packs/technology/` (3-5 files) | 2h |
| Create Restaurant knowledge pack | `knowledge/packs/restaurant/` (3-5 files) | 2h |
| Create Finance knowledge pack | `knowledge/packs/finance/` (3-5 files) | 2h |

**Dependencies:** None (files only)

### Sprint 3.2 — Dual KB Unification (Day 8)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Bridge server KB ↔ agent-engine KB | `knowledge/knowledge-db.ts` | 4h |
| Add agent KB query to response pipeline | `pipeline/response-pipeline.ts` | 2h |
| Search UI in brain.html for knowledge | `ui/brain.html` | 2h |

**Dependencies:** Sprint 3.1

### Sprint 3.3 — Vector Search (Day 9)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Embedding service (Python + Ollama embeddings) | `ai-service/main.py` | 3h |
| Vector index in knowledge-db | `knowledge/knowledge-db.ts` | 3h |
| Hybrid search (FTS5 + vector) | `knowledge/knowledge-db.ts` | 2h |

**Dependencies:** Sprint 3.2

---

## Priority 4: Remote Control (Days 10-11)

### Sprint 4.1 — Remote Agent Enhancement (Day 10)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Add health heartbeat PING/PONG | `mi-remote-agent/index.mjs` | 2h |
| Add auto-discovery (mDNS/broadcast) | `mi-remote-agent/index.mjs` | 3h |
| Add encrypted channel option | `mi-remote-agent/index.mjs` | 2h |

**Dependencies:** None

### Sprint 4.2 — Multi-Hop Routing (Day 11)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Remote proxy chain (Mi → Agent A → Agent B) | `projects/connectors/remote-proxy-connector.ts` | 3h |
| Remote health dashboard | `ui/remote.html` | 2h |
| Remote command history log | `routes/remote.ts` | 1h |

**Dependencies:** Sprint 4.1

---

## Priority 5: Execution Engine (Days 12-15)

### Sprint 5.1 — Fix Bridge Bug + Stabilize (Day 12)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Fix `await` in non-async handler (line 199) | `agent-engine/bridge.mjs` | 0.5h |
| Add error boundary for all routes | `agent-engine/bridge.mjs` | 1h |
| Add request timeout middleware | `agent-engine/bridge.mjs` | 1h |
| Add health check with module status | `agent-engine/bridge.mjs` | 1h |

**Dependencies:** None

### Sprint 5.2 — Execution Workflow Tests (Day 13)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| End-to-end: plan → validate → apply → track | New test file | 3h |
| Safe file editor dry-run mode test | Test in `autonomous-coding/` | 2h |
| Patch evidence store verification | Test in `autonomous-coding/` | 1h |

**Dependencies:** Sprint 5.1

### Sprint 5.3 — Cline Bridge Wiring (Day 14)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Wire ClineControlBridge to agent-engine route | `routes/agent-engine.ts` | 3h |
| Add Claude Code integration endpoint | `autonomous-coding/ClineControlBridge.js` | 3h |

**Dependencies:** Sprint 5.2

### Sprint 5.4 — Deployment Executor (Day 15)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Deployment executor (npm run build → deploy) | `autonomous-coding/DeploymentExecutor.js` | 4h |
| Approval-gated deployment flow | `routes/agent-engine.ts` | 2h |

**Dependencies:** Sprint 5.3

---

## Priority 6: Security Sprint 2 (Days 16-17)

### Sprint 6.1 — Data at Rest Encryption (Day 16)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Encrypt sensitive JSON files (personal, consent, devices) | `memory/executive-memory.ts` | 3h |
| Encryption utility module | `security/encryption.ts` | 2h |
| Key management via env var | `.env.example` | 1h |

**Dependencies:** None

### Sprint 6.2 — CSP + HTTPS + Secrets (Day 17)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Add Content Security Policy headers | `index.ts` | 2h |
| HTTPS support (self-signed for LAN) | `index.ts` | 2h |
| Secrets rotation helper | `security/rotation.ts` | 2h |

**Dependencies:** Sprint 6.1

---

## Priority 7: Autonomous Workflows (Days 18-21)

### Sprint 7.1 — Autonomous Decision Engine (Day 18)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Wire AutonomousDecisionEngine to server | `routes/agent-engine.ts` | 3h |
| Goal tracker integration | `autonomous/GoalTracker.js` | 2h |
| Scheduled autonomous tasks | `cron/sync-scheduler.ts` | 2h |

**Dependencies:** Priority 5

### Sprint 7.2 — QA Pipeline Activation (Day 19)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Wire QA runner to agent-engine bridge | `autonomous-qa/qaPlanner.js` | 3h |
| Route crawler → screenshot → a11y → SEO | `autonomous-qa/` pipeline | 3h |
| QA result dashboard | `ui/qa.html` | 2h |

**Dependencies:** Sprint 7.1

### Sprint 7.3 — Continuous Learning Loop (Day 20)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| Wire LearningLoop | `autonomous/LearningLoop.js` | 3h |
| Connect learning to decision memory | `memory/executive-memory.ts` | 2h |
| Lesson extraction from failures | `autonomous/FailureStopper.js` | 2h |

**Dependencies:** Sprint 7.2

### Sprint 7.4 — Polish & Final Integration (Day 21)

| Deliverable | Files | Effort |
|-------------|-------|--------|
| End-to-end integration test | New test suite | 4h |
| Fix any remaining TypeScript/runtime issues | Various | 4h |

**Dependencies:** All prior sprints

---

## Timeline Summary

```
Week 1 (Days 1-6):    P1 Visibility + P2 Connectors
Week 2 (Days 7-11):   P3 Knowledge + P4 Remote
Week 3 (Days 12-17):  P5 Execution + P6 Security
Week 4 (Days 18-21):  P7 Autonomous Workflows

Total: 21 days (4 weeks)
```

## Resource Requirements

| Resource | For |
|----------|-----|
| Ollama with embedding model | Priority 3 (vector search) |
| ASANA_TOKEN in .env | Connector activation |
| Google OAuth refresh tokens | Visibility stability |
| integration-system machine running | Remote agent deployment |
| whatsapp-api machine running | Remote agent deployment |
| Accounting engine (port 8844) | Execution engine integration |

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Google OAuth tokens expire silently | High | Medium | Add auto-refresh with clear error message |
| Remote agent machines offline | High | Medium | Add health heartbeat + auto-retry |
| Knowledge packs too large | Medium | Low | Start with 5 files per pack, expand later |
| Bridge bug crashes agent-engine | High | High (confirmed bug) | Fix in Sprint 5.1 — day 1 of P5 |
| LLM context window limits | Medium | Medium | Implement smart truncation in pipeline |
