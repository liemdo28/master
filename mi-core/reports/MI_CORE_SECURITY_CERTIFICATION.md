# Mi-Core Security Certification
**Date:** 2026-06-13  
**Status:** SECURITY_PASS ✅  
**Requirement:** Kiểm tra tính bảo mật của mi-core (Infrastructure Hardening Req #1)

---

## Audit Findings

### Pre-Fix Vulnerabilities
| Route | Exposure | Risk |
|-------|----------|------|
| `POST /api/jarvis/evolution/query` | Responded 200 without `x-api-key` | Direct Jarvis query access without auth |
| `GET /api/jarvis/evolution/status` | Responded 200 without `x-api-key` | Jarvis status exposed |
| `POST /api/knowledge/ingest` | Responded 200 without auth | Arbitrary doc ingestion |
| `POST /api/knowledge/rebuild` | Responded 200 without auth | Knowledge DB wipe+rebuild |
| `POST /api/knowledge/ingest-dir` | Responded 200 without auth | Arbitrary directory ingestion |
| `POST /api/knowledge/packs/install-all` | Responded 200 without auth | Pack installation |
| `POST /api/knowledge/packs/:id/install` | Responded 200 without auth | Pack installation |
| `DELETE /api/knowledge/packs/:id` | Responded 200 without auth | Pack deletion |

### Existing Protections (pre-fix)
- `ipGuard` middleware blocks all non-LAN (192.168.x.x / 10.x.x.x / 100.x.x.x) and non-Tailscale origins
- `rateLimiter` on all routes
- CORS restricted to LAN/Tailscale origins
- Helmet security headers enabled
- `POST /api/whatsapp/message` required `x-api-key` header

---

## Fixes Applied

### jarvis.ts — `requireApiKey` middleware
Added to: `POST /evolution/query`, `GET /evolution/status`

```typescript
const JARVIS_API_KEY = process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.body?.api_key || '';
  if (key !== JARVIS_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
```

### knowledge.ts — `requireApiKey` middleware
Added to all write/admin operations. Read-only routes (`/search`, `/stats`, `/catalog`, `/category/:cat`, `/packs` GET, `/us-compliance/*`) remain public (needed by internal dashboard).

---

## Post-Fix Security Audit Results

| Test | Expected | Result | Status |
|------|----------|--------|--------|
| `POST /evolution/query` — no key | 401 | 401 | ✅ PASS |
| `POST /evolution/query` — with key | 200 | 200 | ✅ PASS |
| `GET /evolution/status` — no key | 401 | 401 | ✅ PASS |
| `POST /knowledge/rebuild` — no key | 401 | 401 | ✅ PASS |
| `POST /knowledge/ingest` — with key | 200 | 200 | ✅ PASS |
| `GET /knowledge/stats` — no key (public) | 200 | 200 | ✅ PASS |

**Security Audit: 6/6 PASS**

---

## Regression Suite (post-fix)

```
10/10 PASS (100%)
Latency: avg 5ms  max 24ms
VERDICT: JARVIS_REGRESSION_PASS ✅
```

All 10 CEO mandatory cases unaffected — regression suite uses `x-api-key: mi-core-secret-2026` header.

---

## Remaining Risk (Accepted)

- `0.0.0.0` binding (`MOBILE_ACCESS=1`): intentional for iPhone/Mac LAN access. Mitigated by `ipGuard` + API key auth on sensitive routes.
- Key is stored in `.env` (`MI_CORE_API_KEY`). Default fallback `mi-core-secret-2026` should be rotated before external exposure.

---

## Verdict

**SECURITY_CERTIFIED ✅**  
Mi-Core executive query and knowledge admin routes now require authenticated access.  
All pre-existing functionality retained.  
Regression suite: 10/10 PASS.
