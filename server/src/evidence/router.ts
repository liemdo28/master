import { Router } from 'express';
import { EvidenceService } from './service';
import type { EvidenceFilter } from './types';

const router = Router();

// This router has no POST/PUT/PATCH/DELETE route at all — the evidence contract is a
// read-through layer over existing stores (§6D.1-6D.2) and the Evidence/Audit surface
// is explicitly read-only (§6D.10: "Do not add mutation controls"). There is nothing
// here to mutate: no approve, no resolve, no dismiss, no remediate.

function withService<T>(fn: (service: EvidenceService) => T): T {
  const service = new EvidenceService();
  try { return fn(service); } finally { service.close(); }
}

function parseFilter(query: Record<string, unknown>): EvidenceFilter {
  const filter: EvidenceFilter = {};
  if (typeof query.category === 'string') filter.category = query.category as EvidenceFilter['category'];
  if (typeof query.sourceSystem === 'string') filter.sourceSystem = query.sourceSystem as EvidenceFilter['sourceSystem'];
  if (typeof query.projectId === 'string') filter.projectId = query.projectId;
  if (typeof query.subjectId === 'string') filter.subjectId = query.subjectId;
  if (typeof query.since === 'string') filter.since = query.since;
  if (typeof query.until === 'string') filter.until = query.until;
  // Every route in this file caps at OPERATOR_SAFE — an authenticated Command Center
  // caller never receives a SENSITIVE or SECRET_NEVER_RENDER record over this API,
  // regardless of what the caller asks for. There is no route that raises this ceiling.
  filter.redactionClassAtMost = 'OPERATOR_SAFE';
  return filter;
}

router.get('/evidence', (req, res) => withService(service => {
  res.json({ evidence: service.list(parseFilter(req.query as Record<string, unknown>)) });
}));

router.get('/evidence/conflicts', (_req, res) => withService(service => {
  res.json({ conflicts: service.conflicts() });
}));

router.get('/evidence/health', (_req, res) => withService(service => {
  res.json({ health: service.health() });
}));

router.get('/evidence/digest/:date', (req, res) => withService(service => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  res.json({ digest: service.digest(req.params.date) });
}));

router.get('/evidence/:id', (req, res) => withService(service => {
  const record = service.get(req.params.id);
  if (!record) { res.status(404).json({ error: 'evidence record not found' }); return; }
  if (record.redactionClass === 'SENSITIVE' || record.redactionClass === 'SECRET_NEVER_RENDER') {
    res.status(403).json({ error: 'this evidence record is not available over this API' });
    return;
  }
  res.json({ evidence: record });
}));

export const evidenceRouter = router;
