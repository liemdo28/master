# SEO System Runbook

## Start All Agents
```bash
node SEO/seo-local-maps-agent/index.js &
node SEO/seo-website-agent/index.js &
node SEO/seo-technical-agent/index.js &
node SEO/seo-schema-agent/index.js &
node SEO/seo-content-agent/index.js &
node SEO/seo-citation-agent/index.js &
node SEO/seo-analytics-agent/index.js &
```

## Run Tests
```bash
for %A in (seo-local-maps-agent seo-website-agent seo-technical-agent seo-schema-agent seo-content-agent seo-citation-agent seo-analytics-agent) do @node SEO/%A/test.js
```

## Run Full Validation
```bash
node SEO/shared/base/validate-system.js
```

## Trigger Audit (single agent)
```bash
curl -X POST http://localhost:4001/run/audit
```

## Check Health
```bash
curl http://localhost:4001/health
```

## View Latest Report
```bash
curl http://localhost:4007/reports/latest
```

## Logs
All under `SEO/shared/logs/*.log` (JSONL format)

## Reports
All under `SEO/shared/reports/<agent-id>/*.json`
