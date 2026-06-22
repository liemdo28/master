/**
 * Food Safety Gateway Connector
 * Reads submission records and inspection status from food-safety-gateway.
 * File-based (RecordStore uses JSON) — no separate service needed.
 */

import fs from 'fs';
import path from 'path';

const GATEWAY_ROOT = process.env.FOOD_SAFETY_ROOT ||
  'E:/Project/Master/food-safety-gateway';

const RECORD_FILE = path.join(GATEWAY_ROOT, 'data', 'records.json');
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';

export interface FoodSafetyRecord {
  id: string;
  store?: string;
  submitted_at?: string;
  status?: string;
  sync_status?: string;
  score?: number;
  issues?: string[];
}

export interface FoodSafetySnapshot {
  synced_at: string;
  total_records: number;
  pending_sync: number;
  recent_submissions: FoodSafetyRecord[];
  stores: string[];
  summary_text: string;
  status: 'ok' | 'no_data' | 'error';
}

export function syncFoodSafety(): FoodSafetySnapshot {
  const now = new Date().toISOString();

  try {
    // Try to read RecordStore JSON file
    let records: FoodSafetyRecord[] = [];

    // Check multiple possible paths
    const candidates = [
      RECORD_FILE,
      path.join(GATEWAY_ROOT, 'records.json'),
      path.join(GLOBAL_DIR, 'food-safety', 'records.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf-8');
        records = JSON.parse(raw);
        break;
      }
    }

    if (records.length === 0) {
      const snap: FoodSafetySnapshot = {
        synced_at: now,
        total_records: 0,
        pending_sync: 0,
        recent_submissions: [],
        stores: [],
        status: 'no_data',
        summary_text: '🍱 Food Safety Gateway: Chưa có dữ liệu kiểm tra. Pilot chưa bắt đầu.',
      };
      cacheSnapshot(snap);
      return snap;
    }

    const pending = records.filter(r => r.sync_status === 'PENDING').length;
    const stores = [...new Set(records.map(r => r.store || 'unknown').filter(Boolean))];
    const recent = [...records]
      .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
      .slice(0, 10);

    const passCount = records.filter(r => r.status === 'passed' || (r.score !== undefined && r.score >= 80)).length;
    const failCount = records.filter(r => r.status === 'failed' || (r.score !== undefined && r.score < 80)).length;

    const summaryLines = [
      `🍱 Food Safety Gateway`,
      `  Tổng kiểm tra: ${records.length}`,
      `  Đạt: ${passCount} | Không đạt: ${failCount}`,
      `  Chưa sync GSheet: ${pending}`,
      `  Stores: ${stores.join(', ') || 'N/A'}`,
    ];
    if (recent[0]?.submitted_at) {
      summaryLines.push(`  Gần nhất: ${new Date(recent[0].submitted_at).toLocaleDateString('vi-VN')}`);
    }

    const snap: FoodSafetySnapshot = {
      synced_at: now,
      total_records: records.length,
      pending_sync: pending,
      recent_submissions: recent,
      stores,
      status: 'ok',
      summary_text: summaryLines.join('\n'),
    };
    cacheSnapshot(snap);
    return snap;
  } catch (e) {
    const snap: FoodSafetySnapshot = {
      synced_at: now,
      total_records: 0,
      pending_sync: 0,
      recent_submissions: [],
      stores: [],
      status: 'error',
      summary_text: `🍱 Food Safety Gateway: Lỗi đọc dữ liệu — ${(e as Error).message}`,
    };
    return snap;
  }
}

function cacheSnapshot(snap: FoodSafetySnapshot) {
  const cacheDir = path.join(GLOBAL_DIR, 'visibility', 'food-safety');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'data.json'), JSON.stringify(snap, null, 2));
  fs.writeFileSync(path.join(cacheDir, 'last_sync.json'), JSON.stringify({ synced_at: snap.synced_at, status: snap.status }));
}

export function getCachedFoodSafety(): FoodSafetySnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(GLOBAL_DIR, 'visibility', 'food-safety', 'data.json'), 'utf-8'
    ));
  } catch { return null; }
}

export function getFoodSafetySummaryText(): string {
  const cached = getCachedFoodSafety();
  if (!cached) return '🍱 Food Safety: Chưa sync.';
  return cached.summary_text;
}
