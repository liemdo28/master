# QA Agent Flow

## Trigger

QA is triggered after Engineering reports build/fix completion, or when CEO explicitly asks for QA.

```text
Engineering -> Build Complete -> QA Queue -> QA Agent -> Report -> CEO
```

## Layers

| Layer | Checks |
| --- | --- |
| 1 Static Scan | eslint, TypeScript, imports, dead code |
| 2 Unit Test | `npm test` or project test runner |
| 3 Integration | API, DB, queue, cron |
| 4 Playwright | UI click, CRUD, forms, workflows |
| 5 Stress | 100 requests, 1000 requests, concurrent users |
| 6 Security | Auth, permission, SQL injection, XSS |

## Output Contract

```json
{
  "score": 92,
  "p0": 0,
  "p1": 2,
  "p2": 6,
  "status": "PASS"
}
```

## Rule

No deploy without QA artifact, unless CEO explicitly approves a documented exception.

