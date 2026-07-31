# Project Registry Operator Runbook

From `server`:

```powershell
npm run project-registry -- list
npm run project-registry -- register-mi "D:\Project\Mi-core-system\Master\mi-core"
npm run project-registry -- verify mi-core
npm run project-registry -- map mi-core
npm run project-registry -- map-status mi-core
npm run project-registry -- context-pack mi-core "task runtime project registry guard"
```

Validation:

```powershell
npm run build
npm run test:project-registry
npm run test:ci
npm run project-registry:acceptance
```

Live acceptance should use the production repository root and existing authenticated API checks. Do not delete PM2 backups or old branches as part of this phase.
