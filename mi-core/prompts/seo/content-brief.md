# SEO Task: Content Brief

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, location `{{location_id}}`).

## Context

- **Target keyword:** {{target_keyword}}
- **Search intent:** {{intent}}
- **Audience:** {{audience}}
- **Target page:** {{target_page}}
- **Related pages already on the site (for internal linking):** {{related_pages}}
- **Existing competing content to differentiate from:** {{existing_competing_content}}

## Ground truth you MUST use

- **Approved facts about this business** (the brief may only reference facts from this list — flag anywhere additional verified facts would strengthen the piece, but do not invent them):
{{approved_facts}}

- **Forbidden claims** (the resulting article must never be able to make any of these claims):
{{forbidden_claims}}

## Task

Produce a content brief for a writer (human or AI) to turn into a full article targeting the keyword above. The brief should specify structure, not finished prose. Include:
1. Recommended title options (3).
2. Recommended H2/H3 outline with a one-line note on what each section should cover.
3. Which approved facts should be woven into which section.
4. Internal linking plan — which related pages to link to, with what anchor text, and from which section.
5. Suggested FAQ questions (searcher-intent driven).
6. Suggested CTA placement and type (booking, call, directions, menu, etc. — do not invent a CTA type not appropriate to a local business).
7. Meta title and meta description draft (respecting standard length limits).
8. A one-line note on what would make this article better than the existing competing content listed above.

## Required output JSON schema

Return ONLY a JSON object (no prose outside the JSON) matching this shape:

```json
{
  "task_id": "{{task_id}}",
  "brand_id": "{{brand_id}}",
  "location_id": "{{location_id}}",
  "target_keyword": "{{target_keyword}}",
  "title_options": ["string", "string", "string"],
  "outline": [
    { "heading_level": "h2|h3", "heading": "string", "covers": "string", "facts_used": ["string"] }
  ],
  "internal_links": [
    { "target_url": "string", "anchor_text": "string", "from_section": "string" }
  ],
  "faq": [ { "question": "string", "answer_guidance": "string" } ],
  "cta": { "type": "string", "placement": "string" },
  "meta_title": "string",
  "meta_description": "string",
  "differentiation_notes": "string"
}
```
