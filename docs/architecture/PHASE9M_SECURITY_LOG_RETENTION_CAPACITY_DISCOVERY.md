# Phase 9M — Windows Security Log Retention / Capacity Discovery

**Status: DISCOVERY, COMPLETE.** Three genuine, real-time-separated measurement points (T1/T2/T3, spanning ~2026-08-24 14:44 through 2026-08-25 20:01 local) were collected. No Security log, audit-policy, PM2, or application configuration was changed at any point in this phase.

## A. Frozen Phase 9L baseline

- Windows Process Creation auditing: `Success` (unchanged throughout)
- Command-line capture: `OFF` (unchanged throughout — re-confirmed at every checkpoint)
- Sysmon: not installed, `NOT_NEEDED` per Phase 9L (unchanged, not revisited)
- Natural event `PM2_INTERNAL_EXECUTION_TRIGGER_UNKNOWN`, historical UNKNOWN count 13 — both explicitly out of scope for this phase and not reopened.

## B. Security log configuration

Unchanged throughout Phase 9M: `maxSize = 20,971,520 bytes (~20 MB)`, `retention = false` (overwrite oldest when full), `autoBackup = false`, `fileMax = 1`.

## C. Measurement timeline (T1 / T2 / T3)

| Checkpoint | Timestamp (local) | evtx size | RecordCount | Oldest retained | Newest retained | Retained window |
|---|---|---|---|---|---|---|
| T1 | 2026-08-24 14:44:40 | 20,975,616 B | 30,357 | 2026-08-24 11:17:41 | 2026-08-24 14:44:40 | ~3h27m |
| T2 | 2026-08-24 19:45:20 | 20,975,616 B | 30,646 | 2026-08-24 14:18:31 | 2026-08-24 19:45:19 | ~5h26m48s |
| T3 | 2026-08-25 20:01:43 | 20,975,616 B | 30,469 | 2026-08-25 18:44:50 | 2026-08-25 20:01:43 | ~1h16m53s |

All three checkpoints show the evtx file at the identical byte size (20,975,616 — the configured maximum), with the retained time window varying by more than **4x** (77 minutes at T3 vs. 5h27m at T2) purely as a function of how busy the workload was during that stretch. This is direct, repeated, multi-day evidence — not a single snapshot.

**`STEADY_STATE_ROLLOVER_CONFIRMED`**: the log is genuinely full and cycling at every checkpoint; retention is not "still filling up" — it has been in steady-state overwrite behavior throughout the entire measurement period.

## D. Valid windows and clipping

| Checkpoint | 15m 4688 | 60m 4688 | 180m 4688 | 360m/720m/1440m |
|---|---|---|---|---|
| T1 | 6,031 (see note) / 599 (independent adjacent sample) | 23,322 | 28,098 | `WINDOW_CLIPPED_BY_RETENTION` |
| T2 | 616 | 2,539 | 7,209 | `WINDOW_CLIPPED_BY_RETENTION` |
| T3 | 4,080 | 19,234 | `WINDOW_CLIPPED_BY_RETENTION` | `WINDOW_CLIPPED_BY_RETENTION` |

Clipping rule applied consistently: any requested window wider than the checkpoint's actual retained history is marked clipped and excluded from rate calculations. T1's own 180m/360m/720m/1440m windows returned nearly identical totals (28,098 → 30,311 → 30,315 → 30,387) — direct proof those wider windows were already clipped by the ~3h27m retained history, not genuine 6h/12h/24h measurements.

**T1's two 15-minute figures (6,031 vs. 599)** are preserved as separate, real observations, not reconciled into one number — they were different sampling moments within the same checkpoint session, and the discrepancy itself is direct evidence of burstiness (see Section G).

**T3's noted timing artifact**: the later `TOTAL_4688=657` process-source query and the `Window=15min 4688=4080` figure are *not* the same 15-minute interval — the PowerShell script recomputes `$start` immediately before the process-source query, after the windowed-count loop has already consumed real time. Both figures are preserved as distinct, valid observations rather than treated as a parsing discrepancy.

## E/F. Event 4688 rates (valid windows only)

| Checkpoint | 15m rate | 60m rate | 180m rate |
|---|---|---|---|
| T1 | ~2,396/hr (599 sample) or ~24,124/hr (6,031 sample, burst) | 23,322/hr | 9,366/hr |
| T2 | 2,464/hr | 2,539/hr | 2,403/hr |
| T3 | 16,320/hr | 19,234/hr | — |

T2's three internally-consistent rates (2,464 / 2,539 / 2,403 per hour) represent the **calmest** sustained period observed. T3's rates (16,320–19,234/hr) represent the **busiest** sustained period observed. T1 sits between, with its own internal spread (599 vs. 6,031 in nominally the same 15-minute class) itself illustrating short-timescale burstiness within a single checkpoint.

## G. Burstiness

**`HIGH_BURSTINESS`**

Directly evidenced, not assumed: the sustained hourly 4688 rate varies by more than **7.5x** between the calmest (T2, ~2,539/hr) and busiest (T3, ~19,234/hr) genuine full-hour observations — and T1's own within-checkpoint spread (599 vs. 6,031 in a nominal 15-minute class) shows the same volatility at a finer timescale. This is not stationary traffic; any capacity model must be built from the range, not a single average.

## H. Event 4688 share of total Security events

| Checkpoint | Share |
|---|---|
| T1 | ~92.7–98.9% (599/620-ish and 6,031/6,101 samples both in this range) |
| T2 | ~96.8–99.4% |
| T3 | ~95.4–97.1% |

Event 4688 consistently accounts for the overwhelming majority of Security-log volume at every checkpoint. This is not characterized as a defect — enabling Process Creation auditing was expected, by design, to become the dominant contributor to this log's capacity consumption.

## I. Top process-creation sources (representative, T2 and T3 samples)

Consistent across both samples: `conhost.exe` (~238–243), `WMIC.exe` (~138), `cmd.exe` (~97–98), `node.exe` (~78–79), with `reg.exe`, `NETSTAT.EXE`, and other small Windows/PM2/background processes making up the remainder. This characterizes the workload only. **No process-spawning behavior was modified, and none is proposed by this document** — any apparent inefficiency in this pattern (e.g., `WMIC.exe`'s frequency) is recorded as `SEPARATE_OPERATIONAL_DEBT`, distinct from the capacity question this phase addresses.

## J. Empirical storage ratio

Three independent full-log observations, all converging on the same order of magnitude:
- T1: 20,975,616 bytes / 30,357 events ≈ 691 bytes/event
- T2: 20,975,616 bytes / 30,646 events ≈ 684 bytes/event
- T3: 20,975,616 bytes / 30,469 events ≈ 688 bytes/event

**Empirical ratio used: ≈685–690 bytes/event.** This is stated as an empirical capacity ratio only — EVTX has chunk overhead, indexing structures, and variable per-event size, so this is not a claim of exact per-event byte cost, only a validated, repeatedly-observed whole-log ratio.

## K. LOW / CENTRAL / HIGH MB/day model

Derived directly from the three genuine steady-state full-log snapshots, using: `MB/day ≈ 20 MB / observed_retention_hours × 24`. This uses the *retention window itself* — the strongest available empirical signal, since it reflects real, sustained, multi-hour churn rather than a single short sample.

| Scenario | Source checkpoint | Retention observed | MB/day |
|---|---|---|---|
| LOW | T2 (calmest) | 5.447 h | ≈ 88 MB/day |
| CENTRAL | T1 (middle) | 3.45 h | ≈ 139 MB/day |
| HIGH | T3 (busiest) | 1.282 h | ≈ 375 MB/day |

These are explicitly **empirical scenarios drawn from three real observations**, not statistically fitted extremes — with only 3 data points, the true worst case could exceed 375 MB/day, and the true best case could fall below 88 MB/day. Confidence is moderate for the LOW–CENTRAL range (consistent with T2's internally-consistent 15/60/180-minute rates) and lower for HIGH (T3's single ~77-minute window is the shortest and least time-averaged observation).

## L. Capacity targets (before headroom)

| Window | LOW (88 MB/day) | CENTRAL (139 MB/day) | HIGH (375 MB/day) |
|---|---|---|---|
| 1 day | 88 MB | 139 MB | 375 MB |
| 3 days | 264 MB | 417 MB | 1,125 MB (~1.1 GB) |
| 7 days | 616 MB | 973 MB | 2,625 MB (~2.6 GB) |
| 14 days | 1,232 MB (~1.2 GB) | 1,946 MB (~1.9 GB) | 5,250 MB (~5.1 GB) |
| 30 days | 2,640 MB (~2.6 GB) | 4,170 MB (~4.1 GB) | 11,250 MB (~11.0 GB) |

**Headroom, stated separately, not embedded above:** given `HIGH_BURSTINESS` and only 3 sample points, a 1.5× (50%) headroom multiplier on the HIGH scenario is a defensible margin against an as-yet-unobserved worse burst — e.g., a 7-day HIGH-with-headroom figure would be ≈3.9 GB rather than 2.6 GB. This multiplier is a judgment call stated explicitly here, not silently folded into Section K's model.

## M. System-drive free-space check

Read-only, via `Get-PSDrive C`: **≈325.12 GB free** on the drive containing `Security.evtx`. Every candidate capacity in Section L — even the 30-day HIGH-with-headroom figure (≈16–17 GB) — represents well under 5% of currently free space. **Disk capacity is not a constraint on any candidate target evaluated here.**

## N. Forensic usefulness vs. cost (1d / 3d / 7d / 14d / 30d)

| Window | Forensic usefulness | Storage cost (CENTRAL–HIGH) | Privacy duration | Operational simplicity |
|---|---|---|---|---|
| 1 day | Low — this program's own restart investigations have routinely taken longer than same-day to notice and pursue | 139–375 MB | Shortest | Simplest |
| 3 days | Moderate | 417 MB–1.1 GB | Short | Simple |
| 7 days | **High — matches this program's actual observed investigation cadence** (events in this program were typically noticed and followed up within 1–4 days, not same-day) | 973 MB–2.6 GB | Moderate | Simple |
| 14 days | High, modest incremental gain over 7 days given observed cadence | 1.9–5.1 GB | Longer | Simple |
| 30 days | Diminishing incremental forensic value beyond 14 days given actual observed cadence, though not zero | 4.1–11.0 GB | Longest | Simple |

**Given the disk headroom is not a limiting factor, the deciding tradeoff is forensic-value-per-day-of-retention versus unnecessary privacy duration — not storage cost.** The observed pattern in this program (investigations pursued within days, not weeks) suggests **7–14 days delivers most of the realistic forensic value**; extending to 30 days is affordable but shows diminishing marginal value against this program's own actual behavior, and extends privacy-relevant metadata retention (process names, account/logon context, timestamps — command-line remains off) for a proportionally longer period without a demonstrated corresponding need.

## O/Privacy. Privacy assessment

Command-line capture remains **OFF** throughout — confirmed at T1, T2, and T3. Retained data is limited to process names, PIDs, creator/parent relationships, account/logon identifiers, and timestamps; no command arguments, secrets, or tokens are captured by this mechanism. Increased retention duration proportionally extends how long this metadata persists:

| Window | Privacy exposure |
|---|---|
| 1d | Minimal duration |
| 7d | Moderate duration, matches likely operational need |
| 14d | Longer duration, still bounded (no command-line content) |
| 30d | Longest duration evaluated; not recommended merely because disk space permits it |

## P. Current 20 MB classification

**`RETENTION_INSUFFICIENT`**

Directly measured, not inferred: retention ranged from ~77 minutes to ~5.4 hours across three real checkpoints spanning over a day of normal operation. Even the *best* observed case (T2, ~5.4 hours) falls far short of any useful delayed-investigation window — and this program has repeatedly needed to investigate restarts noticed hours to days after they occurred.

## Q. Recommended target range

**`RETENTION_INCREASE_JUSTIFIED`**

**`RECOMMENDED_TARGET_RANGE = 1 GB – 4 GB`**, sized to cover a **7–14 day** forensic window under the CENTRAL-to-HIGH empirical scenarios with the stated 1.5× headroom, while explicitly declining to recommend the 30-day/10+ GB tier given the diminishing forensic-value-per-privacy-day tradeoff identified in Section N. This range is a recommendation for a **separately-authorized future implementation phase** — no configuration was changed to produce or validate this range in Phase 9M.

## R. Measurement limitations

- Only 3 checkpoints were collected; the true statistical LOW/HIGH bounds may fall outside the 88–375 MB/day range observed.
- T3's HIGH scenario rests on a single ~77-minute retained window — the least time-averaged of the three checkpoints.
- No measurement spans a full continuous 24-hour window without clipping, since the log itself never retained that long at any checkpoint — this is itself the core finding, not a gap to be explained away.
- The 685–690 bytes/event ratio is a whole-log empirical average, not a verified per-event-type cost.

## S. Explicit non-goals

- No Security log size, retention mode, or `autoBackup` setting was changed.
- No audit policy was changed; Process Creation remains `Success`; command-line capture remains `OFF`.
- No Sysmon action was taken.
- No PM2 mutation, restart, deploy, or application/config change was performed.
- Process-spawning patterns characterized in Section I (`conhost.exe`, `WMIC.exe`, etc.) were not modified and are not proposed for modification here.
- The 13 historical UNKNOWN restart events and the `PM2_INTERNAL_EXECUTION_TRIGGER_UNKNOWN` natural-event classification from Phase 9L are unchanged and were not reopened.
- Additional restart activity observed incidentally during this phase (`mi-core` solo restarts at 2026-08-24T18:49:18, 2026-08-24T18:50:08, 2026-08-25T13:43:12, 2026-08-25T18:27:17, 2026-08-25T18:27:57 local, and a `mi-accounting` solo restart at 2026-08-25T18:26:36 local) is recorded here as a fact only — not investigated, not attributed, and explicitly out of scope for this phase.

## T. Final recommendation

**`PRESERVE MEASUREMENT AND DEFER SIZE CHANGE TO A SEPARATELY-AUTHORIZED PHASE.`** This document establishes `RETENTION_INSUFFICIENT` with real, repeated, multi-day evidence and proposes a `1 GB–4 GB` / 7–14-day target range for that future phase's consideration. No configuration change is made or scheduled by this document itself.
