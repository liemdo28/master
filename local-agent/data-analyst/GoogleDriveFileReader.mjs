/**
 * GoogleDriveFileReader — finds and reads data files from Google Drive cache.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const DRIVE_CACHE = path.join(GLOBAL_DIR, 'visibility', 'google-drive', 'data.json');

export function searchDriveDataFiles(query = '') {
  if (!fs.existsSync(DRIVE_CACHE)) {
    return {
      success: false,
      status: 'CONNECTOR_NOT_CONFIGURED',
      message: 'Google Drive chưa được kết nối. Truy cập /api/auth/google/start.',
    };
  }

  try {
    const cache = JSON.parse(fs.readFileSync(DRIVE_CACHE, 'utf-8'));
    const files = cache.recent_files || [];

    const dataExtensions = ['csv', 'xlsx', 'xls', 'pdf', 'docx', 'json'];
    const dataFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      const isDataFile = dataExtensions.includes(ext) ||
        f.mime_type.includes('spreadsheet') ||
        f.mime_type.includes('csv');
      const matchesQuery = !query || f.name.toLowerCase().includes(query.toLowerCase());
      return isDataFile && matchesQuery;
    });

    return {
      success: true,
      files: dataFiles.slice(0, 10),
      total: dataFiles.length,
      note: 'To download and analyze, use: downloadDriveFile(fileId)',
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function downloadDriveFile(fileId) {
  return {
    success: false,
    status: 'NOT_IMPLEMENTED',
    message: 'Drive file download requires Google API call via server endpoint.',
    endpoint: `/api/data-analyst/drive-file/${fileId}`,
  };
}
