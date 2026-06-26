/**
 * Stub Connector — for not-yet-configured platforms (Asana, Gmail, Calendar, Drive, Health).
 * Returns a clear "not configured" status with setup instructions.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

export interface StubResult {
  connector_id: string;
  status: 'not_configured';
  message: string;
  setup_hint: string;
  cache_exists: boolean;
  cached_data?: unknown;
}

const STUBS: Record<string, { message: string; hint: string }> = {
  asana: {
    message: 'Asana chưa được kết nối.',
    hint: 'Thêm ASANA_TOKEN vào .env. Lấy token tại: app.asana.com → My Profile → Apps → Personal Access Tokens.',
  },
  gmail: {
    message: 'Gmail chưa được kết nối.',
    hint: 'Cần Google OAuth 2.0. Thêm GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN vào .env.',
  },
  'google-calendar': {
    message: 'Google Calendar chưa được kết nối.',
    hint: 'Dùng chung OAuth với Gmail. Cần thêm scope: https://www.googleapis.com/auth/calendar.readonly',
  },
  'google-drive': {
    message: 'Google Drive chưa được kết nối.',
    hint: 'Dùng chung OAuth với Gmail. Cần thêm scope: https://www.googleapis.com/auth/drive.readonly',
  },
  'health-export': {
    message: 'Huawei Health chưa được kết nối.',
    hint: 'Export file từ Huawei Health app → đặt vào .local-agent-global/visibility/health/export/. Hỗ trợ JSON hoặc XML.',
  },
};

export function getStubResult(connectorId: string): StubResult {
  const stub = STUBS[connectorId] || {
    message: `Connector "${connectorId}" chưa được cấu hình.`,
    hint: 'Kiểm tra connector-registry.json để xem hướng dẫn setup.',
  };

  // Check if there's cached data from a previous sync
  const cachePath = path.join(GLOBAL_DIR, 'visibility', connectorId.replace('-', '/'), 'data.json');
  let cachedData: unknown;
  try { cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8')); } catch { /* no cache */ }

  return {
    connector_id: connectorId,
    status: 'not_configured',
    message: stub.message,
    setup_hint: stub.hint,
    cache_exists: !!cachedData,
    cached_data: cachedData,
  };
}

export function readHealthExport(): unknown | null {
  const exportDir = path.join(GLOBAL_DIR, 'visibility', 'health', 'export');
  if (!fs.existsSync(exportDir)) return null;
  const files = fs.readdirSync(exportDir).filter(f => /\.(json|xml)$/i.test(f));
  if (!files.length) return null;
  try {
    const latest = files.sort().pop()!;
    const raw = fs.readFileSync(path.join(exportDir, latest), 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}
