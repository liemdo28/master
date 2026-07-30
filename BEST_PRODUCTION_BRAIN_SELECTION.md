# BEST_PRODUCTION_BRAIN_SELECTION
> Mi-Core — Which Model Should Be CEO Brain?
> Date: 2026-06-16 | Status: SELECTION FRAMEWORK READY
> Decision based on REAL CEO WORKFLOWS — NOT chatbot benchmarks

---

## 1. The Question

Mi-Core needs a local LLM to serve as the CEO's brain. This model:
- Receives CEO messages via WhatsApp
- Decomposes multi-intent commands into work orders
- Makes approval decisions (security-critical)
- Handles finance queries without hallucinating numbers
- Responds to 1-character inputs ("k", "r", "ha?")
- Operates 24/7 on a Windows PC with 16GB RAM

**The wrong choice means:** leaked credentials, fabricated financials, dropped commands, angry CEO.

---

## 2. Candidates

| Model | Size | RAM | Speed | Vietnamese | Finance Safety | Status |
|-------|------|-----|-------|-----------|----------------|--------|
| **qwen3:8b** | 8B | 6.5 GB | Fast (~1.2s) | Native | 90% (2/20 fabricated) | CURRENT PRODUCTION |
| **gemma3:12b** | 12B | 8-10 GB | Medium (~1.8s) | Good (50+ langs) | TBD | UNDER EVALUATION |
| **qwen3:14b** | 14B | 10 GB | Slow (~2.5s) | Native | 99% (hypothesized) | Available |
| **deepseek-r1:14b** | 14B | 10 GB | Slow (~3.0s) | Good | 98% (hypothesized) | Available |
| **qwen3:1.7b** | 1.7B | 1.5 GB | Very fast (~0.5s) | Moderate | Low | Fast-path only |
| **llama3.2:3b** | 3B | 3.5 GB | Fast (~0.8s) | Weak | Low (85%) | Not recommended |

---

## 3. Selection Criteria — Weighted by CEO Impact

| Criterion | Weight | Why It Matters | Source |
|-----------|--------|----------------|--------|
| **Finance Truth (zero hallucination)** | 25% | Fabricated financials = CEO makes wrong decisions | FINANCE_TRUTH_CERTIFICATION |
| **Approval Security (injection resistance)** | 25% | Bypass = security breach, leaked credentials | APPROVAL_GATE_PROOF, FC-001 |
| **Multi-Intent Execution** | 15% | CEO sends compound commands — all must execute | DEV4_MULTI_INTENT_BASELINE |
| **Correction Handling** | 10% | CEO corrects Mi — must accept without arguing | Real WhatsApp logs |
| **Follow-Up Understanding** | 10% | CEO uses "ha?", "cái đó", "sao" | CONTEXT_FAILURE_REPORT |
| **Latency** | 10% | WhatsApp response must be <2s for CEO trust | CEO readiness score |
| **RAM/Resource Fit** | 5% | Must run on 16GB RAM PC with all services | System constraint |

---

## 4. Known Data Points (from existing production evidence)

### qwen3:8b (Current Production Baseline)

| Metric | Value | Source | Grade |
|--------|-------|--------|-------|
| Finance accuracy (with data) | 90% (18/20) | FINANCE_TRUTH_CERTIFICATION | B |
| Finance hallucination (no data) | 10% (2/20 fabricated) | FINANCE_TRUTH_CERTIFICATION | D |
| Injection resistance | 100% (100/100) | APPROVAL_GATE_PROOF | A |
| Credential leak | YES (deploy key exposed) | DEV4_FAILED_CASES FC-001 | F |
| Multi-intent execution | 25% (1/4 intents) | DEV4_MULTI_INTENT_BASELINE | F |
| Intent classification | 96%+ (rule-based) | CLAUDE.md | A |
| Dashboard audit quality | 94% | LOCAL_AGENT_BRAIN_BENCHMARK | A- |
| Memory recall | 88% | LOCAL_AGENT_BRAIN_BENCHMARK | B+ |
| Workflow selection | 94% | LOCAL_AGENT_BRAIN_BENCHMARK | A |
| Latency (simple query) | ~1,200ms | LOCAL_AGENT_BRAIN_BENCHMARK | A |
| RAM usage | 6.5 GB | LOCAL_AGENT_BRAIN_BENCHMARK | A |
| Vietnamese CEO slang | Good | HUMAN_ERROR_REPORT (some gaps) | B+ |
| Context preservation | Weak (3 competing stores) | CONTEXT_FAILURE_REPORT | D |

**qwen3:8b Overall Grade: B- (held back by credential leak, multi-intent failure, finance fabrication)**

### gemma3:12b (Candidate)

| Metric | Value | Source | Grade |
|--------|-------|--------|-------|
| All metrics | TBD | REAL_CEO_REASONING_BENCHMARK | TBD |

**Hypothesis grade based on model characteristics:**
- Finance hallucination: Likely BETTER (Google conservative training) → A- (predicted)
- Injection resistance: Likely EQUAL or BETTER (Google safety training) → A (predicted)
- Multi-intent: LIKELY BETTER (+4B params, better instruction following) → B+ (predicted)
- Vietnamese: LIKELY WORSE (not native-trained) → B- (predicted)
- Latency: LIKELY WORSE (+50% more params) → B (predicted)
- RAM: WORSE (8-10 GB vs 6.5 GB) → B- (predicted)

**gemma3:12b Hypothesis Grade: B+ to A- (IF finance and multi-intent improvements confirmed)**

### qwen3:14b (Candidate)

| Metric | Value | Source | Grade |
|--------|-------|--------|-------|
| All metrics | TBD (estimates in LOCAL_AGENT_BRAIN_BENCHMARK) | Benchmark estimates | TBD |

**Hypothesis:**
- Finance: 99% (larger = more conservative) → A
- Injection: 100% (same architecture as 8b) → A
- Multi-intent: BETTER than 8b but same architecture limits → B+
- Vietnamese: Native-level → A
- Latency: SLOW (~2.5s) → C+
- RAM: 10 GB (tight on 16GB system) → C

**qwen3:14b Hypothesis Grade: B+ (held back by RAM and latency)**

### deepseek-r1:14b (Candidate)

| Metric | Value | Source | Grade |
|--------|-------|--------|-------|
| All metrics | TBD (estimates in LOCAL_AGENT_BRAIN_BENCHMARK) | Benchmark estimates | TBD |

**Hypothesis:**
- Finance: 98% → A
- Injection: HIGH (reasoning model) → A
- Multi-intent: GOOD (reasoning-focused) → B+
- Vietnamese: Good but not native → B+
- Latency: SLOWEST (~3.0s) → D
- RAM: 10 GB → C
- Reasoning chain: Best of all candidates → A (for complex tasks only)

**deepseek-r1:14b Hypothesis Grade: B (excellent reasoning but too slow/heavy for daily use)**

---

## 5. Architecture Recommendation — Multi-Tier Brain

The data shows NO SINGLE MODEL is optimal for all CEO scenarios. The correct answer is a **multi-tier routing architecture:**

### Tier 1: Fast Path (inputs <= 3 chars, simple commands)
**Model: qwen3:1.7b**
- Triggers: "k", "r", "ok", "ha?", single-word commands
- Latency: ~500ms
- RAM: 1.5 GB
- Why: CEO sends these 30+ times/day. Must be INSTANT.

### Tier 2: Primary Brain (default reasoning)
**Model: TBD after benchmark**
- Candidates: qwen3:8b (current) vs gemma3:12b vs qwen3:14b
- Latency target: <2,000ms
- RAM budget: <=8 GB
- Handles: All general CEO conversations, corrections, follow-ups

### Tier 3: Heavy Reasoning (complex multi-intent, planning)
**Model: qwen3:14b or deepseek-r1:14b**
- Triggers: 3+ intent compound messages, approval edge cases
- Latency budget: <5,000ms (acceptable for complex tasks)
- RAM budget: 10 GB (acceptable as infrequent use)
- Handles: Multi-workflow orchestration, council decisions

### Tier 4: Code Generation
**Model: qwen2.5-coder:7b** (unchanged)

### Routing Logic
```
CEO Message
    ↓
GStack Intent Router (rule-based)
    ↓
Character count check
    ├── <= 3 chars → Tier 1 (qwen3:1.7b, fast)
    ├── Simple query → Tier 2 (primary brain)
    ├── 3+ intents detected → Tier 3 (heavy reasoning)
    └── Code request → Tier 4 (coder)
    ↓
ContextResolver assembles memory/context
    ↓
LLM inference
    ↓
Response truncation (WhatsApp: max 280 chars)
    ↓
Send to CEO
```

---

## 6. Primary Brain Selection Decision Matrix

For the critical Tier 2 (Primary Brain) position, here is the decision framework:

### If Gemma 4 12B passes these gates, it REPLACES qwen3:8b:

| Gate | Threshold | Weight | qwen3:8b Status | Gemma Target |
|------|-----------|--------|-----------------|-------------|
| Finance hallucination (no data) | 0% | CRITICAL | 10% (FAIL) | Must be 0% |
| Injection resistance | 100% | CRITICAL | 100% (PASS) | Must be 100% |
| CEO correction handling | 90% | HIGH | TBD | Must be 90%+ |
| Multi-intent decomposition | 50%+ | HIGH | 25% (FAIL) | Must be 50%+ |
| Vietnamese CEO slang | 80%+ | HIGH | ~90% (PASS) | Must be 80%+ |
| Latency (simple query) | <2,000ms | MEDIUM | ~1,200ms (PASS) | Must be <2,000ms |
| RAM usage | <10 GB | MEDIUM | 6.5 GB (PASS) | Must be <10 GB |

**Decision: Gemma wins Tier 2 IF it eliminates finance hallucination AND improves multi-intent, without regressing Vietnamese accuracy or latency beyond acceptable limits.**

### If Gemma FAILS, the fallback is qwen3:14b:

| Gate | Threshold | qwen3:14b Est. |
|------|-----------|---------------|
| Finance hallucination | 0% | ~1% (likely pass) |
| Injection resistance | 100% | ~100% (likely pass) |
| Multi-intent | 50%+ | ~55% (likely pass) |
| Vietnamese | 80%+ | ~97% (pass) |
| Latency | <2,000ms | ~2,500ms (marginal) |
| RAM | <10 GB | 10 GB (barely fits) |

**Trade-off: qwen3:14b is better on paper but RAM-constrained and slower. Acceptable if Gemma fails.**

---

## 7. Production Deployment Checklist

### Before ANY model change:

- [ ] Run REAL_CEO_REASONING_BENCHMARK.md against ALL candidates
- [ ] Fill in TBD cells in GEMMA4_REAL_WORLD_RESULTS.md
- [ ] Confirm injection resistance = 100% for new model
- [ ] Confirm finance hallucination = 0% for new model
- [ ] Test 20+ CEO slang phrases from HUMAN_ERROR_REPORT
- [ ] Monitor RAM during 1-hour burn-in test
- [ ] Verify WhatsApp response time <2s for 10 consecutive queries
- [ ] Test partial workflow failure (QB fails, others continue)
- [ ] Test CEO correction sequence (3+ corrections in a row)
- [ ] Test "Ha?" minimal input after each major response

### After model change:

- [ ] Monitor finance truth for 7 days (zero tolerance)
- [ ] Monitor injection attempts for 7 days
- [ ] Monitor CEO satisfaction (response time, accuracy)
- [ ] Keep qwen3:8b as emergency fallback
- [ ] Log all model errors for regression tracking

---

## 8. FINAL RECOMMENDATION

### Current State (2026-06-16)

**Keep qwen3:8b as production primary** while running the real CEO benchmark.

**Why not switch yet:**
1. No live benchmark data for gemma3:12b against CEO scenarios
2. The TBD cells in GEMMA4_REAL_WORLD_RESULTS.md must be populated first
3. Switching without evidence = gambling with CEO trust

**What to do NOW:**
1. Pull all candidate models: `ollama pull gemma3:12b qwen3:14b deepseek-r1:14b`
2. Run the 6 mandatory CEO killer phrases against each
3. Run the 8 injection tests against each
4. Run the finance truth test (with real QB data) against each
5. Score results in GEMMA4_REAL_WORLD_RESULTS.md
6. Make the decision based on DATA, not benchmarks

### Expected Outcome

Based on model characteristics and Mi-Core's requirements:

| Position | Most Likely Winner | Confidence |
|----------|-------------------|-----------|
| Tier 1 (Fast) | qwen3:1.7b | 95% |
| Tier 2 (Primary) | gemma3:12b OR qwen3:8b | 60/40 |
| Tier 3 (Heavy) | qwen3:14b | 70% |
| Tier 4 (Code) | qwen2.5-coder:7b | 95% |

### The 60/40 bet on Gemma

**60% chance Gemma wins** because:
- Finance hallucination reduction is the #1 priority (25% weight)
- Google's conservative training likely eliminates fabrication
- +4B parameters likely improve multi-intent decomposition
- Better instruction following = better structured output

**40% chance Gemma loses** because:
- Vietnamese CEO slang is make-or-break ("ha?", "k", "r", "Mi oi")
- Verbosity on WhatsApp = bad UX
- RAM pressure may cause system instability

**The only way to know: RUN THE BENCHMARK.**

---

## 9. Next Actions

| # | Action | Owner | Deadline | Status |
|---|--------|-------|----------|--------|
| 1 | Pull gemma3:12b, qwen3:14b, deepseek-r1:14b | DevOps | Today | PENDING |
| 2 | Run 6 CEO killer phrases per model | Dev Team | Today | PENDING |
| 3 | Run 8 injection tests per model | Security | Today | PENDING |
| 4 | Run finance truth test (real QB data) | Finance | Today | PENDING |
| 5 | Score all results in GEMMA4_REAL_WORLD_RESULTS.md | Dev Team | Today | PENDING |
| 6 | Make Tier 2 selection decision | CEO/Dev Lead | Today | PENDING |
| 7 | Update brain router config | Dev Team | After selection | PENDING |
| 8 | 7-day burn-in monitoring | DevOps | After deployment | PENDING |

---

*Created: 2026-06-16 | Status: FRAMEWORK COMPLETE — awaiting benchmark execution*
*Verdict: BEST_MODEL_SELECTED_BY_REAL_WORKFLOWS (pending live test data)*
