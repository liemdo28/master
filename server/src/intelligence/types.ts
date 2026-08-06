/**
 * Phase 5C — read-only Gmail and Calendar intelligence.
 *
 * Every type in this file describes data Mi *reads*. There is deliberately no
 * request shape anywhere in Phase 5C that can mutate a mailbox or a calendar.
 */

export type LinkConfidence = 'CONFIRMED' | 'UNCERTAIN' | 'NONE';
export type ContextSensitivity = 'PUBLIC' | 'INTERNAL' | 'PRIVATE' | 'SECRET_REDACTED';
export type EventStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
export type ConnectorStatus = 'READY' | 'NOT_CONFIGURED' | 'TOKEN_EXPIRED' | 'INSUFFICIENT_SCOPE' | 'UNAVAILABLE';

/**
 * The complete set of Google operations Phase 5C may perform. This interface is the
 * capability boundary: it names only reads, so no Phase 5C caller has a mutation
 * method to reach for in the first place. The existing write-capable adapters
 * (actions/gmail-action-adapter, actions/google-executor) are deliberately not
 * imported anywhere in this module.
 */
export interface GoogleReadCapabilities {
  gmailSearch(input: GmailSearchInput): Promise<EmailContext[]>;
  gmailListThreads(input: GmailSearchInput): Promise<Array<{ threadId: string; snippet: string }>>;
  gmailGetThread(threadId: string): Promise<EmailContext[]>;
  gmailGetMessage(messageId: string): Promise<EmailContext | null>;
  gmailListLabels(): Promise<string[]>;
  calendarListCalendars(): Promise<Array<{ calendarId: string; summary: string; timezone: string }>>;
  calendarListEvents(input: CalendarRangeInput): Promise<CalendarEventContext[]>;
  calendarGetEvent(calendarId: string, eventId: string): Promise<CalendarEventContext | null>;
  calendarFreeBusy(input: CalendarRangeInput): Promise<BusyInterval[]>;
  contactsLookup(email: string): Promise<{ email: string; displayName: string | null } | null>;
  status(): Promise<ConnectorStatus>;
}

/** Method names the capability layer must never expose. Asserted at runtime. */
export const FORBIDDEN_CAPABILITY_METHODS = [
  'send', 'gmailSend', 'sendMessage', 'draft', 'gmailDraft', 'createDraft', 'reply', 'forward',
  'archive', 'trash', 'delete', 'modify', 'modifyLabels', 'addLabel', 'removeLabel', 'markRead',
  'markUnread', 'batchModify', 'insert', 'import',
  'calendarCreate', 'createEvent', 'updateEvent', 'patchEvent', 'deleteEvent', 'moveEvent',
  'respond', 'rsvp', 'addAttendee', 'quickAdd', 'driveUpload', 'upload',
] as const;

export interface GmailSearchInput {
  query: string;
  maxResults?: number;
  labelIds?: string[];
  /** Only honoured when the caller explicitly opts in; bodies are summarised otherwise. */
  includeBody?: boolean;
}

export interface CalendarRangeInput {
  calendarIds?: string[];
  timeMin: string;
  timeMax: string;
  timezone?: string;
  maxResults?: number;
}

export interface BusyInterval {
  calendarId: string;
  start: string;
  end: string;
}

export interface AttachmentMetadata {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Phase 5C never downloads attachment content. */
  downloaded: false;
}

export interface CalendarEventContext {
  eventId: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  timezone: string;
  allDay: boolean;
  attendees: Array<{ email: string; displayName: string | null; responseStatus: string; organizer: boolean }>;
  organizer: string | null;
  location: string | null;
  descriptionSummary: string;
  status: EventStatus;
  recurrence: string[];
  recurringEventId: string | null;
  visibility: 'default' | 'public' | 'private';
  projectIds: string[];
  goalIds: string[];
  linkConfidence: LinkConfidence;
  sourceTimestamp: string;
  sensitivity: ContextSensitivity;
  evidenceReference: string;
}

export interface EmailContext {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: string;
  labels: string[];
  /** Sanitised, trimmed and bounded. Raw bodies are never persisted by default. */
  bodySummary: string;
  attachmentMetadata: AttachmentMetadata[];
  projectIds: string[];
  goalIds: string[];
  linkConfidence: LinkConfidence;
  actionCandidates: string[];
  sensitivity: ContextSensitivity;
  evidenceReference: string;
}

export type FollowUpKind =
  | 'DIRECT_REQUEST' | 'UNANSWERED_QUESTION' | 'USER_COMMITMENT'
  | 'EXPLICIT_DEADLINE' | 'MEETING_PREPARATION' | 'UNRESOLVED_APPROVAL';

export interface FollowUpCandidate {
  id: string;
  kind: FollowUpKind;
  summary: string;
  sourceId: string;
  sourceType: 'EMAIL' | 'CALENDAR';
  reason: string;
  confidence: number;
  dueAt: string | null;
  projectIds: string[];
  goalIds: string[];
  linkConfidence: LinkConfidence;
  evidenceReference: string;
  /** Phase 5C never creates a running task. */
  status: 'SUGGESTION' | 'WAITING_APPROVAL';
  createdAt: string;
}

export interface FocusWindow {
  start: string;
  end: string;
  minutes: number;
  reason: string;
  label: 'suggestion';
}

export interface DailyAgenda {
  id: string;
  date: string;
  timezone: string;
  meetings: CalendarEventContext[];
  deadlines: Array<{ summary: string; dueAt: string; sourceId: string }>;
  followUps: FollowUpCandidate[];
  activeGoals: Array<{ id: string; title: string; status: string }>;
  priorityTasks: Array<{ id: string; status: string; userRequest: string }>;
  availableFocusWindows: FocusWindow[];
  risks: string[];
  facts: string[];
  suggestions: string[];
  unknowns: string[];
  evidenceReferences: string[];
  generatedAt: string;
  version: number;
}

export interface WeeklyReview {
  id: string;
  weekStart: string;
  timezone: string;
  completedGoals: Array<{ id: string; title: string }>;
  completedTasks: Array<{ id: string; userRequest: string }>;
  missedCommitments: Array<{ summary: string; sourceId: string; dueAt: string | null }>;
  unresolvedFollowUps: FollowUpCandidate[];
  recurringIssues: Array<{ id: string; title: string }>;
  projectHealth: Array<{ projectId: string; mapStatus: string; note: string }>;
  meetingLoad: { meetingCount: number; totalMinutes: number; complete: boolean };
  focusTimeEstimate: { minutes: number; complete: boolean };
  lessons: Array<{ id: string; title: string }>;
  suggestedNextWeekPriorities: string[];
  facts: string[];
  unknowns: string[];
  evidenceReferences: string[];
  generatedAt: string;
  version: number;
}
