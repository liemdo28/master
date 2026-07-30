# TOOL_REGISTRY_REPORT.md
> Phase 2 — Tool Registry
> Date: 2026-06-18
> Target: TOOL_REGISTRY_READY

---

## Tool Count: 31 registered tools across 9 categories

### Communication & Assistant Tools (6)
| Tool ID | Owner Dept | Execution | Credential | Approval | Evidence | On Failure |
|---------|-----------|-----------|------------|----------|----------|------------|
| task-snapshot | executive-assistant | HTTP_API | CONFIGURED | No | Yes | SKIP |
| task-today | executive-assistant | HTTP_API | CONFIGURED | No | Yes | SKIP |
| task-approvals | executive-assistant | HTTP_API | CONFIGURED | No | Yes | SKIP |
| health-intel | executive-assistant | HTTP_API | CONFIGURED | No | No | SKIP |
| gmail | executive-assistant | EXTERNAL_API | CONFIGURED | No | Yes | ALERT_CEO |
| calendar | executive-assistant | EXTERNAL_API | CONFIGURED | No | Yes | SKIP |

### Finance Tools (4)
| Tool ID | Owner Dept | Execution | Credential | Approval | Evidence | On Failure |
|---------|-----------|-----------|------------|----------|----------|------------|
| quickbooks | finance | EXTERNAL_API | CONFIGURED | **Yes** | Yes | ABORT |
| toast-pos | finance | EXTERNAL_API | CONFIGURED | No | Yes | FALLBACK |
| accounting-engine | finance | HTTP_API | CONFIGURED | No | Yes | ALERT_CEO |
| pdf-evidence | finance | REQUIRE_MODULE | CONFIGURED | **Yes** | Yes | ABORT |

### Operations Tools (4)
| Tool ID | Owner Dept | Execution | Credential | Approval | Evidence | On Failure |
|---------|-----------|-----------|------------|----------|----------|------------|
| visibility-dashboard | technical-operations | HTTP_API | CONFIGURED | No | Yes | SKIP |
| food-safety | restaurant-intelligence | HTTP_API | CONFIGURED | No | Yes | SKIP |
| doordash | restaurant-intelligence | EXTERNAL_API | CONFIGURED | No | Yes | FALLBACK |
| review-system | marketing | HTTP_API | CONFIGURED | No | Yes | SKIP |

### Engineering Tools (3)
| Tool ID | Owner Dept | Execution | Credential | Approval | Evidence | On Failure |
|---------|-----------|-----------|------------|----------|----------|------------|
| git | engineering | CLI | CONFIGURED | No | Yes | SKIP |
| build | engineering | CLI | CONFIGURED | **Yes** | Yes | ABORT |
| logs | engineering | CLI | CONFIGURED | No | Yes | SKIP |

### Infrastructure Tools (4)
| Tool ID | Owner Dept | Execution | Credential | Approval | Evidence | On Failure |
|---------|-----------|-----------|------------|----------|----------|------------|
| pm2-status | infrastructure | HTTP_API | CONFIGURED | No | Yes | SKIP |
| node-registry | infrastructure | HTTP_API | CONFIGURED | No | No | SKIP |
| health-checks | infrastructure | HTTP_API | CONFIGURED | No | Yes | ALERT_CEO |
| docker | infrastructure | CLI | CONFIGURED | No | Yes | SKIP |

### Intelligence / Memory Tools (8)
| Tool ID | Owner Dept | Execution | Credential | Approval | Evidence | On Failure |
|---------|-----------|-----------|------------|----------|----------|------------|
| briefing-latest | report-center | HTTP_API | CONFIGURED | No | No | SKIP |
| strategic-memory | report-center | HTTP_API | CONFIGURED | No | No | SKIP |
| agenview-snapshot | report-center | HTTP_API | CONFIGURED | No | No | SKIP |
| pipeline-history | qa | HTTP_API | CONFIGURED | No | No | SKIP |
| evidence-reader | qa | SQLITE_DIRECT | CONFIGURED | No | No | ABORT |
| dept-definitions | dispatch | REQUIRE_MODULE | CONFIGURED | No | No | SKIP |
| source-inventory-reader | library | REQUIRE_MODULE | CONFIGURED | No | No | SKIP |
| rag-search | library | HTTP_API | CONFIGURED | No | No | SKIP |
| document-search | library | HTTP_API | CONFIGURED | No | No | SKIP |

### Creative Tools (3)
| Tool ID | Owner Dept | Execution | Credential | Approval | Evidence | On Failure |
|---------|-----------|-----------|------------|----------|----------|------------|
| comfyui | brand-creative | HTTP_API | **MISSING** | **Yes** | Yes | ALERT_CEO |
| flux | brand-creative | HTTP_API | **MISSING** | **Yes** | Yes | ALERT_CEO |
| restaurant-creative-engine | brand-creative | HTTP_API | **MISSING** | **Yes** | Yes | SKIP |

---

## Tools Requiring Approval Before Execution

| Tool ID | Reason |
|---------|--------|
| quickbooks | Financial data access |
| pdf-evidence | Financial document extraction |
| build | Code compilation (irreversible) |
| comfyui | Creative output, AI generation |
| flux | Creative output, AI generation |
| restaurant-creative-engine | Creative output, AI generation |

---

## Missing Credentials (Phase 10 dependencies)

| Tool ID | Status | Required For |
|---------|--------|-------------|
| comfyui | MISSING | Phase 10 — Image generation |
| flux | MISSING | Phase 10 — High-quality images |
| restaurant-creative-engine | MISSING | Phase 10 — Restaurant creatives |

---

## Department ↔ Tool Assignment

| Department | Tool Count | Tools |
|-----------|-----------|-------|
| dispatch | 2 | dept-definitions, pipeline-history |
| executive-assistant | 6 | task-snapshot, task-today, task-approvals, health-intel, gmail, calendar |
| report-center | 5 | briefing-latest, visibility-dashboard, agenview-snapshot, strategic-memory, pipeline-history |
| library | 4 | dept-definitions, source-inventory-reader, rag-search, document-search |
| qa | 2 | evidence-reader, pipeline-history |
| finance | 6 | visibility-dashboard, strategic-memory, quickbooks, toast-pos, accounting-engine, pdf-evidence |
| tax-compliance | 3 | quickbooks, pdf-evidence, accounting-engine |
| restaurant-intelligence | 4 | visibility-dashboard, toast-pos, doordash, food-safety |
| engineering | 5 | pipeline-history, evidence-reader, git, build, logs |
| infrastructure | 5 | pm2-status, node-registry, visibility-dashboard, health-checks, docker |
| marketing | 4 | strategic-memory, visibility-dashboard, doordash, review-system |
| brand-creative | 4 | strategic-memory, comfyui, flux, restaurant-creative-engine |
| technical-operations | 4 | pm2-status, node-registry, visibility-dashboard, health-checks |
| rd | 4 | source-inventory-reader, dept-definitions, strategic-memory, rag-search |

---

## Status: TOOL_REGISTRY_READY ✅
