/**
 * Phase 5D-1/5D-2 CLI. Every subcommand acts on one explicitly named target, or on an
 * explicitly named, bounded set of projectIds — there is no ingest-all, full-rebuild, or
 * "search everything" command.
 */

import { KnowledgeDocumentService, toPublicDocument } from './service';
import { KnowledgeRetrievalService } from './retrieval';
import { scanForConflicts } from './conflicts';
import { scanForRelations } from './relations';

const CONFLICT_STATUSES = new Set(['NEEDS_CONFIRMATION', 'RESOLVED', 'DISMISSED']);

export async function runDocumentsCli(args: string[]): Promise<unknown> {
  const service = new KnowledgeDocumentService();
  try {
    const sub = args[0];

    if (sub === 'search') {
      const projectId = args[1];
      const text = args.slice(2).join(' ');
      if (!projectId || !text) return { usage: 'docs search <projectId> <query text>' };
      const retrieval = new KnowledgeRetrievalService(service.store);
      const ranked = retrieval.search({ text, projectIds: [projectId] });
      return {
        results: ranked.map(r => ({
          documentId: r.document.id, chunkId: r.chunk.id, title: r.document.title,
          heading: r.chunk.headingPath, excerpt: r.chunk.text.slice(0, 300), score: r.score, isStale: r.isStale,
        })),
      };
    }

    if (sub === 'pack') {
      const projectId = args[1];
      const text = args.slice(2).join(' ');
      if (!projectId || !text) return { usage: 'docs pack <projectId> <query text>' };
      const retrieval = new KnowledgeRetrievalService(service.store);
      return retrieval.buildKnowledgePack({ text, projectIds: [projectId] });
    }

    if (sub === 'conflicts') {
      const status = args[1] && CONFLICT_STATUSES.has(args[1]) ? args[1] : (args[1] === 'OPEN' ? 'OPEN' : undefined);
      return { conflicts: service.store.listConflicts(status as never, 100) };
    }

    if (sub === 'resolve-conflict') {
      const id = args[1];
      const status = args[2];
      const note = args.slice(3).join(' ') || undefined;
      if (!id || !status || !CONFLICT_STATUSES.has(status)) {
        return { usage: 'docs resolve-conflict <id> <NEEDS_CONFIRMATION|RESOLVED|DISMISSED> [note]' };
      }
      if (!service.store.getConflict(id)) return { error: 'conflict not found' };
      return service.store.updateConflictStatus(id, status as never, note);
    }

    if (sub === 'scan-conflicts') {
      const projectIds = args.slice(1);
      if (!projectIds.length) return { usage: 'docs scan-conflicts <projectId> [projectId...]' };
      return scanForConflicts(service.store, projectIds);
    }

    if (sub === 'scan-relations') {
      const projectIds = args.slice(1);
      if (!projectIds.length) return { usage: 'docs scan-relations <projectId> [projectId...]' };
      return scanForRelations(service.store, projectIds);
    }

    if (sub === 'relations') {
      const documentId = args[1];
      if (!documentId) return { usage: 'docs relations <documentId>' };
      if (!service.store.getDocument(documentId)) return { error: 'document not found' };
      return { relations: service.store.listRelationsForDocument(documentId) };
    }

    if (sub === 'discover') {
      const projectId = args[1];
      if (!projectId) return { usage: 'docs discover <projectId>' };
      const roots = service.approvedRoots();
      const root = roots.projectRoots[projectId];
      if (!root) return { error: 'no approved root for that project', knownProjects: Object.keys(roots.projectRoots) };
      return service.discover(root);
    }

    if (sub === 'ingest') {
      const target = args.slice(1).join(' ');
      if (!target) return { usage: 'docs ingest <approved-path>' };
      return await service.ingestApprovedDocument({ filePath: target });
    }

    if (sub === 'list') {
      return { documents: service.store.listDocuments(undefined, 100).map(toPublicDocument) };
    }

    if (sub === 'show') {
      const id = args[1];
      if (!id) return { usage: 'docs show <id>' };
      const document = service.store.getDocument(id);
      if (!document) return { error: 'document not found' };
      return { document: toPublicDocument(document), chunks: service.store.countChunks(id) };
    }

    if (sub === 'reindex') {
      const id = args[1];
      if (!id) return { usage: 'docs reindex <id>' };
      return await service.reindex(id);
    }

    if (sub === 'stale') {
      const refreshed = service.refreshStaleness();
      return { refreshed, stale: service.listStale().map(toPublicDocument) };
    }

    if (sub === 'status') {
      return { ...service.store.stats(), integrity: service.store.integrity() };
    }

    return {
      usage: 'docs discover <projectId> | ingest <approved-path> | list | show <id> | reindex <id> | stale | status | '
        + 'search <projectId> <text> | pack <projectId> <text> | conflicts [status] | resolve-conflict <id> <status> [note] | '
        + 'scan-conflicts <projectId...> | scan-relations <projectId...> | relations <documentId>',
    };
  } finally {
    service.close();
  }
}
