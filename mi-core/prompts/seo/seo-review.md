# SEO Task: SEO Review

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, article `{{article_id}}`, location `{{location_id}}`).

## Context

- **Content under review:** {{existing_competing_content}}
- **Target keyword:** {{target_keyword}}
- **Search intent:** {{intent}}
- **Target page:** {{target_page}}
- **Related pages available for internal linking:** {{related_pages}}

## Ground truth you MUST use

- **Approved facts about this business** (used only to sanity-check factual claims in the piece — deep fact-checking is a separate task, this is an SEO-quality pass):
{{approved_facts}}

- **Forbidden claims** — flag immediately if present, regardless of SEO merit:
{{forbidden_claims}}

## Task

Review the content strictly from an on-page SEO and content-quality standpoint (not a full fact-check). Assess:
1. Keyword targeting — is the target keyword and its variants present in title, H1, first 100 words, and naturally throughout? Any keyword stuffing?
2. Structure — logical heading hierarchy, scannability, paragraph length.
3. Search intent match — does the content actually satisfy `{{intent}}` intent for `{{target_keyword}}`, or does it drift?
4. Internal linking — are there missed opportunities to link to the related pages listed above?
5. Meta title/description — present, right length, compelling?
6. E-E-A-T signals — does the content demonstrate experience/expertise/authority/trust appropriate for this business type, using only approved facts?
7. Any forbidden claims present (flag as critical).
8. Overall a numeric quality score (0–100) with justification.

## Required output JSON schema

Return ONLY a JSON object (no prose outside the JSON) matching this shape:

```json
{
  "task_id": "{{task_id}}",
  "brand_id": "{{brand_id}}",
  "article_id": "{{article_id}}",
  "quality_score": 0,
  "keyword_targeting": { "score": 0, "notes": "string" },
  "structure": { "score": 0, "notes": "string" },
  "intent_match": { "score": 0, "notes": "string" },
  "internal_linking": { "score": 0, "missed_opportunities": [ { "target_url": "string", "suggested_anchor": "string" } ] },
  "meta_tags": { "score": 0, "notes": "string" },
  "eeat_signals": { "score": 0, "notes": "string" },
  "forbidden_claims_found": ["string"],
  "critical_issues": ["string"],
  "recommendations": ["string"]
}
```
