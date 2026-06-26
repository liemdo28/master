# Mi-Core Path Audit & Migration Map

Date: 2026-06-26

## Scope

Checked and fixed the path confusion from the current Windows workspace:

- `D:\Project\Exports`
- `D:\Project\computer-operator-foundation`
- `D:\Project\Mi`
- `D:\Project\node_modules`
- `D:\Project\zip mi-core`
- Root-level `D:\Project\package*.json`, `ECC-main.zip`, `COMPANY_OS_AUDIT_GAP_REPORT.md`, and `phase33-ga4-env-update.js`

## Result summary

Canonical rules:

- Mi-Core lives at `D:\Project\Master\mi-core`.
- Mi manages projects under `D:\Project\Master`.
- `D:\Project\Master\Mi\n8n` is the canonical externalized Mi automation fabric.
- Laptop nodes are managed by Mi as external devices; `D:\Project\laptop1` remains a separate laptop repo, and laptop2 is a managed standby/setup target.

| Original path | Action | Canonical/result path |
|---|---|---|
| `D:\Project\Mi` | Compared with canonical n8n; copied unique data files; archived duplicate | `D:\Project\Master\Mi\n8n`, archive copy at `_archive\root-path-fix-20260626\Mi-root-duplicate` |
| `D:\Project\computer-operator-foundation` | Moved into Master so Mi can manage it | `D:\Project\Master\computer-operator-foundation` |
| `D:\Project\Exports` | Archived under Master without tracking large exports | `D:\Project\Master\_archive\root-path-fix-20260626\Exports` |
| `D:\Project\zip mi-core` | Archived under Master | `D:\Project\Master\_archive\root-path-fix-20260626\zip mi-core` |
| `D:\Project\node_modules`, root `package*.json` | Archived as root npm misfire | `D:\Project\Master\_archive\root-path-fix-20260626\root-*` |
| `D:\Project\COMPANY_OS_AUDIT_GAP_REPORT.md` | Moved into Mi-Core reports/source area | `D:\Project\Master\mi-core\COMPANY_OS_AUDIT_GAP_REPORT.md` |
| `D:\Project\phase33-ga4-env-update.js` | Moved into Mi-Core scripts | `D:\Project\Master\mi-core\scripts\phase33-ga4-env-update.js` |

## Evidence

PowerShell confirmed the suspect root paths existed under `D:\Project`, causing the File Explorer confusion shown in the screenshot.

`D:\Project\Master\Mi\n8n` is related to Mi-Core because it contains:

- `N8N_MI_CORE_CONTRACT.md`
- `N8N_ARCHITECTURE_AUDIT.md`
- `N8N_VALIDATION_REPORT.md`
- `config`, `credentials`, `data`, `docs`, `reports`, `scripts`, and `workflows`

The old/internal Mi-Core n8n path still exists:

- `D:\Project\Master\mi-core\services\n8n-execution-bus`

That old path contains launcher/execution-bus files:

- `control\n8n-control-service.js`
- `docker-compose.yml`
- `n8n-start.js`
- `n8n-launch.log`
- `workflows\workflow-registry.json`

The architecture audit says the old scope was `D:\Project\Master\mi-core\services\n8n-execution-bus\` and the target upgraded path was `Project/Master/Mi/n8n/`. Therefore `D:\Project\Master\Mi\n8n` is the newer externalized n8n automation fabric for Mi-Core.

## Verification

- `D:\Project` now contains only `.pytest_cache`, `laptop1`, `Master`, and `Personal`.
- `D:\Project\Mi\n8n\data` had only three files not present in canonical n8n: `approvals.jsonl`, `decisions.jsonl`, and `tasks.jsonl`. Those were copied into `D:\Project\Master\Mi\n8n\data`.
- Runtime/source defaults that still pointed at `E:\Project\Master` were updated to `D:\Project\Master` in Mi-Core source/config files.

## Remaining policy

Do not create new project folders directly under `D:\Project` except external laptop repos such as `D:\Project\laptop1`. New Mi-managed projects should be created under `D:\Project\Master`, and large exports should go under ignored archive/export areas.

## Final conclusion

Your suspicion was correct: several root-level paths were created at the wrong layer. The corrected model is now `D:\Project\Master\mi-core` for Mi-Core, `D:\Project\Master` for Mi-managed projects, and laptop1/laptop2 as managed external nodes.
