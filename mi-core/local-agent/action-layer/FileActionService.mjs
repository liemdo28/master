/**
 * FileActionService.mjs
 * File search, preview, zip, copy, upload preparation.
 * Blocks sensitive files (security rule).
 */

import fs from 'fs';
import path from 'path';
import { localFileConnector } from '../universal-visibility/LocalFileVisibilityConnector.mjs';
import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';
import { auditLog } from './ActionAuditLog.mjs';

export class FileActionService {
  /**
   * Find a file — auto-allowed (read only)
   */
  static findFile(query, opts = {}) {
    const result = localFileConnector.searchFiles(query, opts);
    auditLog.log({ event: 'file_search', query, results: result.count });
    return result;
  }

  /**
   * Find the latest version of a file
   */
  static findLatest(query) {
    return localFileConnector.findLatest(query);
  }

  /**
   * Preview first N lines of a file — auto-allowed
   */
  static previewFile(filePath, lines = 30) {
    if (localFileConnector.isFileBlocked(filePath)) {
      auditLog.logBlocked({ type: 'preview', description: `Preview ${filePath}` }, 'Sensitive file pattern');
      return { blocked: true, reason: '🚫 Security: This file contains sensitive data and cannot be previewed or shared.' };
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const preview = content.split('\n').slice(0, lines).join('\n');
      return {
        status: 'ok',
        file: path.basename(filePath),
        path: filePath,
        preview,
        truncated: content.split('\n').length > lines,
        total_lines: content.split('\n').length,
      };
    } catch (e) {
      return { status: 'error', error: e.message };
    }
  }

  /**
   * Prepare file for email attachment — creates action draft, requires approval
   */
  static prepareAttachment(filePath) {
    if (localFileConnector.isFileBlocked(filePath)) {
      auditLog.logBlocked({ type: 'attach-file', description: `Attach ${filePath}` }, 'Sensitive file pattern');
      return {
        blocked: true,
        reason: `🚫 Security: "${path.basename(filePath)}" cannot be attached or sent — sensitive file pattern detected.`,
      };
    }
    const info = localFileConnector.getFileInfo(filePath);
    return { status: 'ok', ready: true, file: info };
  }

  /**
   * Prepare upload to Drive — requires approval
   */
  static prepareUpload(filePath, destinationFolder = 'Mi Uploads') {
    if (localFileConnector.isFileBlocked(filePath)) {
      return {
        blocked: true,
        reason: `🚫 Security: "${path.basename(filePath)}" cannot be uploaded — sensitive file.`,
      };
    }
    const info = localFileConnector.getFileInfo(filePath);
    if (info.error) return { status: 'error', error: info.error };

    const action = ApprovalRequiredAction.create({
      type: 'upload-file',
      target: 'google-drive',
      description: `Upload "${path.basename(filePath)}" (${info.size_kb}KB) to Drive → ${destinationFolder}`,
      payload: { filePath, destinationFolder, fileInfo: info },
      before_state: `File exists locally at ${filePath}`,
      rollback_plan: 'Delete uploaded file from Drive',
    });

    return {
      status: 'pending_approval',
      action,
      preview: `Upload "${path.basename(filePath)}" (${info.size_kb}KB) to Google Drive → ${destinationFolder}`,
      formatted: ApprovalRequiredAction.formatForResponse(action),
    };
  }

  /**
   * Copy file to local destination — requires approval
   */
  static prepareCopy(srcPath, destPath) {
    if (localFileConnector.isFileBlocked(srcPath)) {
      return { blocked: true, reason: '🚫 Security: source file is sensitive' };
    }
    const action = ApprovalRequiredAction.create({
      type: 'upload-file',
      target: destPath,
      description: `Copy "${path.basename(srcPath)}" → ${destPath}`,
      payload: { srcPath, destPath },
      before_state: `Source: ${srcPath}`,
      rollback_plan: 'Delete the copy at destination',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }
}
