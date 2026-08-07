/**
 * Phase 5D-1/5D-2 document + knowledge API.
 *
 * There is still no endpoint that can register a new approved root or ingest a whole
 * tree — roots come from the Project Registry and configured environment, never from a
 * request body. The Phase 5D-2 routes added below (search, knowledge-pack, conflicts,
 * relations) take a `KnowledgeQuery`-shaped body or a bounded `projectIds` array; none
 * accepts a raw SQL fragment, an arbitrary filter object, or an unscoped "dump
 * everything" request — `KnowledgeQuery` validation (see query-validation.ts) is the
 * only way into retrieval, and it refuses a query with no project scope.
 */

import express, { Router } from 'express';
import { assertPlainPayload } from '../store';
import { KnowledgeDocumentService, safeMessage, toPublicDocument } from './service';
import { PathPolicyError } from './path-policy';
import { DocumentParseError } from './types';
import { DocumentStore } from './store';
import { KnowledgeRetrievalService } from './retrieval';
import { scanForConflicts } from './conflicts';
import { scanForRelations } from './relations';
import { KnowledgeQueryValidationError } from './query-validation';

export const knowledgeDocumentsJsonParser = express.json({ limit: '1mb' });

const router = Router();
const DOC_ID = /^doc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONFLICT_ID = /^conflict-[0-9a-f-]{36}$/i;
const CONFLICT_STATUSES = new Set(['OPEN', 'NEEDS_CONFIRMATION', 'RESOLVED', 'DISMISSED']);

function boundedProjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 5).map(v => String(v).trim()).filter(Boolean))];
}

async function withStore<T>(fn: (store: DocumentStore) => T): Promise<T> {
  const store = new DocumentStore();
  try { return fn(store); } finally { store.close(); }
}

async function withService<T>(fn: (service: KnowledgeDocumentService) => Promise<T> | T): Promise<T> {
  const service = new KnowledgeDocumentService();
  try { return await fn(service); } finally { service.close(); }
}

function fail(res: express.Response, err: unknown): void {
  const message = safeMessage(err);
  let status = 400;
  let code: string | undefined;
  if (err instanceof PathPolicyError) {
    status = err.code === 'NOT_FOUND' ? 404 : err.code === 'NO_APPROVED_ROOTS' ? 409 : 400;
    code = err.code;
  } else if (err instanceof DocumentParseError) {
    status = err.code === 'FILE_TOO_LARGE' ? 413 : 400;
    code = err.code;
  } else if (err instanceof KnowledgeQueryValidationError) {
    status = 400;
    code = err.code;
  } else if (/not found/i.test(message)) {
    status = 404;
  }
  res.status(status).json(code ? { error: message, code } : { error: message });
}

function validId(id: string): boolean { return DOC_ID.test(id); }

router.get('/knowledge-documents', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const documents = await withService(s => s.store.listDocuments(status as never, Number(req.query.limit) || 100));
    res.json({ documents: documents.map(toPublicDocument) });
  } catch (err) { fail(res, err); }
});

router.get('/knowledge-documents/stale', async (_req, res) => {
  try {
    const result = await withService(s => {
      const refreshed = s.refreshStaleness();
      return { refreshed, stale: s.listStale().map(toPublicDocument) };
    });
    res.json(result);
  } catch (err) { fail(res, err); }
});

// Registered ahead of GET /knowledge-documents/:id (like /stale above) so the literal
// segment "conflicts" is never swallowed by the :id wildcard.
router.get('/knowledge-documents/conflicts', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' && CONFLICT_STATUSES.has(req.query.status) ? req.query.status : undefined;
    const conflicts = await withStore(store => store.listConflicts(status as never, Number(req.query.limit) || 100));
    return res.json({ conflicts });
  } catch (err) { return fail(res, err); }
});

router.get('/knowledge-documents/conflicts/:id', async (req, res) => {
  try {
    if (!CONFLICT_ID.test(req.params.id)) return res.status(400).json({ error: 'invalid conflict id' });
    const conflict = await withStore(store => store.getConflict(req.params.id));
    return conflict ? res.json(conflict) : res.status(404).json({ error: 'conflict not found' });
  } catch (err) { return fail(res, err); }
});

router.post('/knowledge-documents/discover', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const directory = typeof req.body?.directory === 'string' ? req.body.directory : '';
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : '';
    if (!directory && !projectId) return res.status(400).json({ error: 'directory or projectId is required' });
    const result = await withService(s => {
      const target = directory || s.approvedRoots().projectRoots[projectId];
      if (!target) throw new PathPolicyError('OUTSIDE_APPROVED_ROOTS', 'no approved root for that project');
      return s.discover(target, Number(req.body?.maxResults) || 200);
    });
    return res.json(result);
  } catch (err) { return fail(res, err); }
});

router.post('/knowledge-documents/ingest', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath : '';
    if (!filePath.trim()) return res.status(400).json({ error: 'filePath is required' });
    const outcome = await withService(s => s.ingestApprovedDocument({
      filePath,
      operationId: typeof req.body?.operationId === 'string' ? req.body.operationId : undefined,
      projectIds: Array.isArray(req.body?.projectIds) ? req.body.projectIds.slice(0, 10).map(String) : undefined,
      goalIds: Array.isArray(req.body?.goalIds) ? req.body.goalIds.slice(0, 10).map(String) : undefined,
      taskIds: Array.isArray(req.body?.taskIds) ? req.body.taskIds.slice(0, 20).map(String) : undefined,
      tags: Array.isArray(req.body?.tags) ? req.body.tags.slice(0, 20).map(String) : undefined,
    }));
    // A rejection is a deliberate policy outcome, not a server error.
    const status = outcome.status === 'REJECTED' ? 409 : outcome.status === 'FAILED' ? 400 : 201;
    return res.status(status).json(outcome);
  } catch (err) { return fail(res, err); }
});

router.get('/knowledge-documents/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid document id' });
    const document = await withService(s => s.store.getDocument(req.params.id));
    return document ? res.json(toPublicDocument(document)) : res.status(404).json({ error: 'document not found' });
  } catch (err) { return fail(res, err); }
});

router.get('/knowledge-documents/:id/chunks', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid document id' });
    const result = await withService(s => {
      if (!s.store.getDocument(req.params.id)) return null;
      return s.store.listChunks(req.params.id, Number(req.query.limit) || 500);
    });
    return result ? res.json({ chunks: result }) : res.status(404).json({ error: 'document not found' });
  } catch (err) { return fail(res, err); }
});

router.post('/knowledge-documents/:id/reindex', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid document id' });
    const outcome = await withService(s => s.reindex(req.params.id));
    const status = outcome.status === 'FAILED' ? (outcome.errorCode === 'NOT_FOUND' ? 404 : 400) : 200;
    return res.status(status).json(outcome);
  } catch (err) { return fail(res, err); }
});

router.delete('/knowledge-documents/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid document id' });
    const document = await withService(s => (s.store.getDocument(req.params.id) ? s.store.deleteDocument(req.params.id) : null));
    return document ? res.json(toPublicDocument(document)) : res.status(404).json({ error: 'document not found' });
  } catch (err) { return fail(res, err); }
});

// ── Phase 5D-2: search, knowledge-pack, conflicts, relations ──────────────────────────

router.post('/knowledge-documents/search', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const ranked = await withStore(store => new KnowledgeRetrievalService(store).search(req.body));
    return res.json({
      results: ranked.map(r => ({
        documentId: r.document.id, chunkId: r.chunk.id, title: r.document.title,
        sourceUri: r.document.sourceUri, headingPath: r.chunk.headingPath,
        excerpt: r.chunk.text.slice(0, 500), score: r.score, isStale: r.isStale,
      })),
    });
  } catch (err) { return fail(res, err); }
});

router.post('/knowledge-documents/knowledge-pack', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const pack = await withStore(store => new KnowledgeRetrievalService(store).buildKnowledgePack(req.body));
    return res.json(pack);
  } catch (err) { return fail(res, err); }
});

router.post('/knowledge-documents/conflicts/:id/resolve', async (req, res) => {
  try {
    if (!CONFLICT_ID.test(req.params.id)) return res.status(400).json({ error: 'invalid conflict id' });
    assertPlainPayload(req.body);
    const status = typeof req.body?.status === 'string' ? req.body.status : '';
    if (!CONFLICT_STATUSES.has(status) || status === 'OPEN') {
      return res.status(400).json({ error: 'status must be one of NEEDS_CONFIRMATION, RESOLVED, DISMISSED' });
    }
    const resolutionNote = typeof req.body?.resolutionNote === 'string' ? req.body.resolutionNote.slice(0, 1000) : undefined;
    const updated = await withStore(store => {
      if (!store.getConflict(req.params.id)) return null;
      return store.updateConflictStatus(req.params.id, status as never, resolutionNote);
    });
    return updated ? res.json(updated) : res.status(404).json({ error: 'conflict not found' });
  } catch (err) { return fail(res, err); }
});

router.post('/knowledge-documents/conflicts/scan', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const projectIds = boundedProjectIds(req.body?.projectIds);
    if (!projectIds.length) return res.status(400).json({ error: 'projectIds is required and must be a non-empty array (max 5)' });
    const result = await withStore(store => scanForConflicts(store, projectIds));
    return res.json(result);
  } catch (err) { return fail(res, err); }
});

router.post('/knowledge-documents/relations/scan', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const projectIds = boundedProjectIds(req.body?.projectIds);
    if (!projectIds.length) return res.status(400).json({ error: 'projectIds is required and must be a non-empty array (max 5)' });
    const result = await withStore(store => scanForRelations(store, projectIds));
    return res.json(result);
  } catch (err) { return fail(res, err); }
});

router.get('/knowledge-documents/:id/relations', async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid document id' });
    const result = await withStore(store => {
      if (!store.getDocument(req.params.id)) return null;
      return store.listRelationsForDocument(req.params.id, Number(req.query.limit) || 200);
    });
    return result ? res.json({ relations: result }) : res.status(404).json({ error: 'document not found' });
  } catch (err) { return fail(res, err); }
});

export const knowledgeDocumentsRouter = router;
