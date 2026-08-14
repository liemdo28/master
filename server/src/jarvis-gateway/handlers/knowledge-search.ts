/**
 * KNOWLEDGE_SEARCH — directive §9, §10, §11. The ONLY code path allowed to
 * assemble a KnowledgePack is KnowledgeRetrievalService.buildKnowledgePack()
 * (personal-os/documents/retrieval.ts's own doc comment) — this handler
 * calls it directly and never falls back to any of the legacy retrieval
 * implementations catalogued in PHASE7C_COMPONENT_AUDIT.md §7.
 */
import { knowledgeRetrieval } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export function handleKnowledgeSearch(requestId: string, text: string, projectId: string | null): JarvisResponse {
  const response = baseResponse(requestId, 'KNOWLEDGE_SEARCH', projectId);

  // Defense in depth: gateway.ts requires project resolution before
  // dispatching here (KNOWLEDGE_SEARCH is in PROJECT_REQUIRED_TYPES), but
  // this handler stays safe on its own too rather than trusting the caller.
  if (!projectId) {
    response.status = 'NEEDS_CLARIFICATION';
    response.answer = 'Which project should I search knowledge for?';
    response.unknowns = ['projectId'];
    return response;
  }

  const pack = knowledgeRetrieval.buildKnowledgePack({
    text,
    projectIds: [projectId],
  });

  if (pack.unknown || pack.items.length === 0) {
    response.status = 'NO_SUPPORTED_ANSWER';
    response.answer = pack.unknownReason === 'STALE_ONLY'
      ? 'The only matching knowledge is stale — Em không dùng thông tin cũ để trả lời chắc chắn.'
      : pack.unknownReason === 'PROJECT_NOT_INDEXED'
        ? 'This project has no indexed knowledge yet.'
        : 'No supported answer found in the knowledge base for this query.';
    response.unknowns.push(response.answer);
    return response;
  }

  const facts = pack.items.filter(i => i.factType === 'FACT');
  const inferences = pack.items.filter(i => i.factType === 'SYNTHESIS');
  response.facts = facts.map(i => ({ kind: 'FACT' as const, statement: i.statement, citationIds: i.citations.map(c => c.chunkId) }));
  response.inferences = inferences.map(i => ({ kind: 'INFERENCE' as const, statement: i.statement, citationIds: i.citations.map(c => c.chunkId) }));
  response.citations = pack.items.flatMap(i => i.citations.map(c => ({
    documentId: c.documentId, chunkId: c.chunkId, sourceUri: c.sourceUri, title: c.title,
    headingPath: c.headingPath, lineStart: c.lineStart, lineEnd: c.lineEnd,
  })));
  response.conflicts = pack.conflicts.length > 0 ? pack.conflicts.map(String) : [];
  response.answer = pack.items.map(i => i.statement).join('\n');
  response.status = pack.conflicts.length > 0 ? 'CONFLICT' : 'ANSWERED';
  return response;
}
