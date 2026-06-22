/**
 * ActionRollbackPlanner.mjs
 * Generates rollback plans for any action.
 * Referenced by approval UI to show CEO what happens if they need to undo.
 */

const ROLLBACK_PLANS = {
  'send-email':       'Email cannot be unsent after sending. Act before approving.',
  'create-event':     'Cancel or delete event via Google Calendar.',
  'update-event':     'Revert to original event details via Calendar.',
  'cancel-event':     'Re-create event manually — cannot auto-restore.',
  'upload-file':      'Delete uploaded file from Google Drive.',
  'share-file':       'Remove sharing permission in Drive settings.',
  'create-folder':    'Delete the created folder from Drive.',
  'create-task':      'Delete task from Asana or Dashboard.',
  'update-task':      'Revert task fields to previous values.',
  'assign-task':      'Re-assign to previous assignee.',
  'complete-task':    'Mark task incomplete again.',
  'schedule-post':    'Reject or cancel in content schedule.',
  'update-menu':      'Revert menu to previous version via CMS.',
  'update-seo':       'Revert SEO meta tags via CMS.',
  'delete-file':      '⚠️ CANNOT BE UNDONE — use extreme caution.',
  'deploy-production':'Rollback deployment to previous version.',
  'publish-website':  'Unpublish or revert to draft via CMS.',
  'reply-email':      'Reply cannot be unsent after sending.',
  'forward-email':    'Forward cannot be unsent after sending.',
};

export class ActionRollbackPlanner {
  static getплан(actionType) {
    return ROLLBACK_PLANS[actionType] || 'Manual intervention may be required.';
  }

  static enrichAction(action) {
    return {
      ...action,
      rollback_plan: action.rollback_plan || this.getплан(action.type),
    };
  }

  static generateReport(actions) {
    return actions.map(a => ({
      id: a.id,
      type: a.type,
      description: a.description,
      risk_level: a.risk_level,
      rollback: ROLLBACK_PLANS[a.type] || 'Unknown',
    }));
  }
}
