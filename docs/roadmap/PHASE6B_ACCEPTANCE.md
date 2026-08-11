# Phase 6B Acceptance

Phase 6B closes when all legacy mutation surfaces have a recorded disposition and the adapter/quarantine layer proves that no legacy route can bypass the Phase 5 authority model.

## Required Results

- Phase 6A production baseline remains intact.
- No merge or deployment is performed.
- Mutation count does not increase.
- Unknown mutations remain `0`.
- Unresolved legacy mutations are `0`.
- Gmail SEND, financial execution, process control, browser write, and generic workflow trigger attempts are denied.
- Allowed legacy Gmail draft and calendar requests are converted to canonical Controlled Action proposals only.
- Repeated legacy requests are idempotent and do not create duplicate canonical proposals.

## Phase 6C Boundary

Phase 6C must not start from Phase 6B work. It may only begin after Phase 6B is reviewed, merged, deployed, and frozen under a separate instruction.
