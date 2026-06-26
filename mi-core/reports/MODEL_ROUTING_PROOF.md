# Model Routing Proof

Command:

```powershell
.\node_modules\.bin\tsc.cmd -p server\tsconfig.phase1.json
node tests\phase1-engineering-runtime-test.mjs
```

Observed classifier output for:

```text
Fix dashboard approval workflow bug
```

```json
{
  "domain": "dashboard",
  "language": "php",
  "framework": "laravel",
  "repo": "D:\\Project\\Master\\Bakudan\\dashboard.bakudanramen.com",
  "risk": "high",
  "complexity": "medium",
  "productionImpact": "high"
}
```

Observed router output:

```json
{
  "selected_model": "claude",
  "confidence": 92,
  "reason": "Laravel/PHP work maps to Claude for architecture and large refactor safety."
}
```

Result:

```text
Model selection is automatic. CEO does not select the model.
```
