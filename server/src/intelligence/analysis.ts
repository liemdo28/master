/**
 * Bounded analysis over already-sanitised external context.
 *
 * Two rules shape everything here. Linking is evidence-based, never vibes: weak token
 * overlap yields UNCERTAIN, and only UNCERTAIN, so nothing downstream can act on it.
 * Follow-ups are detected from explicit signals only, and are always suggestions —
 * this module never produces a runnable task.
 */

import { randomUUID } from 'crypto';
import type {
  BusyInterval, CalendarEventContext, EmailContext, FocusWindow, FollowUpCandidate,
  FollowUpKind, LinkConfidence,
} from './types';

export interface LinkableProject {
  id: string;
  displayName: string;
  /** Domains or contacts already confirmed to belong to this project. */
  confirmedDomains?: string[];
  tags?: string[];
}

export interface LinkableGoal {
  id: string;
  title: string;
  projectIds: string[];
}

export interface LinkResult {
  projectIds: string[];
  goalIds: string[];
  confidence: LinkConfidence;
  reasons: string[];
}

function normalise(value: string): string {
  return (value || '').toLowerCase();
}

function senderDomain(from: string): string {
  const match = /<?([^<>\s]+@([^<>\s]+))>?/.exec(from || '');
  return match ? match[2].toLowerCase() : '';
}

/**
 * Confirmed linkage requires hard evidence: the exact project name or an exact tag
 * appearing as a whole token, a confirmed sender domain, or an explicit Mi id. Anything
 * softer is reported as UNCERTAIN and is excluded from task creation by callers.
 */
export function linkToProjects(
  text: string,
  from: string | null,
  projects: LinkableProject[],
  goals: LinkableGoal[],
): LinkResult {
  const haystack = normalise(text);
  const domain = from ? senderDomain(from) : '';
  const projectIds = new Set<string>();
  const reasons: string[] = [];
  let confirmed = false;

  for (const project of projects) {
    const name = normalise(project.displayName);
    const idToken = normalise(project.id);
    // Whole-token match only — "mi core" must not be matken from "harmonic ore".
    const nameHit = name.length > 3 && new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}([^a-z0-9]|$)`).test(haystack);
    const idHit = idToken.length > 3 && new RegExp(`(^|[^a-z0-9])${escapeRegex(idToken)}([^a-z0-9]|$)`).test(haystack);
    const tagHit = (project.tags || []).some(tag => tag.length > 2
      && new RegExp(`(^|[^a-z0-9])${escapeRegex(normalise(tag))}([^a-z0-9]|$)`).test(haystack));
    const domainHit = Boolean(domain) && (project.confirmedDomains || []).map(normalise).includes(domain);

    if (nameHit || idHit || tagHit || domainHit) {
      projectIds.add(project.id);
      confirmed = true;
      if (nameHit) reasons.push(`exact project name: ${project.displayName}`);
      if (idHit) reasons.push(`explicit project id: ${project.id}`);
      if (tagHit) reasons.push(`explicit tag for ${project.id}`);
      if (domainHit) reasons.push(`confirmed sender domain for ${project.id}`);
    }
  }

  const goalIds = new Set<string>();
  for (const goal of goals) {
    if (new RegExp(`(^|[^a-z0-9])${escapeRegex(normalise(goal.id))}([^a-z0-9]|$)`).test(haystack)) {
      goalIds.add(goal.id);
      confirmed = true;
      reasons.push(`explicit goal id: ${goal.id}`);
      continue;
    }
    const title = normalise(goal.title);
    if (title.length > 8 && haystack.includes(title)) {
      goalIds.add(goal.id);
      confirmed = true;
      reasons.push(`exact goal title: ${goal.title}`);
    }
  }

  if (confirmed) {
    return { projectIds: [...projectIds], goalIds: [...goalIds], confidence: 'CONFIRMED', reasons };
  }

  // Weak signal: a project word appears but not as a whole-token or confirmed match.
  const weak = projects.filter(p => normalise(p.displayName).split(/\s+/)
    .some(word => word.length > 4 && haystack.includes(word)));
  if (weak.length) {
    return {
      projectIds: weak.map(p => p.id),
      goalIds: [],
      confidence: 'UNCERTAIN',
      reasons: [`weak token overlap with ${weak.map(p => p.id).join(', ')} — needs confirmation`],
    };
  }

  return { projectIds: [], goalIds: [], confidence: 'NONE', reasons: ['no bounded evidence of a project link'] };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DEADLINE_PATTERNS = [
  /\bby\s+(\d{4}-\d{2}-\d{2})\b/i,
  /\bdue\s+(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/i,
  /\bdeadline[:\s]+(\d{4}-\d{2}-\d{2})\b/i,
  /\bbefore\s+(\d{4}-\d{2}-\d{2})\b/i,
];

function explicitDeadline(text: string): string | null {
  for (const pattern of DEADLINE_PATTERNS) {
    const hit = pattern.exec(text);
    if (hit) return hit[1];
  }
  return null;
}

export interface FollowUpInput {
  emails: EmailContext[];
  events: CalendarEventContext[];
  /** Addresses belonging to the owner, used to tell "they asked me" from "I asked them". */
  ownerAddresses: string[];
  now: string;
}

/**
 * Only explicit signals count. A message that merely *sounds* urgent produces nothing;
 * a message containing a direct question addressed to the owner produces a suggestion.
 */
export function detectFollowUps(input: FollowUpInput): FollowUpCandidate[] {
  const owners = input.ownerAddresses.map(normalise);
  const out: FollowUpCandidate[] = [];

  const push = (
    kind: FollowUpKind, summary: string, sourceId: string, sourceType: 'EMAIL' | 'CALENDAR',
    reason: string, confidence: number, dueAt: string | null,
    projectIds: string[], goalIds: string[], linkConfidence: LinkConfidence, evidenceReference: string,
  ) => {
    out.push({
      id: `followup-${randomUUID()}`, kind, summary: summary.slice(0, 300), sourceId, sourceType,
      reason, confidence: Math.max(0, Math.min(1, confidence)), dueAt,
      // Never carry an uncertain link into something that could become a task.
      projectIds: linkConfidence === 'CONFIRMED' ? projectIds : [],
      goalIds: linkConfidence === 'CONFIRMED' ? goalIds : [],
      linkConfidence, evidenceReference,
      status: 'SUGGESTION', createdAt: input.now,
    });
  };

  for (const email of input.emails) {
    const body = email.bodySummary || '';
    const fromOwner = owners.some(o => normalise(email.from).includes(o));
    const toOwner = email.to.concat(email.cc).some(addr => owners.some(o => normalise(addr).includes(o)));

    const deadline = explicitDeadline(`${email.subject}\n${body}`);
    if (deadline) {
      push('EXPLICIT_DEADLINE', `Deadline stated in "${email.subject}"`, email.messageId, 'EMAIL',
        `message states an explicit date (${deadline})`, 0.8, deadline,
        email.projectIds, email.goalIds, email.linkConfidence, email.evidenceReference);
    }

    if (!fromOwner && toOwner) {
      if (/\b(could|can|would|will)\s+you\b|\bplease\s+(send|share|confirm|review|reply|provide)\b/i.test(body)) {
        push('DIRECT_REQUEST', `Direct request in "${email.subject}"`, email.messageId, 'EMAIL',
          'sender addressed an explicit request to the owner', 0.75, deadline,
          email.projectIds, email.goalIds, email.linkConfidence, email.evidenceReference);
      } else if (/\?\s*$/m.test(body) && /\b(you|your)\b/i.test(body)) {
        push('UNANSWERED_QUESTION', `Open question in "${email.subject}"`, email.messageId, 'EMAIL',
          'message contains a direct question to the owner with no later reply in the retrieved set', 0.55, deadline,
          email.projectIds, email.goalIds, email.linkConfidence, email.evidenceReference);
      }
    }

    if (fromOwner && /\bI(?:'| wi)ll\b|\bI will\b|\bI'll\b/i.test(body)) {
      push('USER_COMMITMENT', `Commitment made in "${email.subject}"`, email.messageId, 'EMAIL',
        'owner stated an explicit commitment', 0.7, deadline,
        email.projectIds, email.goalIds, email.linkConfidence, email.evidenceReference);
    }

    if (/\bapprov(e|al)\b/i.test(`${email.subject} ${body}`) && !fromOwner) {
      push('UNRESOLVED_APPROVAL', `Approval referenced in "${email.subject}"`, email.messageId, 'EMAIL',
        'message references an approval addressed to the owner', 0.6, deadline,
        email.projectIds, email.goalIds, email.linkConfidence, email.evidenceReference);
    }
  }

  for (const event of input.events) {
    if (event.status === 'CANCELLED') continue;
    const needsPrep = /\bagenda\b|\bprepare\b|\bpre-?read\b|\bbring\b|\breview before\b/i
      .test(`${event.title} ${event.descriptionSummary}`);
    if (needsPrep) {
      push('MEETING_PREPARATION', `Preparation implied for "${event.title}"`, event.eventId, 'CALENDAR',
        'event text explicitly asks for preparation', 0.65, event.start.slice(0, 10),
        event.projectIds, event.goalIds, event.linkConfidence, event.evidenceReference);
    }
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}

export interface FocusWindowInput {
  busy: BusyInterval[];
  dayStart: string;
  dayEnd: string;
  minMinutes?: number;
}

/**
 * Purely arithmetic over free/busy. No calendar write, no travel-time guessing — a gap
 * is reported exactly as long as the data says it is.
 */
export function computeFocusWindows(input: FocusWindowInput): FocusWindow[] {
  const minMinutes = input.minMinutes ?? 45;
  const start = Date.parse(input.dayStart);
  const end = Date.parse(input.dayEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const intervals = input.busy
    .map(b => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter(b => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start);

  // Merge overlaps so back-to-back and double-booked meetings do not invent free time.
  const merged: Array<{ start: number; end: number }> = [];
  for (const slot of intervals) {
    const last = merged[merged.length - 1];
    if (last && slot.start <= last.end) last.end = Math.max(last.end, slot.end);
    else merged.push({ ...slot });
  }

  const windows: FocusWindow[] = [];
  let cursor = start;
  for (const slot of merged) {
    if (slot.start > cursor) addWindow(cursor, Math.min(slot.start, end));
    cursor = Math.max(cursor, slot.end);
    if (cursor >= end) break;
  }
  if (cursor < end) addWindow(cursor, end);
  return windows;

  function addWindow(from: number, to: number) {
    const minutes = Math.floor((to - from) / 60000);
    if (minutes < minMinutes) return;
    windows.push({
      start: new Date(from).toISOString(),
      end: new Date(to).toISOString(),
      minutes,
      reason: `${minutes} minutes with no busy calendar interval`,
      label: 'suggestion',
    });
  }
}
