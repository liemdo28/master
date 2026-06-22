/**
 * Object Store — save raw objects to MinIO and register metadata in PostgreSQL.
 */

import { pgQuery, pgQueryOne } from './db-client';
import { putObject, buildObjectKey, BUCKETS } from './minio-client';
import { redactSecrets, isBlockedFilename } from './secret-redactor';
import { auditLog } from './audit-service';

export interface RawObject {
  id: number;
  source_id: number;
  object_type: string;
  bucket: string;
  object_key: string;
  checksum: string;
  file_size: number;
  content_type: string;
  captured_at: string;
  metadata_json: Record<string, unknown>;
}

export async function storeRawObject(params: {
  source_id: number;
  object_type: string;
  filename: string;
  body: Buffer | string;
  content_type?: string;
  metadata?: Record<string, unknown>;
  actor?: string;
}): Promise<{ object: RawObject; redacted: boolean; blocked: boolean }> {
  const { source_id, object_type, filename, body, content_type = 'application/octet-stream', metadata = {}, actor = 'system' } = params;

  // Security: block sensitive filenames
  if (isBlockedFilename(filename)) {
    await auditLog({ actor, action: 'blocked_file', entity_type: 'raw_object', after_json: { filename, reason: 'blocked_filename' } });
    throw new Error(`File "${filename}" is blocked — contains sensitive credentials`);
  }

  // Security: redact text-based content
  let finalBody = body;
  let wasRedacted = false;
  if (typeof body === 'string' || content_type.startsWith('text/') || content_type === 'application/json') {
    const text = typeof body === 'string' ? body : body.toString('utf-8');
    const r = redactSecrets(text);
    if (!r.clean) {
      wasRedacted = true;
      console.warn(`[BigData:ObjectStore] Redacted secrets from ${filename}:`, r.found);
      await auditLog({ actor, action: 'secret_redacted', entity_type: 'raw_object', after_json: { filename, secrets_found: r.found } });
      finalBody = r.redacted;
    }
  }

  const bucket = BUCKETS.RAW;
  const key = buildObjectKey(source_id, object_type, filename);
  const { checksum, size } = await putObject(bucket, key, finalBody, content_type);

  // Check for duplicate by checksum
  const existing = await pgQueryOne<RawObject>(
    'SELECT * FROM raw_objects WHERE checksum = $1 AND source_id = $2',
    [checksum, source_id]
  );
  if (existing) {
    await auditLog({ actor, action: 'duplicate_skipped', entity_type: 'raw_object', entity_id: String(existing.id), after_json: { checksum, filename } });
    return { object: existing, redacted: wasRedacted, blocked: false };
  }

  const rows = await pgQuery<RawObject>(
    `INSERT INTO raw_objects (source_id, object_type, bucket, object_key, checksum, file_size, content_type, metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [source_id, object_type, bucket, key, checksum, size, content_type, JSON.stringify(metadata)]
  );

  await auditLog({ actor, action: 'ingest_object', entity_type: 'raw_object', entity_id: String(rows[0].id), after_json: { filename, object_type, size } });
  return { object: rows[0], redacted: wasRedacted, blocked: false };
}

export async function getRawObject(id: number): Promise<RawObject | null> {
  return pgQueryOne<RawObject>('SELECT * FROM raw_objects WHERE id = $1', [id]);
}

export async function listRawObjects(sourceId?: number, limit = 50): Promise<RawObject[]> {
  if (sourceId) {
    return pgQuery<RawObject>('SELECT * FROM raw_objects WHERE source_id=$1 ORDER BY captured_at DESC LIMIT $2', [sourceId, limit]);
  }
  return pgQuery<RawObject>('SELECT * FROM raw_objects ORDER BY captured_at DESC LIMIT $1', [limit]);
}
