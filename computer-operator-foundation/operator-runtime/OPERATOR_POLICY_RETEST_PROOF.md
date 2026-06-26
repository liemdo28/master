# OPERATOR_POLICY_RETEST_PROOF

## Status
**PASSED** — Policy guard blocks all 17 required unsafe targets and allows all 4 safe targets.

## Summary
```json
{
  "total": 21,
  "blocked_tested": 17,
  "blocked_passed": 17,
  "safe_tested": 4,
  "safe_passed": 4,
  "all_passed": true
}
```

## Blocked Targets (17/17 PASSED)

| Target | Policy Status |
|---|---|
| doordash.com | BLOCKED_BY_POLICY ✅ |
| merchant.doordash.com | BLOCKED_BY_POLICY ✅ |
| toasttab.com | BLOCKED_BY_POLICY ✅ |
| pos.toasttab.com | BLOCKED_BY_POLICY ✅ |
| qbo.intuit.com | BLOCKED_BY_POLICY ✅ |
| quickbooks.intuit.com | BLOCKED_BY_POLICY ✅ |
| business.google.com | BLOCKED_BY_POLICY ✅ |
| google.com/business | BLOCKED_BY_POLICY ✅ |
| dreamhost.com | BLOCKED_BY_POLICY ✅ |
| panel.dreamhost.com | BLOCKED_BY_POLICY ✅ |
| dash.cloudflare.com | BLOCKED_BY_POLICY ✅ |
| cloudflare.com | BLOCKED_BY_POLICY ✅ |
| mybank.com | BLOCKED_BY_POLICY ✅ |
| chase.com | BLOCKED_BY_POLICY ✅ |
| payroll.example.com | BLOCKED_BY_POLICY ✅ |
| adp.com | BLOCKED_BY_POLICY ✅ |
| paychex.com | BLOCKED_BY_POLICY ✅ |

## Safe Targets (4/4 PASSED)

| Target | Policy Status |
|---|---|
| https://example.com | APPROVED ✅ |
| file:///d:/Project/.../test-form.html | APPROVED ✅ |
| http://localhost:8765/api/operator/health | APPROVED ✅ |
| http://127.0.0.1:8080/test | APPROVED ✅ |

## Demo Runner Policy Enforcement

The `DemoRun` helper refuses to start any browser session against a blocked target. Verified attempts (8/8 blocked):

```json
{
  "blocked_count": 8,
  "total": 8
}
```

Each blocked attempt raised `RuntimeError: POLICY BLOCK: target '<x>' is not allowed. status=BLOCKED_BY_POLICY`.

## Policy Guard Components
- **File:** `policy_guard.py`
- **Blocked keywords:** doordash, toast, quickbooks, gbp, dreamhost, cloudflare, banking, payroll, chase, wellsfargo, boa, citi, intuit.com, turbotax, mint.com, business.google.com
- **Blocked regex patterns:** `door\s*dash`, `toast\s*(tab|pos|crm)`, `quick\s*books`, `google\s*business\s*profile`, `dream\s*host`, `cloud\s*flare`, `.*bank(ing)?.*`, `pay\s*roll`, `paychex`, `adp\.com`, `google\.com/business`, `business\.google\.com`

## Conclusion
All 17 required blocked targets are rejected with `status: BLOCKED_BY_POLICY` and `ok: false`. All 4 safe targets are accepted. Demo runner refuses blocked targets before launching a browser. Phase H complete.