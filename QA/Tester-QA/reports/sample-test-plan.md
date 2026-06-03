# QA Test Plan: agent-coding runtime

## Scope
End-to-end runtime stability and operational readiness validation.

## Test Matrix
| Category | Test | Objective | Signal | Expected |
| --- | --- | --- | --- | --- |
| functional | Critical workflow smoke | Verify primary user workflow completes without state corruption. | Successful execution trace and final state. | No exception, no stale state, report generated. |
| concurrency | Concurrent worker saturation | Expose race conditions and worker deadlocks under parallel execution. | Queue depth, active workers, completion latency, error rate. | Bounded latency, no deadlock, graceful backpressure. |
| provider | Provider failure injection | Validate retry, fallback, and circuit-breaker behavior. | Retry count, fallback path, user-facing status. | Failure isolated with actionable error and preserved session state. |
| websocket | Websocket interruption | Detect stream interruption and dashboard desync. | Reconnect events, sequence gaps, stale UI state. | Automatic recovery or explicit degraded-state indicator. |
| queue | Queue overload | Validate queue limits, prioritization, and overload behavior. | Queue depth, dropped jobs, timeout rate. | No silent job loss; overload is reported and recoverable. |
| session | Session corruption replay | Ensure corrupted session state does not poison future runs. | Session validation result and recovery path. | Corruption detected, isolated, and recoverable. |
| visual | Visual dashboard QA | Detect broken layout, stale panels, and async render issues. | Screenshot evidence and UI state diff. | No overlapping controls, broken empty state, or stale operational status. |

## Bottlenecks
- Missing baseline metrics will weaken severity scoring.
- Unstructured logs will slow root-cause analysis.
- No synthetic failure injection will hide provider and queue risks.

## Recommendations
- [HIGH] Establish a minimum operational telemetry contract for every subsystem. Owner: Platform.
- [MEDIUM] Add incident templates to every critical workflow. Owner: QA.
- [HIGH] Run concurrency and provider-failure suites before release gates. Owner: Engineering.

_Created at: 2026-05-21T00:48:33.544842+00:00_
