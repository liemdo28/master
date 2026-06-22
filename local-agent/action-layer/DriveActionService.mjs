/**
 * DriveActionService.mjs
 * Search, upload, create folder, share files on Google Drive.
 * All write actions require approval.
 */

import path from 'path';
import { driveConnector } from '../universal-visibility/GoogleDriveVisibilityConnector.mjs';
import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';
import { localFileConnector } from '../universal-visibility/LocalFileVisibilityConnector.mjs';

export class DriveActionService {
  /** Search Drive files — auto-allowed */
  static searchDrive(query) {
    return driveConnector.searchFiles(query);
  }

  /** Get recent Drive files — auto-allowed */
  static getRecent(limit = 10) {
    return driveConnector.getRecentFiles(limit);
  }

  /** Get shareable link for a Drive file (already uploaded) — auto-allowed */
  static getDriveLink(driveFileId, fileName) {
    return {
      status: 'ok',
      link: `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`,
      name: fileName,
      note: 'Link valid for anyone with the link. Check sharing settings.',
    };
  }

  /** Upload local file to Drive — requires approval */
  static uploadFile(localPath, driveFolderName = 'Mi Uploads') {
    if (localFileConnector.isFileBlocked(localPath)) {
      return {
        blocked: true,
        reason: `🚫 "${path.basename(localPath)}" is a sensitive file and cannot be uploaded.`,
      };
    }
    const info = localFileConnector.getFileInfo(localPath);
    if (info.error) return { status: 'error', error: info.error };

    const action = ApprovalRequiredAction.create({
      type: 'upload-file',
      target: `google-drive/${driveFolderName}`,
      description: `Upload "${info.name}" (${info.size_kb}KB) to Google Drive → ${driveFolderName}`,
      payload: { localPath, driveFolderName, fileInfo: info },
      before_state: 'File exists locally only',
      rollback_plan: 'Delete uploaded file from Drive',
    });

    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Create a Drive folder — requires approval */
  static createFolder(folderName, parentFolderName = '') {
    const action = ApprovalRequiredAction.create({
      type: 'create-folder',
      target: 'google-drive',
      description: `Create Drive folder: "${folderName}"${parentFolderName ? ` in ${parentFolderName}` : ''}`,
      payload: { folderName, parentFolderName },
      before_state: 'Folder does not exist',
      rollback_plan: 'Delete created folder from Drive',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Share a Drive file with someone — requires approval */
  static shareFile(driveFileId, recipientEmail, role = 'reader') {
    const action = ApprovalRequiredAction.create({
      type: 'share-file',
      target: recipientEmail,
      description: `Share Drive file ${driveFileId} with ${recipientEmail} as ${role}`,
      payload: { driveFileId, recipientEmail, role },
      before_state: 'File is private',
      rollback_plan: 'Remove sharing permission via Drive',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }

  /** Move Drive file — requires approval */
  static moveFile(driveFileId, targetFolderId) {
    const action = ApprovalRequiredAction.create({
      type: 'upload-file',
      target: targetFolderId,
      description: `Move Drive file ${driveFileId} to folder ${targetFolderId}`,
      payload: { driveFileId, targetFolderId },
      before_state: 'File in original location',
      rollback_plan: 'Move file back to original folder',
    });
    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }
}
