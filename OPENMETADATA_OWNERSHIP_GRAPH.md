# OPENMETADATA_OWNERSHIP_GRAPH

Generated: 2026-06-13
Status: RESEARCH_ONLY

## Objective

Design an OpenMetadata-inspired ownership model:

```text
Owner
-> owns
Project
-> contains
Service
-> depends_on
System
```

## Questions Mi Must Answer

- Dev nao so huu project nao?
- Project nao chua co owner?
- Owner nao dang qua tai?
- Blocker nao thuoc ve ai?

## Ownership Entities

| Mi Entity | OpenMetadata Candidate |
|---|---|
| Dev1 | User or Team |
| Dev2 | User or Team |
| Dev3 | User or Team |
| QA_AGENT | Team |
| RELEASE_AGENT | Team |
| AUDITOR_AGENT | Team |
| Dashboard | Data Product / Dashboard Service |
| Review Automation | Pipeline Service |
| Mi-Core | Data Product / API service |
| Blocker | Tag/classification + custom property |

## Ownership Fields

Recommended ownership metadata:

| Field | Example |
|---|---|
| `owners` | `QA_AGENT`, `Dev3` |
| `experts` | `Dev2 Knowledge Layer` |
| `domain` | `Mi Operating Backend` |
| `tags` | `critical`, `P2`, `blocked` |
| `tier` | `Tier1` |
| `customProperties.primaryOwner` | `Dev3` |
| `customProperties.backupOwner` | `QA_AGENT` |
| `customProperties.currentBlockers` | `Review Automation evidence path` |

## Owner Propagation

OpenMetadata owner propagation can inspire Mi ownership inheritance:

```text
System owner
-> Project owner
-> Service owner
-> Module owner
```

Example:

```text
Mi Operating Backend
-> Mi-Core
-> Knowledge Universe
-> Execution Package Generator
```

If `Execution Package Generator` has no explicit owner, inherit Dev2 as expert and Dev3 as consumer.

## Overload Model

Owner overload is not a native OpenMetadata execution metric, but can be represented with custom properties or calculated outside OpenMetadata.

Suggested Mi calculation:

```text
owner_load =
  owned_critical_services * 4
  + active_blockers_owned * 5
  + active_work_orders * 3
  + P0_P1_responsibilities * 6
```

Load bands:

| Score | Status |
|---:|---|
| 0-9 | Normal |
| 10-19 | Busy |
| 20-29 | Overloaded |
| 30+ | Critical overload |

## Unowned Project Detection

Rule:

```text
owners is empty
OR primaryOwner is null
OR owner is inherited but no accountable project owner exists
```

Expected output:

```json
{
  "unowned_projects": [
    {
      "name": "Example Project",
      "reason": "No direct owner and no inherited owner"
    }
  ]
}
```

## Blocker Ownership

Blockers should link to:

```text
Blocker
-> blocks -> Project/Service
-> assigned_to -> Owner
-> evidenced_by -> Report/WorkOrder
```

OpenMetadata can store blocker state as tags/custom properties, but Mi should keep blocker workflow state in its operational memory/work order layer.

## Verdict

OpenMetadata is a strong ownership catalog candidate. It should be used for owner visibility and governance, not for workload execution or approval decisions.
