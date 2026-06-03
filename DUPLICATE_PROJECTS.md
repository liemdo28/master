# DUPLICATE PROJECTS

Generated: 2026-06-01 19:03:40 +0700
Root: `E:\Project\Master`

## Confirmed Duplicate / Legacy Areas

| Duplicate Area | Paths | Classification | Action |
|---|---|---|---|
| Packing List nested copy | `Bakudan\packing-list` and `Bakudan\packing-list\packing-list` | Duplicate candidate | Confirm canonical runtime, then archive nested copy after approval. |
| LinkTreeHL nested copy | `Other\LinkTreeHL` and `Other\LinkTreeHL\LinkTreeHL` | Duplicate candidate | Confirm deploy path, then archive duplicate after approval. |
| Archived migration copies | `_archive\*-old-20260601`, `_archive\*-merged-20260601`, `_archive\*-root-dupe` | Legacy | Keep excluded from active Agent OS execution. |
| CV format variants | `Agent\ai-search-tool\cv-format-web`, `Other\VC\Format CV - NS South (web)\cv-format-web*` | Duplicate/variant candidate | Pick owner: Agent utility or Other/VC product. |
| Agent agency copies | `Agent\agent-coding\apps\agency`, `_archive\agentai-agency-merged-20260601`, root empty `agentai-agency` | Migration remnant | Keep `Agent\agent-coding\apps\agency` as active candidate; remove empty root placeholder after approval. |

## Empty Duplicate-Looking Root Folders

- `agent-coding` at root is empty while `Agent\agent-coding` contains the active project.
- `agentai-agency` at root is empty while archived and nested agency copies exist elsewhere.
- `-p` is empty and likely a failed command or placeholder artifact.

## Duplicate Package / App Risk

The workspace contains multiple JavaScript/Python/PHP manifests across products and archives. The high-risk duplicates are structural, not just package names: nested app folders may cause Agent OS to build/test/deploy the wrong path unless each product has a canonical path in `PROJECT_MAP.md` and later in `master-journal`.

## Policy

- Do not delete duplicates automatically.
- Mark canonical path first.
- Move non-canonical folders into `_archive` only through Approval Engine because deletion/archive affects rollback.
- Every duplicate resolution must emit an artifact and `AI_MEMORY_ENTRY.md`.

## CEO Canonical Decisions

See `CANONICAL_PROJECT_DECISIONS.md` for confirmed ownership: `Bakudan\packing-list` is canonical, LinkTreeHL belongs under Bakudan website ownership, and `Agent\agent-coding` is the Agent Brain.

## LinkTreeHL Migration Update

`Other\LinkTreeHL` has been copied into `Bakudan\bakudanramen.com-current\integrations\linktreehl-next` as a non-runtime source integration. See `LINKTREEHL_MIGRATION_REPORT.md`.
