/**
 * Phase 5D-1 CLI. Every subcommand acts on one explicitly named target — there is no
 * ingest-all, full-rebuild, watch-all or search command in this batch.
 */

import { KnowledgeDocumentService, toPublicDocument } from './service';

export async function runDocumentsCli(args: string[]): Promise<unknown> {
  const service = new KnowledgeDocumentService();
  try {
    const sub = args[0];

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

    return { usage: 'docs discover <projectId> | ingest <approved-path> | list | show <id> | reindex <id> | stale | status' };
  } finally {
    service.close();
  }
}
