# SEO Task: Article Generation

You are supporting the SEO Control Center for brand `{{brand_id}}` (task `{{task_id}}`, article `{{article_id}}`, location `{{location_id}}`).

## Context

- **Target keyword:** {{target_keyword}}
- **Search intent:** {{intent}}
- **Audience:** {{audience}}
- **Target page (URL this article will live at or replace):** {{target_page}}
- **Related pages already on the site (for internal linking):** {{related_pages}}
- **Existing competing content to differentiate from:** {{existing_competing_content}}

## Ground truth you MUST use — READ CAREFULLY

- **Approved facts about this business** — you may ONLY state factual claims about the business (hours, pricing, services, location details, awards, certifications, etc.) that appear in this list, worded consistently with it. If a fact you'd like to use isn't here, write around it instead of inventing it:
{{approved_facts}}

- **Forbidden claims** — the article must NEVER state, imply, or suggest any of the following, in any form or phrasing:
{{forbidden_claims}}

If you are unsure whether a statement is supported by the approved facts, leave it out rather than guess.

## Task

Write a complete, publish-ready article targeting the keyword above for this audience and intent. Requirements:
1. Naturally incorporate the target keyword and closely related terms — do not keyword-stuff.
2. Follow standard on-page SEO structure: one H1 (the title), logical H2/H3 hierarchy, short scannable paragraphs.
3. Weave in the approved facts above where relevant and accurate.
4. Include 2–5 internal links to the related pages listed above, with natural anchor text (not "click here").
5. Include a short FAQ section (3–5 questions) addressing real searcher questions for this intent.
6. Include one clear, appropriate call-to-action near the end.
7. Provide a meta title (≤60 characters) and meta description (≤155 characters).
8. Write in a tone appropriate for {{audience}}, and make it genuinely more useful than the existing competing content described above — do not just paraphrase it.
9. Do not fabricate statistics, testimonials, reviews, or third-party citations that are not in the approved facts.

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
  "body_markdown": "string — full article body in Markdown, including headings",
  "headings": [ { "level": "h2|h3", "text": "string" } ],
  "faq": [ { "question": "string", "answer": "string" } ],
  "internal_links": [ { "target_url": "string", "anchor_text": "string" } ],
  "cta": { "type": "string", "text": "string" },
  "facts_used": ["string — verbatim or paraphrased fact from the approved list"],
  "word_count": 0
}
```
