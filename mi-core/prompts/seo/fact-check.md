# SEO Task: Fact Check

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, article `{{article_id}}`, location `{{location_id}}`).

## Context

- **Content being checked:** {{existing_competing_content}}
- **Target page:** {{target_page}}
- **Audience:** {{audience}}

## Ground truth you MUST use

- **Approved facts about this business** — this is the ONLY source of truth for factual claims about the business. Anything in the content under review that isn't traceable to this list is UNVERIFIED, not automatically wrong, but must be flagged:
{{approved_facts}}

- **Forbidden claims** — anything in the content matching or implying one of these is a hard FAIL, regardless of whether it seems true:
{{forbidden_claims}}

## Task

Fact-check the content above sentence by sentence for any claim about the business (not general/generic statements). For each factual claim found:
1. Quote the claim.
2. Classify it: `VERIFIED` (matches an approved fact), `UNVERIFIED` (no matching approved fact — not necessarily false, just unconfirmed), or `FORBIDDEN` (matches a forbidden claim).
3. If `VERIFIED`, cite which approved fact supports it.
4. If `UNVERIFIED` or `FORBIDDEN`, suggest a specific fix (rewrite or removal).

Be conservative: if a claim is vague enough that it doesn't actually assert something checkable (e.g. "we're passionate about quality"), mark it `NOT_A_FACTUAL_CLAIM` and skip it.

## Required output JSON schema

Return ONLY a JSON object (no prose outside the JSON) matching this shape:

```json
{
  "task_id": "{{task_id}}",
  "brand_id": "{{brand_id}}",
  "article_id": "{{article_id}}",
  "claims": [
    {
      "claim_text": "string",
      "classification": "VERIFIED|UNVERIFIED|FORBIDDEN|NOT_A_FACTUAL_CLAIM",
      "supporting_fact": "string or null",
      "suggested_fix": "string or null"
    }
  ],
  "overall_result": "PASS|FAIL|PASS_WITH_WARNINGS",
  "forbidden_claim_count": 0,
  "unverified_claim_count": 0,
  "summary": "string"
}
```
