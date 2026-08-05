# Phase 5C — read-only Gmail and Calendar intelligence

Mi reads the owner's calendar and mail to build an operating agenda. It cannot change
either. This document records how that guarantee is enforced and where it stops.

## Why the guarantee needs code, not policy

The stored OAuth grant at `.local-agent-global/visibility/google-tokens.json` is
**over-privileged**. Alongside the read scopes it carries:

```
gmail.send  gmail.compose  calendar.events  spreadsheets  drive.file  business.manage
```

So "read-only" cannot be inferred from the credential — the credential would happily
send mail. Phase 5C therefore enforces it in code, at four independent layers:

1. **Capability interface.** `GoogleReadCapabilities` names only read operations. A
   caller has no mutation method to reach for.
2. **Endpoint allowlist.** `guardTransport` refuses any endpoint outside
   `ALLOWED_ENDPOINTS` before it reaches the provider. `gmail.users.messages.send`,
   `calendar.events.insert` and friends are absent and rejected.
3. **Runtime assertion.** `assertNoWriteCapability` runs in the `GoogleReadClient`
   constructor and throws if any name in `FORBIDDEN_CAPABILITY_METHODS` is exposed, so
   a future accidental addition fails at startup rather than in review.
4. **No route.** The API exposes no Gmail or Calendar mutation route; the acceptance
   asserts 404 for representative write attempts.

The existing write-capable adapters — `actions/gmail-action-adapter.ts` and
`actions/google-executor.ts` — are **not imported anywhere in `src/intelligence/`**.

**Recommended follow-up:** re-consent the Google grant with `gmail.readonly` and
`calendar.readonly` only. Phase 5C never requests write scopes, but least privilege at
the credential would remove the need to rely solely on code.

## External content is untrusted

Anyone who knows the owner's address can put text in front of Mi. `sanitize.ts` treats
every body, subject, title and event description as hostile input:

- markup, scripts, styles, iframes and HTML comments are stripped
- remote images and tracking pixels are removed
- quoted reply history is trimmed, so instructions hidden below the fold never load
- secrets (private keys, bearer tokens, `sk-`/`ghp_`/`ya29.`/`AKIA` forms, connection
  strings) are redacted and the record is marked `SECRET_REDACTED`
- steering phrases are replaced with `[untrusted-instruction]` — neutralised in place,
  so a human can still see that someone tried
- bodies are byte-bounded, summaries character-bounded
- attachments are **metadata only and never downloaded**; executable types are flagged

Nothing external ever becomes an ACTIVE fact. External content can only produce
`NEEDS_CONFIRMATION` knowledge candidates.

## Linking is evidence-based

`linkToProjects` confirms a project only on hard evidence: a whole-token project name or
id, an exact tag, a confirmed sender domain, or an explicit Mi goal id. Anything softer
returns `UNCERTAIN`, and an uncertain link carries **no** project ids into a follow-up —
so nothing downstream can mistake a guess for a fact.

## Follow-ups never execute

Detection is limited to explicit signals: a direct request, an unanswered direct
question, an owner commitment, an explicit dated deadline, a meeting that asks for
preparation, or a referenced approval. Every candidate records its source, reason,
confidence and evidence reference, and is stored as `SUGGESTION`. The store rejects any
other status outright. Phase 5C never starts a task.

## Persistence

Derived records only, in the existing Personal OS database (schema version 3):
`daily_agendas`, `weekly_reviews`, `follow_up_candidates`, `connector_sync_state`. WAL
and foreign keys on, indexed by date, status, due date and source. Gmail and Calendar
payloads are **not** cached — what survives is a bounded summary plus an opaque
`sha256`-derived evidence reference that contains no address or message id. Records
older than 120 days are pruned on open, and `purgeConnector` removes a connector's
derived output on disconnect.

## Honest degradation

A missing or unusable connector is reported, never faked. `inspectToken` classifies
`NOT_CONFIGURED`, `TOKEN_EXPIRED`, `INSUFFICIENT_SCOPE` or `READY`, and provider errors
are classified into `RATE_LIMIT`, `TIMEOUT`, `API_DISABLED`, `INSUFFICIENT_SCOPE`,
`TOKEN_EXPIRED` or `UNAVAILABLE` without echoing provider payloads or credentials.
Agendas and reviews state the gap in `unknowns` and report zero rather than a guess;
`meetingLoad.complete` and `focusTimeEstimate.complete` are false when the source data
was incomplete.

## Known real-connector status

At the time of writing, against the live grant:

- **Gmail read: working.** Real messages were read read-only.
- **Calendar read: blocked.** `HTTP 403 — Google Calendar API has not been used in
  project 768347413795 before or it is disabled.` This is a Cloud project setting, not a
  token scope problem; the two are classified separately because they need opposite
  fixes. Owner action: enable the Calendar API for that project.

## Not in this phase

No send, draft, reply, forward, RSVP, label change, archive, delete, or event
create/update/delete. No voice, no desktop control, no autonomous action.
