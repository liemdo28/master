# SEO Task: Google Business Profile Post

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, location `{{location_id}}`).

## Context

- **Topic / keyword to feature:** {{target_keyword}}
- **Intent:** {{intent}}
- **Audience:** {{audience}}
- **Target landing page for the post's link:** {{target_page}}
- **Related pages (alternate link candidates):** {{related_pages}}
- **Recent competing GBP posts / content in this space:** {{existing_competing_content}}

## Ground truth you MUST use

- **Approved facts about this business/location** — the post may only reference facts from this list (offers, hours, events, menu items, promotions, etc.):
{{approved_facts}}

- **Forbidden claims** — never state or imply any of these:
{{forbidden_claims}}

## Task

Write a Google Business Profile post (What's New / Offer / Event style — pick the most appropriate type for the topic) for location `{{location_id}}`. Google Business Profile posts have strict constraints:
1. Body text should be concise (roughly 1,200 characters max, ideally 150–300 for readability) — punchy, not a full article.
2. Include a clear call-to-action button type appropriate to the content (Book, Order online, Learn more, Call now, Sign up) — choose the one that matches the approved facts and target page.
3. Suggest one image concept (description only — no image generation) that would fit the post, using only real, approved details about the business.
4. Provide the destination link (should be the target page above, or a related page if more appropriate — explain why if you deviate).
5. Note the recommended post type and, if it's an Offer/Event, what fields (start/end date, terms) it would need — only fill these in if supported by approved facts; otherwise mark them "NEEDS_INPUT".

## Required output JSON schema

Return ONLY a JSON object (no prose outside the JSON) matching this shape:

```json
{
  "task_id": "{{task_id}}",
  "brand_id": "{{brand_id}}",
  "location_id": "{{location_id}}",
  "post_type": "WHATS_NEW|OFFER|EVENT",
  "body_text": "string",
  "character_count": 0,
  "cta": { "button_type": "BOOK|ORDER_ONLINE|LEARN_MORE|CALL_NOW|SIGN_UP", "destination_url": "string" },
  "image_concept": "string",
  "offer_or_event_fields": { "start_date": "string or NEEDS_INPUT", "end_date": "string or NEEDS_INPUT", "terms": "string or NEEDS_INPUT" },
  "facts_used": ["string"]
}
```
