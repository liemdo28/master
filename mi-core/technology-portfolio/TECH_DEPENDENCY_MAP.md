# Technology Dependency Map

Status: PARTIAL

| asset | depends_on | used_by | risk |
|---|---|---|---|
| GitHub | repo permissions, branch policy | all phases | source-of-truth |
| Executive Coordination | task registry, evidence | all workflows/operators | control-plane |
| Open Source Governance | OSS registry/scorecard | Technology Portfolio, Workflow Fabric | governance |
| n8n | Mi workflow contract | Workflow Automation Fabric | automation |
| QuickBooks | finance credentials/API | finance warehouse/intelligence | financial |
| Google Search Console | OAuth tokens | SEO agents, marketing intelligence | marketing |
| Google Analytics 4 | OAuth tokens/properties | SEO agents, marketing intelligence | marketing |
| Google Business Profile | Google API quota | SEO local visibility | quota-limited |
| Operator Runtime | approval gates, evidence capture | Phase 2B/2C operators | high-risk |

Dependency gaps:
- Phase 3A financial warehouse path is missing.
- Workflow Fabric API routes remain partial.
