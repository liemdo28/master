# Phase 5G Kill Switch

Scopes:

- `GLOBAL`
- `PROJECT`
- `ACTION_TYPE`

Checks run at:

- proposal time
- approval time
- immediately before execution

Global lockdown:

```powershell
npm run personal-os -- actions lockdown
```

Unlock:

```powershell
npm run personal-os -- actions unlock <killSwitchId>
```

The kill switch is DB-backed, durable, and restart-safe. It makes controlled actions fail closed and does not call external providers.
