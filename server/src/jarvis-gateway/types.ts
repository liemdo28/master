/**
 * Phase 7C — canonical Jarvis Gateway contract. This is the ONE typed
 * request/response shape for "when a user asks Jarvis something, what exact
 * canonical path handles it?" — see docs/architecture/PHASE7C_CANONICAL_JARVIS_GATEWAY.md.
 *
 * The Gateway orchestrates existing canonical subsystems; it owns none of
 * their logic. See docs/architecture/PHASE7C_COMPONENT_AUDIT.md for the
 * full canonical-owner map and the legacy systems this deliberately never
 * calls.
 */

/** Deterministic top-level request classes (directive §4). Never named to
 *  imply authority the system doesn't have. */
export type RequestType =
  | 'INFORMATION'
  | 'KNOWLEDGE_SEARCH'
  | 'TASK_QUERY'
  | 'PROJECT_QUERY'
  | 'GOAL_QUERY'
  | 'PLANNING'
  | 'SIMULATION'
  | 'ACTION_PROPOSAL'
  | 'CODING'
  | 'SYSTEM_STATUS'
  | 'OPERATOR_QUERY';

/** §26 — never EXECUTED unless reporting actual canonical execution evidence. */
export type ResponseStatus =
  | 'ANSWERED'
  | 'NEEDS_CLARIFICATION'
  | 'NO_SUPPORTED_ANSWER'
  | 'CONFLICT'
  | 'DEGRADED'
  | 'SIMULATED'
  | 'PROPOSAL_READY'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'FAILED';

/** §11 — truth semantics, Phase 6D contract. Jarvis must not convert UNKNOWN
 *  into FACT; conflicting canonical sources must remain visible. */
export interface TruthStatement {
  kind: 'FACT' | 'INFERENCE' | 'ASSUMPTION';
  statement: string;
  citationIds?: string[];
}

export interface CitationRef {
  documentId: string;
  chunkId: string;
  sourceUri: string;
  title: string;
  headingPath?: string[];
  lineStart?: number | null;
  lineEnd?: number | null;
}

/** Auth identity resolved by whichever mount (requireRemoteAuth session or
 *  requireTaskRuntimeAuth API key) the request arrived through — §6, no new
 *  token/session system. */
export interface CallerIdentity {
  source: 'remote_session' | 'api_key';
  deviceId?: string;
}

export interface JarvisRequestInput {
  text: string;
  /** §7 — explicit project scope when the caller already knows it. */
  projectId?: string | null;
  /** Force a request type instead of running the deterministic classifier —
   *  used by the Command Center's structured UI actions (e.g. a "Simulate
   *  this plan" button), never inferred from free text for security-sensitive
   *  classes without going through the classifier's own rules. */
  requestType?: RequestType;
  /** Phase 7D — opt-in session continuity (see session-resolver.ts). Only
   *  meaningful for `api_key` callers, who have no stable identity of their
   *  own; `remote_session` callers get session continuity automatically via
   *  their persisted device_id and never need to pass this. */
  sessionId?: string;
}

export interface JarvisRequest extends JarvisRequestInput {
  requestId: string;
  caller: CallerIdentity;
  receivedAt: string;
}

/** §25 — typed response. Not every field is required. */
export interface JarvisResponse {
  requestId: string;
  intent: RequestType;
  projectId: string | null;
  /** Phase 7D — the session this request was recorded under, or null if no
   *  resolvable session identity existed for this caller/request (sessions
   *  are opt-in — see session-resolver.ts). */
  sessionId: string | null;
  status: ResponseStatus;
  answer: string;
  facts: TruthStatement[];
  inferences: TruthStatement[];
  unknowns: string[];
  conflicts: string[];
  citations: CitationRef[];
  suggestedNextSteps: string[];
  simulation?: { simulationId: string; overallOutcome: string };
  proposal?: { proposalId: string; actionType: string; riskClass: string };
  approvalRequirement?: string | null;
  healthImpact?: { overall: string; degradedDependencies: string[] };
  evidenceRefs: string[];
  degradedCapabilities: string[];
  generatedAt: string;
}

export interface HandlerContext {
  request: JarvisRequest;
  projectId: string | null;
  projectResolutionStatus: 'RESOLVED' | 'AMBIGUOUS' | 'UNKNOWN' | 'NOT_APPLICABLE';
}
