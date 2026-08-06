/**
 * Phase 5D-1 foundation API.
 *
 * Foundation only: there is no search or KnowledgePack route in this batch, and no
 * endpoint that can register a new approved root or ingest a whole tree. Roots come
 * from the Project Registry and configured environment, never from a request body.
 */

import express, { Router } from 'express';
import { assertPlainPayload } from '../store';
import { KnowledgeDocumentService, safeMessage, toPublicDocument } from './service';
import { PathPolicyError } from './path-policy';
import { DocumentParseError } from './types';

export const knowledgeDocumentsJsonParser = express.json({ limit: '1mb' });

const router = Router();
const DOC_ID = /^doc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function withService<T>(fn: (service: KnowledgeDocumentService) => Promise<T> | T): Promise<T> {
  const service = new KnowledgeDocumentService();
  try { return await fn(service); } finally { service.close(); }
}

function fail(res: express.Response, err: unknown): void {
  const message = safeMessage(err);
  let status = 400;
  if (err instanceof PathPolicyError) {
    status = err.code === 'NOT_FOUND' ? 404 : err.code === 'NO_APPROVED_ROOTS' ? 409 : 400;
  } else if (err instanceof DocumentParseError) {
    status = err.code === 'FILE_TOO_LARGE' ? 413 : 400;
  } else if (/not found/i.test(message)) {
    status = 404;
  }
  res.status(status).json({ error: message });
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

export const knowledgeDocumentsRouter = router;
