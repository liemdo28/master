# Phase 5G security blocker closure — tracked credential remediation

A broad current-tree diagnostic secret scan (`diagnosis-logs/secret-diagnostic-current-tree.json`
in the `phase5g-blocker-diagnosis` worktree) found 12 tracked findings: 4 `TEST_FIXTURE`,
1 `DOCUMENTATION_EXAMPLE`, and 7 `UNKNOWN`. This document records the sanitized
classification and remediation of the 7 `UNKNOWN` findings. **No secret value appears
anywhere in this document, in any commit on this branch, or in the PR description.**

All 7 findings trace to a single commit, `c1e0b423` ("Publish Mi-core-system Master
source"), 2026-07-30 — the root commit of this repository, on `master`. None were
introduced or modified by Phase 5G (PR #71); `git diff --name-only` between `master`
and the PR #71 head touches none of these 7 files. `liemdo28/master` is a **public**
GitHub repository, so any real credential among these 7 has been publicly exposed since
2026-07-30.

## Classification

| # | File | Detector | Classification | Basis |
|---|------|----------|-----------------|-------|
| 1 | `Agent/agent-coding-api-keys/keys.json:39` | OPENAI_STYLE_KEY | REAL_CREDENTIAL_STATUS_UNKNOWN | `providers.opusmax.keys[0].value`, 67 chars, `active: true`, in a real config file for a registered `ACTIVE`/`HIGH`-criticality local service ("Antigravity AI Gateway", `server/src/company-os/project-registry.ts`). Not currently running (not in the live PM2 process list, port 3456 not listening). Provider-side validity not tested (prohibited without authorization). |
| 2 | `Agent/agent-coding-api-keys/keys.json:45` | OPENAI_STYLE_KEY | REAL_CREDENTIAL_STATUS_UNKNOWN | Same file, `providers.opusmax.keys[1].value`, same basis as #1. |
| 3 | `Other/VC/Format CV - NS South (web)/New Text Document.txt:1` | OPENAI_STYLE_KEY | REAL_CREDENTIAL_STATUS_UNKNOWN | Genuine Anthropic API key format prefix. Stray scratch file, no functional/runtime purpose, unrelated to any tooling in the repo. |
| 4 | `Other/VC/Format CV - NS South (web)/New Text Document.txt:2` | OPENAI_STYLE_KEY | REAL_CREDENTIAL_STATUS_UNKNOWN | Genuine OpenAI project-scoped key format prefix. Same file as #3. |
| 5 | `Raw/payroll/token.json:2` | GOOGLE_OAUTH_ACCESS_TOKEN | REAL_CREDENTIAL_STATUS_UNKNOWN | Complete, structurally valid Google OAuth credential set (access token, refresh token, `token_uri`, `client_id`, `client_secret`) actively read by 6 tracked Python scripts (`Raw/payroll/scripts/*.py`) that are part of a real payroll pipeline ("Payroll Calculator Project — Raw Sushi Bistro", see `Raw/payroll/README.md`). **Scope note**: the token's scopes include `.../auth/spreadsheets` (full read-write, not just `.readonly`) and `.../auth/drive.readonly` — if still valid, this grants write access to Google Sheets, not only read. |
| 6 | `keep-qb-heartbeat.js:12` | MI_CORE_API_KEY_ASSIGNMENT | REAL_BUT_REVOKED | Hardcoded `MI_CORE_API_KEY` literal, 64 chars. Matches (by hash) the current `server/.env` value, but **not** the value currently enforced by the live `mi-core` auth middleware (which resolves `process.env.MI_CORE_API_KEY` from the root `.env`, loaded first with no override — see `server/src/index.ts`'s `dotenv.config()` order). By construction, this literal cannot authenticate against the live server today. Not wired into PM2, `ecosystem.config.js`, or any Windows scheduled task — dead/manual-run script (only commit: the same root publish commit). Classification is based on static config/provenance analysis; the value was **not** tested live against the running server (prohibited without authorization; one incidental request to the public, unauthenticated `/api/health` route returned 200 as expected of any request, proving nothing about the key). |
| 7 | `send-qb-heartbeat.js:3` | MI_CORE_API_KEY_ASSIGNMENT | REAL_BUT_REVOKED | Same value and same basis as #6. |

## Remediation applied (this branch, `codex/security-remove-tracked-credentials`)

1. `Other/VC/Format CV - NS South (web)/New Text Document.txt` — deleted entirely (`git rm`); no functional purpose, contained only the two leaked key-format strings.
2. `Agent/agent-coding-api-keys/keys.json` — untracked (`git rm --cached`); left on disk unchanged so the local gateway tool keeps working; added to `.gitignore`; added `keys.example.json` placeholder template and a `README.md` explaining setup and required manual provider-side rotation.
3. `Raw/payroll/token.json` — untracked (`git rm --cached`); left on disk unchanged so the payroll scripts keep working; added to `.gitignore`; added `token.example.json` placeholder template; documented required manual Google Cloud Console rotation and the regeneration path (`scripts/oauth_auth.py`) in `Raw/payroll/README.md`.
4. `keep-qb-heartbeat.js` / `send-qb-heartbeat.js` — hardcoded `MI_CORE_API_KEY` literal replaced with `process.env.MI_CORE_API_KEY || ''` (matches how the rest of the codebase already reads this variable).
5. Added `server/src/__tests__/tracked-credential-scan.test.ts` (wired into `npm run test:ci` as `test:tracked-credential-scan`) — a permanent regression check over the current tracked tree for the exact detector patterns involved in these 7 findings, so a re-introduction fails CI.

## What remediation does NOT include (requires your action)

Per the directive's immediate security rule, provider-side rotation/revocation cannot
be performed by this remediation pass — it requires account access this agent does not
have:

- **opusmax** — rotate/revoke the two exposed key values (#1, #2) at whatever
  console/dashboard `opusmax` provides for the account in use.
- **Anthropic** — rotate/revoke the exposed key (#3) at
  [console.anthropic.com](https://console.anthropic.com) → API Keys.
- **OpenAI** — rotate/revoke the exposed key (#4) at
  [platform.openai.com](https://platform.openai.com) → API keys.
- **Google Cloud** — revoke the OAuth grant and/or rotate the OAuth client secret (#5)
  for the payroll pipeline's Google Cloud project (OAuth consent screen /
  credentials), then re-run `python scripts/oauth_auth.py` in `Raw/payroll/` to issue
  a fresh `token.json`.
- #6/#7 (`MI_CORE_API_KEY`) do not require provider-side action — no third-party
  provider is involved and the specific exposed value does not authenticate against
  the current live server. As a precaution, since this application's own shared secret
  controls its full API surface, you may still wish to rotate the live
  `MI_CORE_API_KEY` in root `.env` independently of this finding; that is a separate,
  optional, higher-blast-radius action not required to close out these 2 findings and
  was not performed here.

## Historical exposure

**HISTORICAL EXPOSURE: YES** for findings #1–#5 (real-format credentials, public repo,
exposed since 2026-07-30 at commit `c1e0b423`, sole commit in this repository's
history — there is no earlier or later tracked copy). Removing the credential material
from the current tracked tree (this branch) does not undo that historical exposure;
per repository policy, `master` history is not rewritten and is not force-pushed.
Historical exposure remains historical exposure regardless of current-tree state, and
is only neutralized by provider-side rotation (see above) — current-tree removal alone
does not make a still-valid credential safe.

For #6/#7, historical exposure is also YES, but the specific exposed value is
config/provenance-provably non-functional against the current live server (see
classification above), which meaningfully lowers — though does not entirely
eliminate — the practical risk versus #1–#5.

## Incidental exposure during this diagnosis (disclosed per directive requirement to document exposure)

During investigation, two tooling mistakes on the agent's side caused small amounts of
already-tracked, already-exposed secret material to appear in this session's own tool
output (never in a commit, PR, or any file): (a) a redaction regex bug printed roughly
the first 20 characters of findings #3 and #4 while inspecting file structure, and (b)
the `Read` tool (which has no redaction capability and must be invoked before an `Edit`
call) printed the full value for finding #6/#7 while preparing the credential-removal
edit for `keep-qb-heartbeat.js` and `send-qb-heartbeat.js`. Both files' actual literal
values were already tracked in the public repository at commit `c1e0b423` before this
diagnosis began — this session's mistakes did not newly expose anything beyond what
was already present at that commit, but are recorded here for completeness per the
directive's "document exposure without including the secret" requirement.
