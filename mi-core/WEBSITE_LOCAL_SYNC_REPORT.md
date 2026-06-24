# Website Local Sync Report

Generated: 2026-06-14

## Sync Runtime

- New source-of-truth connector: `server/src/visibility/connectors/website-source-connector.ts`
- Connected through: `server/src/visibility/visibility-hub.ts`
- Cache root: `E:/Project/Master/.local-agent-global/visibility/websites`
- Secret exclusion policy: `.env`, non-template env files, token, credential, secret, and password files are excluded from ingestion.

## Bakudan Local Sync

- Connector id: `website-bakudan`
- Status: `ok`
- Synced at: `2026-06-14T14:17:33.333Z`
- Local source: `E:/Project/Master/Bakudan/bakudanramen.com-current`
- Primary pages: 17
- Total synced page-like files: 21
- Components: 5
- Assets: 1107
- SEO files: 2
- Config files: 4
- Deployment files: 1
- README/docs: 5
- Package files: 3
- Environment templates: 2
- Excluded secret files: `.env`, `.htpasswd`
- Local sync risks: none from connector rules.

## Raw Sushi Local Sync

- Connector id: `website-raw`
- Status: `ok`
- Synced at: `2026-06-14T14:17:33.632Z`
- Local source: `E:/Project/Master/RawSushi/RawWebsite`
- Primary pages: 33
- Total synced page-like files: 123
- Components: 8
- Assets: 6
- SEO files: 9
- Config files: 10
- Deployment files: 7
- README/docs: 32
- Package files: 4
- Environment templates: 1
- Excluded secret files: none found by connector rules.
- Local sync risks: local branch/deploy branch mismatch must be checked before release.

## Enterprise Brain Entity Integration

Created per website:

- `Website`
- `Repo`
- `Local Source`
- `Domain`
- `Deploy Target`
- `Owner`

Relationships created per website:

- `Website -> has_source -> Local Source`
- `Website -> syncs_to -> Repo`
- `Website -> deploys_to -> Domain`
- `Website -> uses_deploy_target -> Deploy Target`
- `Owner -> owns -> Website`

Cache files written:

- `E:/Project/Master/.local-agent-global/visibility/websites/bakudan/data.json`
- `E:/Project/Master/.local-agent-global/visibility/websites/bakudan/entities.json`
- `E:/Project/Master/.local-agent-global/visibility/websites/bakudan/inventory.json`
- `E:/Project/Master/.local-agent-global/visibility/websites/raw/data.json`
- `E:/Project/Master/.local-agent-global/visibility/websites/raw/entities.json`
- `E:/Project/Master/.local-agent-global/visibility/websites/raw/inventory.json`

