/**
 * Mi Action Router — dispatches CEO action requests to the correct adapter.
 * Every action goes through the approval gate based on risk level.
 *
 * Level 1 (read):    auto-allowed
 * Level 2 (write):   single approval
 * Level 3 (danger):  double approval
 */

import { enqueue, isAutoAllowed } from '../approval/gate';

export type ActionType =
  | 'gmail_search' | 'gmail_read' | 'gmail_send' | 'gmail_draft'
  | 'drive_search' | 'drive_read' | 'drive_upload' | 'drive_share'
  | 'file_search' | 'file_read' | 'file_create' | 'file_delete'
  | 'excel_create' | 'word_create' | 'pdf_export'
  | 'email_send' | 'file_move' | 'file_overwrite';

export interface ActionRequest {
  action: ActionType;
  params: Record<string, unknown>;
  requester?: string;
  description?: string;
}

export interface ActionResult {
  ok: boolean;
  data?: unknown;
  approval_id?: string;
  approval_required?: boolean;
  error?: string;
}

// Map actions to risk levels
const RISK_MAP: Record<ActionType, number> = {
  gmail_search: 1, gmail_read: 1, drive_search: 1, drive_read: 1,
  file_search: 1, file_read: 1,
  gmail_draft: 2, excel_create: 2, word_create: 2, pdf_export: 2,
  drive_upload: 2, file_create: 2,
  gmail_send: 3, drive_share: 3, file_delete: 3, file_move: 3,
  file_overwrite: 3, email_send: 3,
};

export async function routeAction(req: ActionRequest): Promise<ActionResult> {
  const risk = RISK_MAP[req.action] ?? 2;
  const category = req.action;

  if (risk === 1 || isAutoAllowed(category)) {
    return executeAction(req);
  }

  // Enqueue for approval
  const action = await enqueue({
    risk_level: risk as 1 | 2 | 3,
    category,
    description: req.description || `${req.action}: ${JSON.stringify(req.params).slice(0, 120)}`,
    target: JSON.stringify(req.params).slice(0, 200),
    rollback_plan: risk === 3 ? 'Hành động có thể không hồi phục. Kiểm tra kỹ trước khi phê duyệt.' : undefined,
  });

  return {
    ok: false,
    approval_required: true,
    approval_id: action.id,
  };
}

async function executeAction(req: ActionRequest): Promise<ActionResult> {
  try {
    switch (req.action) {
      case 'gmail_search': {
        const { searchGmail } = await import('./gmail-action-adapter');
        return { ok: true, data: await searchGmail(req.params.query as string) };
      }
      case 'gmail_read': {
        const { readGmail } = await import('./gmail-action-adapter');
        return { ok: true, data: await readGmail(req.params.message_id as string) };
      }
      case 'gmail_draft': {
        const { draftEmail } = await import('./gmail-action-adapter');
        return { ok: true, data: await draftEmail(req.params as unknown as Parameters<typeof draftEmail>[0]) };
      }
      case 'drive_search': {
        const { searchDrive } = await import('./drive-action-adapter');
        return { ok: true, data: await searchDrive(req.params.query as string) };
      }
      case 'drive_read': {
        const { readDriveFile } = await import('./drive-action-adapter');
        return { ok: true, data: await readDriveFile(req.params.file_id as string) };
      }
      case 'file_search': {
        const { searchLocalFiles } = await import('./local-file-agent');
        return { ok: true, data: await searchLocalFiles(req.params.query as string, req.params.folder as string) };
      }
      case 'file_read': {
        const { readLocalFile } = await import('./local-file-agent');
        return { ok: true, data: await readLocalFile(req.params.path as string) };
      }
      case 'excel_create': {
        const { createExcel } = await import('./excel-worker');
        return { ok: true, data: await createExcel(req.params as unknown as Parameters<typeof createExcel>[0]) };
      }
      case 'word_create': {
        const { createWord } = await import('./word-worker');
        return { ok: true, data: await createWord(req.params as unknown as Parameters<typeof createWord>[0]) };
      }
      default:
        return { ok: false, error: `Action ${req.action} requires approval — not yet approved.` };
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
