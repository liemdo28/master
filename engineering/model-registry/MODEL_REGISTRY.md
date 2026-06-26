# Engineering Model Registry

Status: MODEL_REGISTRY_OPERATIONAL

Source of truth:

- `server/src/engineering-division/model-registry.ts`

Tracked fields:

- provider
- model
- strengths
- weaknesses
- languages
- frameworks
- cost
- latency
- quality score
- availability

Registered providers:

Live execution metadata:

- Last engineering live execution proof: Phase 1B
- Low-risk task class: non-production documentation metadata update
- Default Engineering Division route for TypeScript/NodeJS documentation maintenance: Qwen / qwen-coder

| Provider | Primary Use |
| --- | --- |
| Qwen | TypeScript, NodeJS, APIs, refactoring |
| DeepSeek | Python, SQL, analytics |
| Claude | Architecture, Laravel, large refactors |
| GPT | Full stack, general purpose |
| Kimi | Research, repo analysis |
| Human | production judgment, credentials, manual releases |
