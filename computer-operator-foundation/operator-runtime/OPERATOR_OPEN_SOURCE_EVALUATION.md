# OPERATOR_OPEN_SOURCE_EVALUATION

Status: **COMPLETE**
Date: 2026-06-27
Scope: Phase 2B — Open Source Evaluation for Operator Runtime Stack

## Evaluation Criteria

Each tool is scored 1-10 on:
- **Safety**: Sandbox capability, readonly mode, no credentials leak
- **Maturity**: GitHub stars, release cadence, community activity
- **Fit**: How well it matches Mi's operator runtime needs (Playwright already chosen)
- **Risk**: License risk, supply chain, maintenance burden
- **Windows Support**: Runs on Windows 11 natively

## Evaluated Tools

### 1. Playwright (Microsoft) — SELECTED ✅
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 9 | Headless mode, sandbox, no credentials required for local |
| Maturity | 10 | 70k+ stars, Microsoft-backed, weekly releases |
| Fit | 10 | Already integrated in Phase 2B; 9/9 tests pass |
| Risk | 9 | Apache 2.0, well-maintained, no supply chain concerns |
| Windows | 10 | Native Windows support, Chromium/Firefox/WebKit |
| **Total** | **48/50** | **SELECTED — Phase 2B runtime engine** |

### 2. Browser Use (browser-use) — PROMISING
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 8 | Agent-based, sandbox-friendly |
| Maturity | 6 | 20k+ stars, active but early-stage |
| Fit | 8 | Good for high-level "do task" abstraction |
| Risk | 7 | MIT license, Python ecosystem |
| Windows | 8 | Python-based, cross-platform |
| **Total** | **37/50** | **PILOT candidate for Phase 2C** |

### 3. Stagehand (Browserbase) — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 7 | AI-driven, act()/extract()/observe() primitives |
| Maturity | 5 | 10k+ stars, fast-moving, API changes |
| Fit | 7 | AI-native but adds LLM dependency |
| Risk | 6 | Browserbase dependency, vendor risk |
| Windows | 7 | Node.js, cross-platform |
| **Total** | **32/50** | **Watch — not selected** |

### 4. Skyvern — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 7 | Computer vision + LLM, sandbox |
| Maturity | 5 | 8k+ stars, young project |
| Fit | 6 | CV-based, good for visual automation |
| Risk | 6 | AGPL license, compliance risk for Mi |
| Windows | 7 | Python, cross-platform |
| **Total** | **31/50** | **AGPL blocker — not selected** |

### 5. OpenClaw — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 6 | Agent framework, needs guardrails |
| Maturity | 3 | <1k stars, very early |
| Fit | 5 | General agent, not browser-specific |
| Risk | 5 | Unknown maintenance trajectory |
| Windows | 7 | Python, cross-platform |
| **Total** | **26/50** | **Too early — not selected** |

### 6. OpenHands (All Hands AI) — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 7 | Sandboxed dev agent, Docker-based |
| Maturity | 7 | 45k+ stars, active community |
| Fit | 6 | Dev-focused, not operator-focused |
| Risk | 7 | MIT license, strong community |
| Windows | 6 | Docker-dependent, heavier |
| **Total** | **33/50** | **Good for dev tasks, not operator** |

### 7. Open Interpreter — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 5 | Executes code directly, needs approval mode |
| Maturity | 7 | 55k+ stars, popular |
| Fit | 6 | Code execution, not browser |
| Risk | 6 | AGPL license, compliance risk |
| Windows | 8 | Python, cross-platform |
| **Total** | **32/50** | **AGPL + safety concern — not selected** |

### 8. AutoHotkey — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 4 | System-level automation, hard to sandbox |
| Maturity | 8 | 20+ years, large community |
| Fit | 5 | Windows-only desktop automation |
| Risk | 6 | GPL v2, compliance risk |
| Windows | 10 | Windows-native, excellent |
| **Total** | **33/50** | **GPL blocker — not selected** |

### 9. pywinauto — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 5 | Desktop automation, needs sandbox |
| Maturity | 7 | 5k+ stars, stable |
| Fit | 7 | Good for QuickBooks Desktop automation |
| Risk | 7 | BSD license, low risk |
| Windows | 10 | Windows-native, excellent |
| **Total** | **36/50** | **PILOT candidate for Phase 3C (QuickBooks Desktop)** |

### 10. Robot Framework — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 7 | Keyword-driven, good audit trail |
| Maturity | 9 | 10k+ stars, enterprise-proven |
| Fit | 6 | Generic test automation, not browser-specific |
| Risk | 8 | Apache 2.0, low risk |
| Windows | 8 | Python, cross-platform |
| **Total** | **38/50** | **Good for test automation, not operator** |

### 11. WinAppDriver (Microsoft) — EVALUATED
| Criterion | Score | Notes |
|-----------|-------|-------|
| Safety | 5 | Windows UI automation, needs sandbox |
| Maturity | 6 | Microsoft-backed but slow updates |
| Fit | 6 | Windows desktop only |
| Risk | 7 | MIT license, Microsoft |
| Windows | 10 | Windows-native |
| **Total** | **34/50** | **Deprecated trajectory — not selected** |

## Final Selection

| Tool | Status | Phase |
|------|--------|-------|
| **Playwright** | ✅ SELECTED | Phase 2B (runtime engine) |
| **Browser Use** | 🔵 PILOT | Phase 2C (high-level abstraction) |
| **pywinauto** | 🔵 PILOT | Phase 3C (QuickBooks Desktop) |
| Stagehand | 👀 Watch | Future |
| Robot Framework | ⏸️ Deferred | Test automation |
| All others | ❌ Rejected | License/safety/maturity |

## Registry
- **Owner**: Computer Operator Division
- **Approval**: Executive Coordination required before piloting any new tool
- **Dedup**: No duplicate tools in same category
- **Evidence**: This evaluation file stored in operator-runtime/evidence/

## Coordination Integration
- Objective registered: `OBJ-P2B-OSS-EVAL`
- Task: `COP-001` (Open Source Evaluation)
- Evidence: All 11 tools evaluated with scores and rationale
- Dashboard: `OPERATOR_OPEN_SOURCE_EVALUATION.md` → Executive Coordination
