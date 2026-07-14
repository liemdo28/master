# SEO Task: Article Rewrite

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, article `{{article_id}}`, location `{{location_id}}`).

## Context

- **Target keyword:** {{target_keyword}}
- **Search intent:** {{intent}}
- **Audience:** {{audience}}
- **Target page (URL of the article being rewritten):** {{target_page}}
- **Related pages already on the site (for internal linking):** {{related_pages}}
- **Existing content to rewrite (current live version, or a competing piece to out-perform):** {{existing_competing_content}}

## Ground truth you MUST use

- **Approved facts about this business** — the rewrite may only state business facts that appear here. If the current article contains a fact NOT in this list, flag it in `removed_or_flagged_claims` rather than silently keeping or silently deleting it:
{{approved_facts}}

- **Forbidden claims** — strip out any statement in the current article that matches (or implies) any of these, even if it was present in the original:
{{forbidden_claims}}

## Task

Rewrite the article to better target the keyword above while preserving anything in the current version that already works. Specifically:
1. Identify what's outdated, thin, or off-target in the current version.
2. Improve structure, keyword targeting, and internal linking (link to the related pages listed above).
3. Preserve the brand voice unless it's actively hurting clarity.
4. Flag every factual claim in the current version that is NOT supported by the approved facts list — do not silently carry it forward.
5. Produce the full rewritten body, not a diff.

## Required output JSON schema

Return ONLY a JSON object (no prose outside the JSON) matching this shape:

```json
{
  "task_id": "{{task_id}}",
  "brand_id": "{{brand_id}}",
  "article_id": "{{article_id}}",
  "title": "string",
  "meta_title": "string",
  "meta_description": "string",
  "body_markdown": "string — full rewritten article body in Markdown",
  "headings": [ { "level": "h2|h3", "text": "string" } ],
  "internal_links": [ { "target_url": "string", "anchor_text": "string" } ],
  "changes_summary": ["string — bullet list of what changed and why"],
  "removed_or_flagged_claims": ["string — any claim removed for lacking an approved fact, or matching a forbidden claim"],
  "word_count": 0
}
```
