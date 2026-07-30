/**
 * Ingestion Service — orchestrates JSON and file ingestion end-to-end.
 * Coordinates: object-store → normalizer → memory-indexer → audit.
 */

import { pgQuery } from './db-client';
import { getSourceByName } from './source-registry';
import { storeRawObject } from './object-store';
import { autoNormalize } from './normalizer';
import { indexTextChunks } from './memory-indexer';
import { auditLog } from './audit-service';
import { redactObject } from './secret-redactor';
import path from 'path';

export interface IngestJsonResult {
  job_id: number;
  source_name: string;
  raw_object_id: number;
  events_created: number;
  chunks_indexed: number;
  redacted: boolean;
  warnings: string[];
}

export interface IngestFileResult {
  job_id: number;
  source_name: string;
  raw_object_id: number;
  chunks_indexed: number;
  redacted: boolean;
  warnings: string[];
}

async function startJob(source_id: number, job_type: string): Promise<number> {
  const rows = await pgQuery<{ id: number }>(
    `INSERT INTO ingestion_jobs (source_id, job_type, status, started_at) VALUES ($1,$2,'running',NOW()) RETURNING id`,
    [source_id, job_type]
  );
  return rows[0].id;
}

async function finishJob(job_id: number, records_ingested: number, records_failed: number, error?: string): Promise<void> {
  await pgQuery(
    `UPDATE ingestion_jobs SET status=$1, finished_at=NOW(), records_ingested=$2, records_failed=$3, error_message=$4 WHERE id=$5`,
    [error ? 'failed' : 'completed', records_ingested, records_failed, error || null, job_id]
  );
}

export async function ingestJson(params: {
  source_name: string;
  payload: Record<string, unknown>;
  filename?: string;
  actor?: string;
  index_memory?: boolean;
}): Promise<IngestJsonResult> {
  const { source_name, filename = `payload_${Date.now()}.json`, actor = 'api', index_memory = true } = params;
  const warnings: string[] = [];

  const source = await getSourceByName(source_name);
  if (!source) throw new Error(`Source "${source_name}" not registered`);

  const job_id = await startJob(source.id, 'manual');

  try {
    // Redact secrets from object
    const { clean, secrets } = redactObject(params.payload);
    if (secrets.length > 0) {
      warnings.push(`Redacted ${secrets.length} secret(s): ${secrets.join(', ')}`);
    }

    const body = JSON.stringify(clean, null, 2);
    const { object, redacted } = await storeRawObject({
      source_id: source.id,
      object_type: 'json',
      filename,
      body,
      content_type: 'application/json',
      metadata: { source_name, original_keys: Object.keys(params.payload) },
      actor,
    });

    const { count: events_created } = await autoNormalize(
      source.type,
      clean as Record<string, unknown>,
      source.id,
      object.id
    );

    let chunks_indexed = 0;
    if (index_memory) {
      const text = JSON.stringify(clean, null, 2);
      if (text.length > 50) {
        const { chunks_indexed: ci } = await indexTextChunks({
          text,
          title: `${source_name}/${filename}`,
          source_id: source.id,
          raw_object_id: object.id,
          chunk_type: source.type,
          store_id: (clean as Record<string, unknown>)['store'] as string,
          actor,
        });
        chunks_indexed = ci;
      }
    }

    await finishJob(job_id, events_created + chunks_indexed, 0);
    return { job_id, source_name, raw_object_id: object.id, events_created, chunks_indexed, redacted, warnings };
  } catch (e) {
    await finishJob(job_id, 0, 1, String(e));
    throw e;
  }
}

export async function ingestFile(params: {
  source_name: string;
  filename: string;
  buffer: Buffer;
  content_type: string;
  actor?: string;
  index_memory?: boolean;
}): Promise<IngestFileResult> {
  const { source_name, filename, buffer, content_type, actor = 'api', index_memory = true } = params;
  const warnings: string[] = [];

  const source = await getSourceByName(source_name);
  if (!source) throw new Error(`Source "${source_name}" not registered`);

  const job_id = await startJob(source.id, 'file_upload');

  try {
    const ext = path.extname(filename).toLowerCase();
    const object_type = ext === '.csv' ? 'csv' : ext === '.pdf' ? 'pdf' : content_type.startsWith('image/') ? 'image' : 'file';

    const { object, redacted } = await storeRawObject({
      source_id: source.id,
      object_type,
      filename,
      body: buffer,
      content_type,
      actor,
    });

    let chunks_indexed = 0;
    if (index_memory && (content_type.startsWith('text/') || ext === '.csv')) {
      const text = buffer.toString('utf-8');
      const { chunks_indexed: ci } = await indexTextChunks({
        text,
        title: filename,
        source_id: source.id,
        raw_object_id: object.id,
        chunk_type: object_type,
        actor,
      });
      chunks_indexed = ci;
    }

    await finishJob(job_id, chunks_indexed, 0);
    return { job_id, source_name, raw_object_id: object.id, chunks_indexed, redacted, warnings };
  } catch (e) {
    await finishJob(job_id, 0, 1, String(e));
    throw e;
  }
}

export async function getJobStatus(job_id: number): Promise<unknown> {
  const rows = await pgQuery(
    'SELECT j.*, s.name as source_name FROM ingestion_jobs j JOIN data_sources s ON s.id=j.source_id WHERE j.id=$1',
    [job_id]
  );
  return rows[0] || null;
}

export async function listJobs(limit = 50): Promise<unknown[]> {
  return pgQuery(
    'SELECT j.*, s.name as source_name FROM ingestion_jobs j JOIN data_sources s ON s.id=j.source_id ORDER BY j.created_at DESC LIMIT $1',
    [limit]
  );
}
