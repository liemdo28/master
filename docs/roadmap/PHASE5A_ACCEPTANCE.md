# Phase 5A Acceptance

Acceptance command:

`npm run phase5a:acceptance`

Scenario:

`Prepare and organize the next development work for Mi without modifying production.`

Required result:

- Mi Core project is registered.
- Fresh project map exists.
- Context pack is created.
- Goal is created.
- Plan has no more than five milestones.
- Child tasks are draft-only and wait for approval.
- Daily brief is generated.
- Restart recovery returns the same goal, child task IDs, and brief.
- No coding task runs automatically.
- No push, merge, deploy, email, publish, or external action occurs.

Closure gates:

- Personal APIs reject unauthenticated localhost and accept authenticated requests.
- Malformed and oversized JSON return controlled errors.
- Preference conflict policy prevents inferred preferences from overriding confirmed user preferences.
- Strict ID, enum, date, array, and length validation is enforced.
- Goal state transitions are explicit and audited.
- Duplicate planning returns the existing plan and child task IDs.
- Partial child-task creation failures recover without duplicate tasks.
- Daily brief generation is same-date idempotent and separates facts, suggestions, and unknowns.
- Secret-shaped and prompt-injection-shaped task text is redacted from daily briefs.
- SQLite integrity and foreign-key checks pass.

Phase 5A stops after these gates pass. Phase 5B, voice, calendar/email writes, autonomous actions, and coding-engine changes remain not started.
