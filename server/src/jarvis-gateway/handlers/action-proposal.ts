/**
 * ACTION_PROPOSAL — directive §18, §27. Only the 3 currently-approved
 * external action types may ever become a proposal:
 * GMAIL_CREATE_DRAFT / CALENDAR_EVENT_PROPOSAL / CALENDAR_CREATE_EVENT. The
 * Gateway may prepare/propose them; it never executes or approves them
 * (that stays exclusively ControlledActionService.approve()/.execute(),
 * called only from the canonical Controlled Actions UI/API — see §21).
 *
 * This handler never guesses a security-sensitive target field (recipient,
 * event time, attendees) from ambiguous free text (§27) — it always asks
 * for the exact structured fields instead of fabricating them. Real
 * proposal creation from validated structured input remains a Command
 * Center / API-key operation against personal-os/actions/router.ts
 * directly; the Gateway does not call `.propose()` in this phase.
 */
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

const REQUIRED_FIELDS: Record<string, string[]> = {
  GMAIL_CREATE_DRAFT: ['to', 'subject', 'body'],
  CALENDAR_EVENT_PROPOSAL: ['title', 'start', 'end', 'timezone'],
  CALENDAR_CREATE_EVENT: ['title', 'start', 'end', 'timezone'],
};

function detectActionType(text: string): keyof typeof REQUIRED_FIELDS | null {
  const t = text.toLowerCase();
  if (/\bemail|draft|gmail\b/.test(t)) return 'GMAIL_CREATE_DRAFT';
  if (/\bcalendar|meeting|event\b/.test(t)) return 'CALENDAR_EVENT_PROPOSAL';
  return null;
}

export function handleActionProposal(requestId: string, text: string, projectId: string | null): JarvisResponse {
  const response = baseResponse(requestId, 'ACTION_PROPOSAL', projectId);
  const actionType = detectActionType(text);

  if (!actionType) {
    response.status = 'NEEDS_CLARIFICATION';
    response.answer = 'Which action would you like to prepare? Supported: draft a Gmail email, or propose a calendar event.';
    response.unknowns = ['action_type'];
    return response;
  }

  response.status = 'NEEDS_CLARIFICATION';
  response.answer = `To prepare a ${actionType} proposal I need the exact fields — I never guess a recipient, time, or attendee from free text. Please provide: ${REQUIRED_FIELDS[actionType].join(', ')}.`;
  response.unknowns = REQUIRED_FIELDS[actionType];
  response.approvalRequirement = 'STANDARD';
  response.suggestedNextSteps = [`Provide ${REQUIRED_FIELDS[actionType].join(', ')}, or use Command Center → Actions to prepare this proposal with a form.`];
  return response;
}
