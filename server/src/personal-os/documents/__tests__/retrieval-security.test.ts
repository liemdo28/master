/**
 * Phase 5D-2 §16 — retrieval security.
 *
 * The one invariant under test here: there is no way to phrase a KnowledgeQuery that
 * searches everything, escapes its project scope, or reaches raw SQL.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import { KnowledgeRetrievalService } from '../retrieval';
import { KnowledgeQueryValidationError, validateKnowledgeQuery } from '../query-validation';
import { KNOWLEDGE_PACK_LIMITS } from '../types';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d2-retrieval-sec-'));
}

function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function expectRejected(input: unknown, code: string, message: string): void {
  try {
    validateKnowledgeQuery(input);
    assert.fail(`expected rejection (${code}) for ${message}`);
  } catch (err) {
    assert.ok(err instanceof KnowledgeQueryValidationError, `${message}: expected KnowledgeQueryValidationError`);
    assert.strictEqual((err as KnowledgeQueryValidationError).code, code, message);
  }
}

async function run() {
  // --- there is no "search everything" shape -----------------------------------
  expectRejected({ text: 'anything' }, 'PROJECT_SCOPE_REQUIRED', 'missing projectIds');
  expectRejected({ text: 'anything', projectIds: [] }, 'PROJECT_SCOPE_REQUIRED', 'empty projectIds');
  expectRejected({ text: 'anything', projectIds: null }, 'PROJECT_SCOPE_REQUIRED', 'null projectIds');
  expectRejected({ text: 'anything', projectIds: '*' }, 'INVALID_FIELD', 'projectIds as a wildcard string, not an array');
  expectRejected(
    { text: 'anything', projectIds: ['a', 'b', 'c', 'd', 'e', 'f'] },
    'TOO_MANY_IDS', 'more than 5 projectIds',
  );
  expectRejected({ text: '', projectIds: ['proj'] }, 'TEXT_TOO_SHORT', 'empty text');
  expectRejected({ text: 'x'.repeat(501), projectIds: ['proj'] }, 'TEXT_TOO_LONG', 'text over 500 chars');
  expectRejected({ text: 'valid text', projectIds: ['proj'], limit: 0 }, 'LIMIT_OUT_OF_RANGE', 'limit below range');
  expectRejected({ text: 'valid text', projectIds: ['proj'], limit: 21 }, 'LIMIT_OUT_OF_RANGE', 'limit above range');
  expectRejected({ text: 'valid text', projectIds: ['proj'], limit: 'all' }, 'INVALID_LIMIT', 'non-numeric limit');
  expectRejected('not an object', 'INVALID_QUERY', 'non-object query');
  expectRejected(['array', 'not', 'object'], 'INVALID_QUERY', 'array instead of object');

  // A bare "*" or SQL-ish projectId is not a valid identifier — it must not reach the store.
  expectRejected({ text: 'valid text', projectIds: ['*'] }, 'INVALID_PROJECT_ID', 'wildcard projectId');
  expectRejected({ text: 'valid text', projectIds: ["'; DROP TABLE knowledge_documents; --"] }, 'INVALID_PROJECT_ID', 'SQL-shaped projectId');

  // A valid query normalises defaults and passes through untouched otherwise.
  const validated = validateKnowledgeQuery({ text: '  what port  ', projectIds: ['proj-alpha', 'proj-alpha', ' proj-beta '] });
  assert.strictEqual(validated.text, 'what port');
  assert.deepStrictEqual(validated.projectIds, ['proj-alpha', 'proj-beta'], 'projectIds are trimmed and deduplicated');
  assert.strictEqual(validated.limit, 8, 'default limit applies');
  assert.strictEqual(validated.includeStale, false, 'default includeStale is false');

  // --- project isolation end-to-end, against a live store ----------------------
  const root = tmp();
  const dbDir = tmp();
  const service = new KnowledgeDocumentService({ store: new DocumentStore(dbDir), roots: { documentRoots: [root] } });

  const secretPath = write(root, 'secret/secret-architecture.md',
    '# Architecture\n\nThe secret project uses a hidden API token stored in vault-key-9182 for internal service calls.\n');
  const publicPath = write(root, 'public/public-architecture.md',
    '# Architecture\n\nThe public project uses a hidden API token stored in vault-key-0000 for internal service calls.\n');
  await service.ingestApprovedDocument({ filePath: secretPath, projectIds: ['proj-secret'] });
  await service.ingestApprovedDocument({ filePath: publicPath, projectIds: ['proj-public'] });

  const retrieval = new KnowledgeRetrievalService(service.store);

  // Scoping to proj-public must never surface proj-secret's chunk, even though both
  // documents structurally match the same query terms almost word-for-word.
  const publicOnly = retrieval.buildKnowledgePack({ text: 'hidden api token internal service calls', projectIds: ['proj-public'] });
  const serialisedPublic = JSON.stringify(publicOnly);
  assert.ok(!serialisedPublic.includes('vault-key-9182'), 'proj-secret content must never leak into a proj-public query');
  assert.ok(serialisedPublic.includes('vault-key-0000') || publicOnly.unknown, 'the in-scope project result, if any, is the right one');
  for (const item of publicOnly.items) {
    for (const citation of item.citations) {
      assert.deepStrictEqual(citation.projectIds, ['proj-public'], 'every citation stays inside the requested project scope');
    }
  }

  // Querying with an unrelated third project scope returns nothing from either document.
  const thirdParty = retrieval.buildKnowledgePack({ text: 'hidden api token', projectIds: ['proj-unrelated'] });
  assert.strictEqual(thirdParty.unknown, true, 'a project with no ingested documents returns UNKNOWN, not someone else\'s content');

  // --- FTS5 special characters in query text never escape into a broken query --------
  const weirdQueries = ['"; DROP TABLE knowledge_chunks; --', '****', 'NEAR("a" "b")', '', 'a'.repeat(400) + ' "unterminated'];
  for (const text of weirdQueries) {
    const pack = retrieval.buildKnowledgePack({ text: text.trim() || 'placeholder query text', projectIds: ['proj-public'] });
    assert.ok(pack, `query "${text.slice(0, 30)}..." must not throw or crash the retrieval layer`);
  }

  // --- KnowledgePack payload is bounded ------------------------------------------
  for (let i = 0; i < 25; i++) {
    write(root, `bulk/doc-${i}.md`, `# Bulk Document ${i}\n\nThis is bulk fixture content about widgets, gateways, and configuration for entry number ${i}, padded with enough distinct prose that each chunk clears the minimum chunk size on its own.\n`);
  }
  for (let i = 0; i < 25; i++) {
    await service.ingestApprovedDocument({ filePath: path.join(root, 'bulk', `doc-${i}.md`), projectIds: ['proj-public'] });
  }
  const bulkPack = retrieval.buildKnowledgePack({ text: 'widgets gateways configuration entry', projectIds: ['proj-public'], limit: 20 });
  const bulkBytes = Buffer.byteLength(JSON.stringify(bulkPack));
  assert.ok(bulkBytes <= KNOWLEDGE_PACK_LIMITS.maxPackBytes, `KnowledgePack (${bulkBytes} bytes) must stay within the ${KNOWLEDGE_PACK_LIMITS.maxPackBytes}-byte budget even at max limit with many candidates`);
  assert.ok(bulkPack.items.length <= 20, 'item count never exceeds the requested limit');
  for (const item of bulkPack.items) {
    assert.ok(item.statement.length <= KNOWLEDGE_PACK_LIMITS.maxStatementChars + 1, 'every excerpt stays within maxStatementChars');
  }

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });

  console.log('[retrieval-security] PASS');
}

run().catch(err => { console.error('[retrieval-security] FAIL:', err); process.exit(1); });
