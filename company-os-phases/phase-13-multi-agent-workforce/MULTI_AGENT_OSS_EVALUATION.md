# MULTI_AGENT_OSS_EVALUATION.md — Multi-Agent Framework OSS Evaluation

**Generated:** 2026-06-27
**Purpose:** Evaluate OSS tools for multi-agent orchestration

---

## Evaluated OSS Frameworks

| Tool | Category | License | Use Case | Evaluation | Decision |
|------|----------|---------|----------|------------|----------|
| CrewAI | Multi-Agent | Apache-2.0 | Agent orchestration | DISCOVERY | Monitor — complex for current scale |
| AutoGen | Multi-Agent | MIT | Agent conversation | DISCOVERY | Monitor — Microsoft backed |
| LangGraph | Agent Orchestration | MIT | Graph-based agents | DISCOVERY | Evaluate for Phase 20 |
| OpenHands | Autonomous Agent | MIT | Code-focused agents | DISCOVERY | Use for Engineering Agent |
| MetaGPT | Multi-Agent | MIT | Software dev agents | DISCOVERY | Not needed |
| ChatDev | Multi-Agent | MIT | Software dev chat | DISCOVERY | Not needed |
| SWE-agent | Agent | MIT | Code repair | DISCOVERY | Not needed |
| Aider | AI Coding | Apache-2.0 | Pair programming | PRODUCTION | Engineering Agent tool |
| Continue | AI IDE | Apache-2.0 | IDE integration | DISCOVERY | Engineering Agent tool |
| TaskWeaver | Agent | MIT | Code + data | DISCOVERY | Not needed |
| Dify | Workflow + Agents | Apache-2.0 | No-code agents | DISCOVERY | Not needed |
| Flowise | AI Workflow | Apache-2.0 | Visual workflows | DISCOVERY | Not needed |
| Langflow | AI Workflow | MIT | Visual LangChain | DISCOVERY | Not needed |

---

## Recommended Stack

| Component | OSS | Decision |
|-----------|-----|----------|
| Agent Tooling | Aider, Continue, OpenHands | Use for Engineering Agent |
| Agent Orchestration | Custom (Mi built) | No external framework needed |
| Workflow | n8n | Already in PRODUCTION |

---

## Not Adopted Rationale

| Tool | Reason |
|------|--------|
| CrewAI | Overkill — Mi already has custom agent registry and handoff |
| AutoGen | Complex setup, not needed for current use case |
| LangGraph | Monitor for Phase 20 if complexity increases |
| Dify/Flowise/Langflow | n8n already handles workflow orchestration |

---

## Status: ✅ MULTI_AGENT_OSS_EVALUATION_COMPLETE
