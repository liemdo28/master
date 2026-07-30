# 🔴 EXECUTIVE DECISION REPORT — Track R5

**Date:** 2026-06-15
**Target:** Mi-Core (mi-core)
**Red Team Status:** MEDIUM — PARTIAL CAPABILITY WITH CRITICAL GAPS

---

## Executive Summary

Mi-Core's executive decision capability is **rule-based for structured data** and **LLM-powered for unstructured queries**. It can answer factual questions about stores, revenue, and issues from PostgreSQL data. However, it cannot synthesize across domains, provide prioritized recommendations, or answer subjective CEO questions like "Có gì đáng lo?" (What should I worry about?) with actionable intelligence.

---

## TEST RESULTS

### Test 1: "Có gì đáng lo?" (What should I worry about?)

**Architecture analysis:**
- The `ceo-query-service.ts` has 7 hardcoded SQL query patterns
- None of them answer "what should I worry about?" directly
- The query would fall through to the hybrid search fallback
- Search returns raw data snippets, not prioritized risk assessment
- The response is formatted by the LLM, but the data is just raw SQL results

**Verdict:** Mi can list store issues from the database but cannot prioritize them by business impact, urgency, or CEO concern level. A CEO asking "what should I worry about?" gets a data dump, not a focused executive briefing.

---

### Test 2: "Có gì cần duyệt?" (What needs my approval?)

**Architecture analysis:**
- `GET /api/approval/pending` returns the in-memory approval queue
- But the queue is in-memory only (lost on restart)
- Only covers Gmail/Drive/File actions, not business decisions
- No integration with Asana tasks, QuickBooks approvals, or business workflows

**Verdict:** Mi can show pending technical approvals (email drafts, file uploads) but not business approvals (vendor payments, hire decisions, partnership requests).

---

### Test 3: "Có gì quá hạn?" (What's overdue?)

**Architecture analysis:**
- No overdue-task detection system exists
- QB data has invoice dates but no "overdue" status logic
- Asana connector can fetch tasks but no overdue filter
- No cross-system overdue aggregation

**Verdict:** Mi cannot reliably answer "what's overdue" because it doesn't track deadlines across systems.

---

### Test 4: "Có ai làm kém không?" (Is anyone underperforming?)

**Architecture analysis:**
- No employee performance tracking exists
- No task completion metrics
- No time-tracking data
- No KPI dashboard integration

**Verdict:** Mi has zero capability to assess employee performance. This question would produce a hallucinated or deflection response.

---

### Test 5: "Doanh thu sao rồi?" (How's revenue?)

**Architecture analysis:**
- `ceo-query-service.ts` has revenue-related SQL queries
- Can query `normalized_events` for revenue data
- Tier 1 (rule-based) can return structured revenue data

**Verdict:** This is Mi's strongest executive query. It can pull revenue data from PostgreSQL. However:
- Only 30-day rolling window
- No trend analysis (month-over-month, year-over-year)
- No forecast or projection
- No comparison to targets/budgets

---

## ANSWER QUALITY ASSESSMENT

| CEO Question | Data Available? | Prioritized? | Actionable? | Score |
|-------------|----------------|-------------|-------------|-------|
| "Có gì đáng lo?" | ⚠️ Partial (DB issues only) | ❌ No | ❌ No | 3/10 |
| "Có gì cần duyệt?" | ⚠️ Partial (tech approvals only) | ❌ No | ⚠️ Maybe | 4/10 |
| "Có gì quá hạn?" | ❌ No | N/A | N/A | 1/10 |
| "Có ai làm kém?" | ❌ No | N/A | N/A | 0/10 |
| "Doanh thu sao rồi?" | ✅ Yes (30-day) | ❌ No trend | ⚠️ Raw data only | 5/10 |

---

## RECOMMENDATION QUALITY

Mi-Core currently has **zero recommendation capability**. The executive pipeline:

1. Classifies intent
2. Gathers data from relevant connectors
3. Sends to LLM with system prompt
4. Returns LLM response

The LLM generates natural language but has no:
- Risk scoring framework
- Business priority matrix
- Historical comparison data
- Action recommendation engine
- Decision confidence scoring

**A CEO expects:** "Stone Oak's revenue dropped 15% this month — here are 3 things to do: (1) check staffing, (2) review marketing spend, (3) schedule owner meeting."

**Mi gives:** "Revenue for Stone Oak was $45,231 this month." (raw data dump)

---

## PRIORITIZATION GAPS

The executive context builder (`intelligence/executive-context.ts`) assembles:
- Owner profile
- Business memory
- Recent decisions
- Live data parts

But it has **no prioritization layer**:
- No urgency scoring
- No impact assessment
- No time-decay weighting
- No cross-entity dependency awareness
- No "executive attention" algorithm

---

## VERDICT

**Executive Decision Score: 3/10**

Mi-Core can answer factual data queries about revenue and store issues. It cannot:
- Synthesize across multiple data sources
- Prioritize issues by business impact
- Provide actionable recommendations
- Track overdue items across systems
- Assess employee performance
- Give trend analysis or forecasts

**A CEO using Mi would quickly learn to ask very specific, narrow questions** ("What was Raw Sushi revenue last week?") rather than executive-level questions ("What should I focus on today?"). This defeats the purpose of a "CEO OS."
