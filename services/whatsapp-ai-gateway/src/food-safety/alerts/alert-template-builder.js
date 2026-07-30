'use strict';
/**
 * alert-template-builder.js
 * Builds WhatsApp alert message text for food safety events.
 */

function missingSubmissionAlert({ store_name, store_id, shift, date }) {
  return `⚠️ *Food Safety Alert*\n\nStore: *${store_name || store_id}* has not submitted the *${shift}* line check for *${date}*.\n\nPlease submit immediately or contact your manager.`;
}

function failureAlert({ store_name, store_id, employee, shift, date, issues = [] }) {
  const issueLines = issues.slice(0, 5).map(i => `  • ${i.item || ''}: ${i.message || ''}`).join('\n');
  return `🚨 *Food Safety FAIL*\n\nStore: *${store_name || store_id}*\nEmployee: ${employee || 'Unknown'}\nShift: ${shift || ''} | Date: ${date || ''}\n\n*Issues detected:*\n${issueLines || '  None listed'}`;
}

function warningAlert({ store_name, store_id, employee, shift, date, issues = [] }) {
  const issueLines = issues.slice(0, 5).map(i => `  • ${i.item || ''}: ${i.message || ''}`).join('\n');
  return `⚠️ *Food Safety Warning*\n\nStore: *${store_name || store_id}*\nEmployee: ${employee || 'Unknown'}\nShift: ${shift || ''} | Date: ${date || ''}\n\n*Issues to review:*\n${issueLines || '  None listed'}`;
}

function reviewAlert({ store_name, store_id, employee, shift, date }) {
  return `🔍 *Food Safety — Needs Review*\n\nStore: *${store_name || store_id}*\nEmployee: ${employee || 'Unknown'}\nShift: ${shift || ''} | Date: ${date || ''}\n\nThe submission could not be fully validated. Please review manually.`;
}

function dailySummaryAlert({ date, stores = [] }) {
  const lines = stores.map(s => `  • ${s.name || s.store_id}: ${s.pass} pass, ${s.fail} fail, ${s.missing} missing`).join('\n');
  return `📋 *Daily Food Safety Summary — ${date}*\n\n${lines || '  No data available'}`;
}

module.exports = { missingSubmissionAlert, failureAlert, warningAlert, reviewAlert, dailySummaryAlert };
