/**
 * GmailAttachmentReader — finds and reads data file attachments from Gmail.
 * Searches email cache for attachments, downloads if Google is connected.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const GMAIL_CACHE = path.join(GLOBAL_DIR, 'visibility', 'gmail', 'data.json');
const ATTACHMENT_DIR = path.join(GLOBAL_DIR, 'data-analyst', 'gmail-attachments');

export function getGmailAttachmentList(query = '') {
  if (!fs.existsSync(GMAIL_CACHE)) {
    return {
      success: false,
      status: 'CONNECTOR_NOT_CONFIGURED',
      message: 'Gmail chưa được kết nối. Truy cập /api/auth/google/start.',
    };
  }

  try {
    const cache = JSON.parse(fs.readFileSync(GMAIL_CACHE, 'utf-8'));
    const emails = cache.emails || [];

    // Find emails with data attachments (based on subject/snippet)
    const dataKeywords = ['report', 'sales', 'revenue', 'doanh thu', 'báo cáo', 'daily', 'weekly', 'payroll'];
    const fileExtensions = ['.csv', '.xlsx', '.xls', '.pdf', '.docx'];

    const relevant = emails.filter(e => {
      const text = `${e.subject} ${e.snippet}`.toLowerCase();
      const hasKeyword = !query || text.includes(query.toLowerCase()) || dataKeywords.some(k => text.includes(k));
      return hasKeyword;
    });

    return {
      success: true,
      emails: relevant.slice(0, 10).map(e => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        date: e.date,
        snippet: e.snippet.slice(0, 100),
      })),
      total: relevant.length,
      note: 'To download attachment, use: downloadAttachment(emailId)',
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Download a Gmail attachment (requires Google API connection)
 */
export async function downloadAttachment(emailId, attachmentId) {
  return {
    success: false,
    status: 'NOT_IMPLEMENTED',
    message: 'Attachment download requires Google API call via server endpoint.',
    endpoint: `/api/data-analyst/gmail-attachment/${emailId}/${attachmentId}`,
  };
}
