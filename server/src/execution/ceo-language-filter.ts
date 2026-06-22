/**
 * CEO Language Filter
 *
 * Translates internal workflow type names to CEO-facing natural language.
 * CEO must never see internal identifiers like DASHBOARD_AUDIT, SEO_CONTENT, etc.
 */

const CEO_WORKFLOW_LABELS: Record<string, string> = {
  DASHBOARD_AUDIT: 'Dashboard checked',
  EMAIL_DRAFT: 'Email draft created',
  FINANCE_REPORT: 'Finance summary prepared',
  SEO_CONTENT: 'SEO draft created',
  QB_CHECK: 'Finance checked',
  GENERAL_TASK: 'Task completed',
  DATA_EXPORT: 'Data exported',
  CALENDAR_EVENT: 'Calendar updated',
  APPROVAL_RESPONSE: 'Approval processed',
  CONTACT_MESSAGE: 'Message sent',
};

export function ceoLabel(workflowType: string): string {
  return CEO_WORKFLOW_LABELS[workflowType] || workflowType.toLowerCase().replace(/_/g, ' ');
}

export function ceoChildSummary(child: { workflow_type: string; status: string; target_entity?: string | null }): string {
  const label = ceoLabel(child.workflow_type);
  const target = child.target_entity ? ` (${child.target_entity})` : '';
  if (child.status === 'completed') return `✅ ${label}${target}`;
  if (child.status === 'approval_pending') return `⏳ ${label}${target} — chờ anh duyệt`;
  if (child.status === 'failed') return `❌ ${label}${target} — em chưa xử lý được`;
  return `${label}${target}`;
}

export function ceoMultiIntentSummary(children: Array<{ workflow_type: string; status: string; target_entity?: string | null }>): string {
  if (children.length === 0) return 'Em chưa hiểu rõ yêu cầu. Anh có thể giải thích thêm không?';

  const lines: string[] = [];
  lines.push(`Em đã xử lý ${children.length} việc cho anh:`);
  lines.push('');
  for (let i = 0; i < children.length; i++) {
    lines.push(`${i + 1}. ${ceoChildSummary(children[i])}`);
  }
  lines.push('');
  lines.push('Anh cần em làm gì thêm không?');
  return lines.join('\n');
}

export function stripInternalIds(text: string): string {
  return text
    .replace(/\bSEO-CONTENT-\d{8}-\d+\b/g, '')
    .replace(/\bAPPR-[\w-]+\b/g, '')
    .replace(/\bWF-\d{8}-\d+\b/g, '')
    .replace(/\bCEO-MULTI-\d{8}-\w+\b/g, '')
    .replace(/\b(DASHBOARD_AUDIT|EMAIL_DRAFT|FINANCE_REPORT|SEO_CONTENT|QB_CHECK|GENERAL_TASK|DATA_EXPORT|CALENDAR_EVENT|APPROVAL_RESPONSE|CONTACT_MESSAGE)\b/g, (match) => ceoLabel(match))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeCeoResponse(text: string): string {
  let result = text;
  // Replace workflow type names with CEO labels
  for (const [internal, label] of Object.entries(CEO_WORKFLOW_LABELS)) {
    result = result.replace(new RegExp(`\\b${internal}\\b`, 'g'), label);
  }
  // Remove tracking IDs
  result = stripInternalIds(result);
  return result;
}
