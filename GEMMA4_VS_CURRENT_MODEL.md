# GEMMA4_VS_CURRENT_MODEL.md
> Mi-Core Brain Comparison — Gemma 4 12B vs qwen3:8b (Current Production)
> Date: 2026-06-15 | Evaluator: Mi-Core Dev Team | Status: DRAFT

---

## 1. Head-to-Head Comparison Matrix

| Criterion | Gemma 4 12B | qwen3:8b (Current) | Delta | Winner |
|-----------|------------|---------------------|-------|--------|
| **Intent Classification Accuracy** | TBD | 96%+ | — | — |
| **Multi-Intent Decomposition** | TBD | 95%+ | — | — |
| **Workflow Planning Quality** | TBD | 92%+ | — | — |
| **QB Finance Accuracy** | TBD | 98%+ | — | — |
| **Dashboard Audit Quality** | TBD | 94%+ | — | — |
| **WhatsApp Command Understanding** | TBD | 96%+ | — | — |
| **Approval Reasoning Accuracy** | TBD | 90%+ | — | — |
| **Memory Recall Context** | TBD | 88%+ | — | — |
| **Latency (avg ms)** | TBD | ~1,200ms | — | — |
| **RAM Usage (GB)** | TBD | ~6.5 GB | — | — |
| **Hallucination Rate (%)** | TBD | ~3% | — | — |
| **Workflow Success Rate (%)** | TBD | 94%+ | — | — |
| **Vietnamese Fluency** | TBD | Native-level | — | — |
| **Injection Resistance** | TBD | High | — | — |
| **Code Generation** | TBD | Good (qwen2.5-coder:7b) | — | — |
| **Multilingual Support** | 50+ langs | 20+ langs | — | — |
| **Context Window** | 32K | 32K | 0 | Tie |
| **Quantization** | Q4_K_M | Q4_K_M | — | Tie |
| **Model Size** | 12B | 8B | +4B | — |

---

## 2. Detailed Dimension Analysis

### 2.1 Intent Classification

**Current (qwen3:8b):**
- Intent classification is primarily **rule-based regex** (GStack intent-router.ts)
- LLM is NOT used for intent classification in production
- qwen3:8b handles downstream reasoning only
- Score: 96%+ accuracy on 100 CEO phrases

**Gemma 4 12B:**
- Would be used for same downstream reasoning tasks
- Expected: Comparable or better multilingual intent understanding
- Risk: May overthink simple intents where regex would suffice
- Test verdict: **Pending evaluation**

**Recommendation:** Keep GStack rule-based intent router as gate. Use Gemma 4 12B only for downstream reasoning.

### 2.2 Multi-Intent Decomposition

**Current (qwen3:8b):**
- Compound messages like "Dashboard + QB" → 2–4 child workflows
- Achieved via system prompt engineering + qwen3:8b
- Score: 95%+ decomposition accuracy

**Gemma 4 12B:**
- Google's instruction-tuned model should handle decomposition well
- Strength: Better at following structured output formats
- Weakness: May produce overly verbose decompositions
- Test verdict: **Pending evaluation**

### 2.3 Workflow Planning

**Current (qwen3:8b):**
- Agent council (9 agents) + action planner layer
- qwen3:8b provides reasoning for step sequencing
- Score: 92%+ workflow success rate

**Gemma 4 12B:**
- Gemma 3 series has improved planning capabilities
- 12B parameter size vs 8B may provide better step ordering
- Test verdict: **Pending evaluation**

### 2.4 QB Finance Questions

**Current (qwen3:8b):**
- Finance queries short-circuit before LLM pipeline (rule-based)
- qwen3:8b used only for natural language wrapping of QB data
- Score: 98%+ accuracy (data comes from QB, not LLM)
- Hallucination risk: ~3% (LLM may add context)

**Gemma 4 12B:**
- CRITICAL TEST: Gemma must NOT hallucinate finance numbers
- Google models historically more conservative on numbers
- May be safer than qwen3:8b for finance domain
- Test verdict: **Pending evaluation** — this is a key differentiator

### 2.5 Dashboard Audit Requests

**Current (qwen3:8b):**
- Dashboard data loaded via connector registry
- qwen3:8b summarizes and presents data naturally
- Score: 94%+ accuracy

**Gemma 4 12B:**
- Comparable summarization quality expected
- May have slightly better structured output formatting
- Test verdict: **Pending evaluation**

### 2.6 WhatsApp Command Understanding

**Current (qwen3:8b):**
- Natural intent router handles 43 intent types
- qwen3:8b provides conversational response
- Score: 96%+ understanding accuracy

**Gemma 4 12B:**
- Gemma 3 has strong multilingual capabilities
- Vietnamese fine-tuning may be comparable to qwen3
- May handle informal WhatsApp language better
- Test verdict: **Pending evaluation**

### 2.7 Approval Reasoning

**Current (qwen3:8b):**
- Rules-based approval gate (4 levels)
- qwen3:8b used for contextual reasoning when rules are ambiguous
- Score: 90%+ accuracy

**Gemma 4 12B:**
- Gemma 4 12B may have improved safety alignment
- Critical: Must NEVER bypass approval for dangerous actions
- Google's safety training may be an advantage here
- Test verdict: **Pending evaluation** — security-critical

### 2.8 Memory Recall Context

**Current (qwen3:8b):**
- ContextResolver assembles execution context before LLM call
- Memory recall tested across PM2 restarts (DEV4/DEV5 verified)
- Score: 88%+ recall