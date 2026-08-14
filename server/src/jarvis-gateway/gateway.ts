/**
 * Phase 7C — JarvisGateway. The single orchestration entrypoint: classify →
 * resolve project → dispatch to the matching canonical subsystem. Owns none
 * of the logic it dispatches to — see
 * docs/architecture/PHASE7C_CANONICAL_JARVIS_GATEWAY.md.
 */
import { randomUUID } from 'crypto';
import { classifyRequest } from './intent-classifier';
import { resolveProject, type ProjectResolution } from './project-resolver';
import { projectRegistry } from './services';
import type { CallerIdentity, JarvisRequest, JarvisRequestInput, JarvisResponse, RequestType } from './types';
import { baseResponse } from './response';
import { handleSystemStatus } from './handlers/system-status';
import { handleKnowledgeSearch } from './handlers/knowledge-search';
import { handleTaskQuery } from './handlers/task-query';
import { handleProjectQuery } from './handlers/project-query';
import { handleGoalQuery } from './handlers/goal-query';
import { handleOperatorQuery } from './handlers/operator-query';
import { handlePlanning } from './handlers/planning';
import { handleSimulation } from './handlers/simulation';
import { handleActionProposal } from './handlers/action-proposal';
import { handleCoding } from './handlers/coding';
import { handleInformation } from './handlers/information';
import { recordRequest } from './request-store';
import { scrubReply } from '../middleware/response-scrubber';

// KNOWLEDGE_SEARCH is required too: KnowledgeRetrievalService's own query
// validator refuses to run without at least one projectId — "there is no
// query mode that searches all private knowledge" (personal-os/documents/
// query-validation.ts) — so the Gateway must resolve a project before
// calling it, never fall back to an unscoped search.
const PROJECT_REQUIRED_TYPES = new Set<RequestType>(['CODING', 'KNOWLEDGE_SEARCH']);
const MAX_TEXT_LENGTH = 4000;

// Every string field the Gateway can populate from provider/model output or
// an upstream error message (never structural fields like requestId/status/
// citations' documentId/sourceUri) goes through the same P0 secret scrubber
// every chat/WhatsApp reply already uses (middleware/response-scrubber.ts) —
// this file wasn't wired to it originally (independent review of PR #103).
function scrubResponse(response: JarvisResponse): JarvisResponse {
  response.answer = scrubReply(response.answer, 'jarvis');
  response.unknowns = response.unknowns.map(u => scrubReply(u, 'jarvis'));
  response.conflicts = response.conflicts.map(c => scrubReply(c, 'jarvis'));
  response.suggestedNextSteps = response.suggestedNextSteps.map(s => scrubReply(s, 'jarvis'));
  response.degradedCapabilities = response.degradedCapabilities.map(d => scrubReply(d, 'jarvis'));
  response.facts = response.facts.map(f => ({ ...f, statement: scrubReply(f.statement, 'jarvis') }));
  response.inferences = response.inferences.map(i => ({ ...i, statement: scrubReply(i.statement, 'jarvis') }));
  return response;
}

function clarificationResponse(requestId: string, intent: RequestType, resolution: ProjectResolution): JarvisResponse {
  const response = baseResponse(requestId, intent, null);
  response.status = 'NEEDS_CLARIFICATION';
  if (resolution.status === 'AMBIGUOUS') {
    response.answer = 'Multiple projects match — which one did you mean?';
    response.unknowns = resolution.candidateIds;
  } else {
    response.answer = 'Which project is this for?';
    response.unknowns = ['projectId'];
  }
  return response;
}

export async function handleGatewayRequest(input: JarvisRequestInput, caller: CallerIdentity): Promise<JarvisResponse> {
  const request: JarvisRequest = {
    ...input,
    text: input.text.slice(0, MAX_TEXT_LENGTH),
    requestId: randomUUID(),
    caller,
    receivedAt: new Date().toISOString(),
  };

  const classification = classifyRequest(request.text, request.requestType);
  const requiresProject = PROJECT_REQUIRED_TYPES.has(classification.type);
  const resolution = resolveProject(projectRegistry, request.projectId, request.text, requiresProject);

  let response: JarvisResponse;
  if (resolution.status === 'AMBIGUOUS' || (requiresProject && resolution.status === 'UNKNOWN')) {
    response = clarificationResponse(request.requestId, classification.type, resolution);
  } else {
    const projectId = resolution.status === 'RESOLVED' ? resolution.projectId : (request.projectId ?? null);
    response = await dispatch(classification.type, request, projectId);
  }

  scrubResponse(response);
  recordRequest(request, response);
  return response;
}

async function dispatch(type: RequestType, request: JarvisRequest, projectId: string | null): Promise<JarvisResponse> {
  switch (type) {
    case 'SYSTEM_STATUS': return handleSystemStatus(request.requestId);
    case 'KNOWLEDGE_SEARCH': return handleKnowledgeSearch(request.requestId, request.text, projectId);
    case 'TASK_QUERY': return handleTaskQuery(request.requestId, projectId);
    case 'PROJECT_QUERY': return handleProjectQuery(request.requestId, projectId);
    case 'GOAL_QUERY': return handleGoalQuery(request.requestId, projectId);
    case 'OPERATOR_QUERY': return handleOperatorQuery(request.requestId, projectId);
    case 'PLANNING': return handlePlanning(request.requestId, projectId);
    case 'SIMULATION': return handleSimulation(request.requestId, request.text, projectId);
    case 'ACTION_PROPOSAL': return handleActionProposal(request.requestId, request.text, projectId);
    case 'CODING': return handleCoding(request.requestId, request.text, projectId);
    case 'INFORMATION':
    default:
      return handleInformation(request.requestId, request.text, projectId);
  }
}
