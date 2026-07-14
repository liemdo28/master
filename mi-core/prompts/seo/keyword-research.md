# SEO Task: Keyword Research

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, location `{{location_id}}`).

## Context

- **Target keyword / seed topic:** {{target_keyword}}
- **Search intent:** {{intent}}
- **Audience:** {{audience}}
- **Target page (if one exists already):** {{target_page}}
- **Related pages already on the site:** {{related_pages}}
- **Existing competing content (ours or competitors'):** {{existing_competing_content}}

## Ground truth you MUST use

- **Approved facts about this business** (only use facts from this list when making claims about the business — never invent numbers, hours, prices, or claims not listed here):
{{approved_facts}}

- **Forbidden claims** (never state or imply any of the following, even indirectly):
{{forbidden_claims}}

## Task

Research keyword opportunities around the seed topic above for this brand/location. For each candidate keyword, assess:
1. Estimated search demand tier (high / medium / low) and reasoning.
2. Difficulty estimate (easy / medium / hard) relative to a local/regional business site.
3. Funnel stage (awareness / consideration / decision / retention).
4. Local relevance (0–1) — does it make sense for this specific location?
5. Business relevance (0–1) — does it match what this business actually offers, per the approved facts above?
6. Suggested target URL — an existing related page (from the list above) if one fits, or "NEW PAGE NEEDED" with a proposed slug.
7. Cannibalization risk against existing/related pages listed above.

Do not fabricate search volume numbers as if they came from a real tool — clearly mark all demand/difficulty estimates as qualitative judgments, not measured data.

## Required output JSON schema

Return ONLY a JSON object (no prose outside the JSON) matching this shape:

```json
{
  "task_id": "{{task_id}}",
  "brand_id": "{{brand_id}}",
  "location_id": "{{location_id}}",
  "seed_topic": "{{target_keyword}}",
  "keywords": [
    {
      "keyword": "string",
      "normalized_keyword": "string",
      "search_intent": "informational|navigational|transactional|commercial",
      "funnel_stage": "awareness|consideration|decision|retention",
      "estimated_demand": "high|medium|low",
      "difficulty_estimate": "easy|medium|hard",
      "local_relevance": 0.0,
      "business_relevance": 0.0,
      "suggested_target_url": "string or NEW PAGE NEEDED: /slug",
      "cannibalization_risk": "none|low|medium|high",
      "reasoning": "string"
    }
  ],
  "notes": "string — caveats, assumptions, or facts you were missing"
}
```
