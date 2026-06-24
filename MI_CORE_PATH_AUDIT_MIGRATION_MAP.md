# Mi-Core Path Audit & Migration Map

Date: 2026-06-24

## Scope

Checked whether these paths are misplaced parts of `E:\Project\Master\mi-core`:

- `E:\Project\Mi`
- `E:\Project\Master\Mi`
- `E:\Project\Master\node_modules`
- `E:\Project\Master\artifact-registry`

## Result summary

| Path | Physical child of mi-core? | Functional relationship | Recommendation |
|---|---:|---|---|
| `E:\Project\Mi` | No | Partial n8n runtime data only | Compare data before deleting |
| `E:\Project\Master\Mi` | No | Strong Mi-Core relationship via `Mi\n8n` | Treat as externalized Mi-Core automation module |
| `E:\Project\Master\node_modules` | No | Belongs to `E:\Project\Master\package.json` | Do not merge with `mi-core\node_modules` |
| `E:\Project\Master\artifact-registry` | No | Runtime logs/pid; no direct Mi-Core reference found | Keep until owner process is identified |

## Evidence

PowerShell confirmed the four suspect paths exist, but none is physically under `E:\Project\Master\mi-core`. They are normal directories, not symlink or junction redirects.

`E:\Project\Master\Mi\n8n` is related to Mi-Core because it contains:

- `N8N_MI_CORE_CONTRACT.md`
- `N8N_ARCHITECTURE_AUDIT.md`
- `N8N_VALIDATION_REPORT.md`
- `config`, `credentials`, `data`, `docs`, `reports`, `scripts`, and `workflows`

The old/internal Mi-Core n8n path still exists:

- `E:\Project\Master\mi-core\services\n8n-execution-bus`

That old path contains launcher/execution-bus files:

- `control\n8n-control-service.js`
- `docker-compose.yml`
- `n8n-start.js`
- `n8n-launch.log`
- `workflows\workflow-registry.json`

The architecture audit says the old scope was `E:\Project\Master\mi-core\services\n8n-execution-bus\` and the target upgraded path was `Project/Master/Mi/n8n/`. Therefore `E:\Project\Master\Mi\n8n` appears to be the newer/externalized n8n automation fabric for Mi-Core.

## Migration recommendation

Do not move/delete automatically.

Safe order if you want consolidation later:

1. Backup `E:\Project\Mi`, `E:\Project\Master\Mi`, `E:\Project\Master\artifact-registry`, and relevant Mi-Core service folders.
2. Check PM2/runtime config for active `mi-core` and `mi-n8n` paths.
3. Compare `E:\Project\Mi\n8n\data` with `E:\Project\Master\Mi\n8n\data`.
4. Pick one canonical n8n data root.
5. Update scripts/config/PM2 references.
6. Verify Mi-Core port `4001` and n8n checks.
7. Archive stale duplicate folders only after no active writes are detected.

## Final conclusion

Your suspicion is valid: `E:\Project\Master\Mi\n8n` is functionally tied to Mi-Core and likely came from or replaced the old `E:\Project\Master\mi-core\services\n8n-execution-bus` service.

However, the original four paths are not physically inside `E:\Project\Master\mi-core` today. The safest interpretation is: keep `Master\Mi\n8n` as an externalized Mi-Core module, verify duplicate data under `E:\Project\Mi\n8n`, and avoid moving/deleting anything until active runtime paths are confirmed.
