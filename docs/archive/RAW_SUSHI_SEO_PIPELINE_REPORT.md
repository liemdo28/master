# RAW SUSHI SEO PUBLISH PIPELINE REPORT

## Phase E5 — CERTIFIED

### Module
`server/src/execution/seo-pipeline.ts`

### Pipeline Flow

```
CEO: "Mi ơi, t muốn post 1 bài trên Raw website, thu hút SEO"
  │
  ├─ 1. Resolve entity: Raw Sushi / rawsushibar.com
  ├─ 2. Pick SEO topic automatically (lowest competition, highest volume)
  ├─ 3. Generate SEO article draft (400+ words)
  ├─ 4. Generate meta title / meta description / slug
  ├─ 5. Generate internal links (/menu, /omakase, /reservations, /about)
  ├─ 6. Create preview file (.local-agent-global/seo-drafts/)
  ├─ 7. Request CEO approval ← STOPS HERE
  │
  └─ 8. On approval: commit to CMS / sync to GitHub (not built yet)
```

### Auto-Selected Topic (for Raw Sushi)

Selected from 5 pre-built topics based on competition/volume scoring:
- Topic: "Why Fresh Sashimi Matters: A Guide to Quality Japanese Fish"
- Keywords: fresh sashimi, sashimi quality, raw fish freshness
- Competition: LOW
- Search volume: 2.4K monthly

### Generated Article Properties
- 400+ words
- SEO-optimized title, meta title, meta description
- Slug generation
- FAQ section (schema markup ready)
- 4 internal links to entity website
- Entity-specific content throughout

### Preview File
- Location: `.local-agent-global/seo-drafts/seo-preview-{workflow_id}.md`
- Contains: topic, keywords, metadata, full article, approval request

### Safety
- NO production publish without approval
- Preview file created for CEO review
- Steps tracked with evidence

### Gates
- [x] RAW_SUSHI_SEO_PIPELINE_CERTIFIED
