/**
 * Dashboard normalizer — maps dashboard payload to normalized_events.
 */

import { NormalizedEvent, insertEvent } from '../../normalizer';

export async function normalizeDashboard(
  payload: Record<string, unknown>,
  source_id: number,
  raw_object_id: number
): Promise<number> {
  let count = 0;
  const store_id = (payload['store'] as string) || 'bakudan';

  for (const field of ['tasks', 'approvals', 'penalties', 'notifications']) {
    const items = payload[field];
    if (!Array.isArray(items)) continue;

    for (const item of items as Record<string, unknown>[]) {
      const event: NormalizedEvent = {
        source_id,
        store_id,
        raw_object_id,
        event_type: field.slice(0, -1), // 'task', 'approval', etc.
        event_time: (item['updated_at'] || item['created_at'] || new Date().toISOString()) as string,
        actor:       item['assignee'] as string || item['actor'] as string,
        title:       item['title'] as string || item['action'] as string || item['message'] as string,
        amount:      item['amount'] ? parseFloat(String(item['amount'])) : undefined,
        status:      item['status'] as string,
        metadata_json: item,
      };
      await insertEvent(event);
      count++;
    }
  }
  return count;
}
