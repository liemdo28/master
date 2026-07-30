/**
 * Normalizer — converts raw objects into normalized_events.
 * Each source type has a mapping function.
 */

import { pgQuery } from './db-client';
import { auditLog } from './audit-service';

export interface NormalizedEvent {
  id?: number;
  source_id: number;
  store_id?: string;
  event_type: string;
  event_time: string;
  actor?: string;
  title?: string;
  description?: string;
  amount?: number;
  status?: string;
  raw_object_id?: number;
  metadata_json?: Record<string, unknown>;
}

export async function insertEvent(event: NormalizedEvent): Promise<number> {
  const rows = await pgQuery<{ id: number }>(
    `INSERT INTO normalized_events
       (source_id, store_id, event_type, event_time, actor, title, description, amount, status, raw_object_id, metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      event.source_id,
      event.store_id || null,
      event.event_type,
      event.event_time,
      event.actor || null,
      event.title || null,
      event.description || null,
      event.amount ?? null,
      event.status || null,
      event.raw_object_id || null,
      JSON.stringify(event.metadata_json || {}),
    ]
  );
  return rows[0].id;
}

export async function normalizeDashboardPayload(
  payload: Record<string, unknown>,
  source_id: number,
  raw_object_id: number
): Promise<number[]> {
  const events: NormalizedEvent[] = [];
  const store_id = (payload['store'] as string) || 'bakudan';

  if (payload['tasks'] && Array.isArray(payload['tasks'])) {
    for (const t of payload['tasks'] as Record<string, unknown>[]) {
      events.push({
        source_id, store_id, raw_object_id,
        event_type: 'task',
        event_time: (t['updated_at'] as string) || new Date().toISOString(),
        actor:       t['assignee'] as string,
        title:       t['title'] as string,
        status:      t['status'] as string,
        metadata_json: t,
      });
    }
  }
  if (payload['approvals'] && Array.isArray(payload['approvals'])) {
    for (const a of payload['approvals'] as Record<string, unknown>[]) {
      events.push({
        source_id, store_id, raw_object_id,
        event_type: 'approval',
        event_time: (a['created_at'] as string) || new Date().toISOString(),
        actor:       a['actor'] as string,
        title:       a['action'] as string,
        status:      a['status'] as string,
        metadata_json: a,
      });
    }
  }

  const ids = await Promise.all(events.map(insertEvent));
  return ids;
}

export async function normalizeQuickBooksPayload(
  payload: Record<string, unknown>,
  source_id: number,
  raw_object_id: number
): Promise<number[]> {
  const events: NormalizedEvent[] = [];
  const store_id = (payload['store'] as string) || 'bakudan';

  if (payload['transactions'] && Array.isArray(payload['transactions'])) {
    for (const tx of payload['transactions'] as Record<string, unknown>[]) {
      events.push({
        source_id, store_id, raw_object_id,
        event_type: (tx['type'] as string) === 'refund' ? 'refund' : 'sale',
        event_time: (tx['date'] as string) || new Date().toISOString(),
        actor:       tx['customer'] as string,
        title:       `${tx['type']} — ${tx['description'] || ''}`,
        amount:      parseFloat(String(tx['amount'] || 0)),
        status:      tx['status'] as string,
        metadata_json: tx,
      });
    }
  }

  return Promise.all(events.map(insertEvent));
}

export async function normalizeReviewPayload(
  payload: Record<string, unknown>,
  source_id: number,
  raw_object_id: number
): Promise<number[]> {
  const events: NormalizedEvent[] = [];
  const store_id = (payload['store'] as string);

  events.push({
    source_id, store_id, raw_object_id,
    event_type: 'review',
    event_time: (payload['published_at'] as string) || new Date().toISOString(),
    actor:       payload['author'] as string,
    title:       `${payload['platform']} review — ${payload['rating']}★`,
    description: payload['text'] as string,
    status:      (payload['reply_status'] as string) || 'pending',
    metadata_json: payload,
  });

  return Promise.all(events.map(insertEvent));
}

type NormalizerFn = (payload: Record<string, unknown>, source_id: number, raw_object_id: number) => Promise<number[]>;

const NORMALIZERS: Record<string, NormalizerFn> = {
  dashboard:  normalizeDashboardPayload,
  quickbooks: normalizeQuickBooksPayload,
  review:     normalizeReviewPayload,
};

export async function autoNormalize(
  sourceType: string,
  payload: Record<string, unknown>,
  source_id: number,
  raw_object_id: number
): Promise<{ count: number; event_ids: number[] }> {
  const fn = NORMALIZERS[sourceType];
  if (!fn) return { count: 0, event_ids: [] };
  const ids = await fn(payload, source_id, raw_object_id);
  await auditLog({ actor: 'system', action: 'normalize', entity_type: 'normalized_event', after_json: { source_type: sourceType, count: ids.length } });
  return { count: ids.length, event_ids: ids };
}
