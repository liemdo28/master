# SEO Task: Article Refresh

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, article `{{article_id}}`, location `{{location_id}}`).

## Context

- **Target keyword:** {{target_keyword}}
- **Search intent:** {{intent}}
- **Audience:** {{audience}}
- **Target page (URL of the article being refreshed):** {{target_page}}
- **Related pages already on the site (for internal linking):** {{related_pages}}
- **Current live content being refreshed:** {{existing_competing_content}}

## Ground truth you MUST use

- **Approved facts about this business** — use this list to update anything in the current article that is stale (old hours, old pricing, old menu items, old certifications, etc.). Do not introduce any fact not on this list:
{{approved_facts}}

- **Forbidden claims** — never introduce or leave in place anything matching these, even if it was previously live:
{{forbidden_claims}}

## Task

This is a **lighter-touch pass than a full rewrite** — the article's structure and majority of content should stay intact. Refresh it by:
1. Updating any fact in the article that conflicts with the current approved facts list (dates, prices, hours, offerings, staff, etc.).
2. Adding any newly-relevant approved facts that weren't in the article before, where they fit naturally.
3. Tightening 1–2 sections if they've become thin relative to what now ranks for this keyword, without rewriting the whole piece.
4. Adding/fixing internal links to the related pages listed above if any are missing or now broken.
5. Re-checking the meta title/description are still accurate and click-worthy.
6. NOT touching sections that are still accurate and working — list them as "unchanged" rather than rewriting for the sake of it.

## Required output JSON schema

Return ONLY a JSON object (no prose outside the JSON) matching this shape:

```json
{
  "task_id": "{{task_id}}",
  "brand_id": "{{brand_id}}",
  "article_id": "{{article_id}}",
  "meta_title": "string",
  "meta_description": "string",
  "sections_updated": [
    { "heading": "string", "old_text_summary": "string", "new_text": "string", "reason": "string" }
  ],
  "sections_unchanged": ["string — heading of sections left as-is"],
  "facts_updated": ["string — what stale fact was corrected, old value -> new value"],
  "internal_links_added_or_fixed": [ { "target_url": "string", "anchor_text": "string" } ],
  "full_body_markdown": "string — complete article body after applying the refresh"
}
```
