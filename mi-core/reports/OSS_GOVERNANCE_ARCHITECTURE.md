# OSS Governance Architecture

Date: 2026-06-26

## Position In Mi

```text
CEO
↓
Mi Executive Office
↓
Executive Coordination
↓
Open Source Governance
```

No OSS work bypasses Executive Coordination.

## Modules

- OSS Registry: `server/src/open-source-governance/oss-registry.ts`
- OSS Scorecard: `server/src/open-source-governance/oss-scorecard.ts`
- OSS Lifecycle Engine: `server/src/open-source-governance/oss-lifecycle-engine.ts`
- OSS Dashboard: `server/src/open-source-governance/oss-dashboard.ts`
- Runtime entrypoint: `server/src/open-source-governance/index.ts`

## Governance Rules

Every OSS candidate has:

- objective/task registration through Executive Coordination
- owner division
- status
- priority via Executive Coordination task registry
- approval/evidence surface
- dashboard visibility

Pilot and Production are blocked until required evidence exists.
