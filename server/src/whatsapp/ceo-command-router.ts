import { getPending } from '../approval/gate';
import {
  getApprovals,
  getPendingWhatsAppApprovals,
  getSummary,
} from '../services/whatsapp-store';
import { generateDailySummary } from './daily-summary';
import { helpText } from '../communication/command-registry';
import {
  appendReviewApprovalAudit,
  getReviewApprovalByReviewId,
  updateReviewApproval,
} from '../services/review-approval-store';

export interface CeoCommandContext {
  sender: string;
  senderName: string;
  chatId: string;
}

export interface CeoCommandResult {
  reply: string;
  intent: string;
  confidence: number;
  requires_followup: boolean;
}

type CommandHandler = (args: string, context: CeoCommandContext) => Promise<CeoCommandResult>;

type ReviewCommandAction = 'approve' | 'reject' | 'edit' | 'escalate';

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

function allowedNumbers(): string[] {
  return (process.env.CEO_WHATSAPP_ALLOWED_NUMBERS || '')
    .split(',')
    .map(v => normalizePhone(v.trim()))
    .filter(Boolean);
}

function reviewApprovalChannelEnabled(): boolean {
  return allowedNumbers().length > 0;
}

function parseReviewCommand(input: string): { action: ReviewCommandAction; reviewId: number; replyText?: string } | null {
  const trimmed = input.trim();
  const edit = trimmed.match(/^(?:edit|sửa|sua)\s+review\s+(\d+)\s*:\s*([\s\S]+)$/i);
  if (edit) return { action: 'edit', reviewId: Number(edit[1]), replyText: edit[2].trim() };

  const approve = trimmed.match(/^(?:approve|duyệt|duyet)\s+review\s+(\d+)$/i);
  if (approve) return { action: 'approve', reviewId: Number(approve[1]) };

  const reject = trimmed.match(/^(?:reject|từ chối|tu choi)\s+review\s+(\d+)$/i);
  if (reject) return { action: 'reject', reviewId: Number(reject[1]) };

  const escalate = trimmed.match(/^(?:escalate|chuyển người xử lý|chuyen nguoi xu ly)\s+review\s+(\d+)$/i);
  if (escalate) return { action: 'escalate', reviewId: Number(escalate[1]) };

  return null;
}

async function callReviewSystem(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const baseUrl = process.env.REVIEW_SYSTEM_BASE_URL || 'http://127.0.0.1:8000';
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (process.env.REVIEW_SYSTEM_INTERNAL_TOKEN) headers['x-internal-token'] = process.env.REVIEW_SYSTEM_INTERNAL_TOKEN;
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : {}; } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, body };
}

async function handleReviewCommand(
  command: { action: ReviewCommandAction; reviewId: number; replyText?: string },
  context: CeoCommandContext,
): Promise<CeoCommandResult> {
  const record = getReviewApprovalByReviewId(command.reviewId);
  const actor = context.senderName || context.sender || 'ceo';
  const channel = 'whatsapp';
  const sender = normalizePhone(context.sender || '');
  const allowed = allowedNumbers();
  if (!reviewApprovalChannelEnabled() || !allowed.includes(sender)) {
    appendReviewApprovalAudit({
      approval_id: record?.approval_id || `review-${command.reviewId}`,
      review_id: command.reviewId,
      actor,
      channel,
      timestamp: new Date().toISOString(),
      action: 'unauthorized_command',
      original_reply: record?.original_reply || '',
      final_reply: record?.final_reply || '',
      error: !reviewApprovalChannelEnabled() ? 'CEO_WHATSAPP_ALLOWED_NUMBERS missing' : 'Sender not authorized',
    });
    return {
      intent: 'review_approval_unauthorized',
      confidence: 1,
      requires_followup: false,
      reply: 'Action failed for review ' + command.reviewId + ': sender is not authorized.',
    };
  }

  const originalReply = record?.original_reply || record?.suggested_reply || '';
  let finalReply = record?.final_reply || originalReply;
  let result: unknown = null;
  let error: string | undefined;

  try {
    if (record?.status === 'posted' && command.action === 'approve') {
      appendReviewApprovalAudit({
        approval_id: record.approval_id,
        review_id: command.reviewId,
        actor,
        channel,
        timestamp: new Date().toISOString(),
        action: 'ignored_duplicate',
        original_reply: originalReply,
        final_reply: finalReply,
        result: { status: record.status },
      });
      return {
        intent: 'review_duplicate_ignored',
        confidence: 1,
        requires_followup: false,
        reply: `Approved. Reply was already queued in dry-run/live mode for review ${command.reviewId}.`,
      };
    }
    if (record?.status === 'rejected_by_ceo' && command.action === 'reject') {
      appendReviewApprovalAudit({
        approval_id: record.approval_id,
        review_id: command.reviewId,
        actor,
        channel,
        timestamp: new Date().toISOString(),
        action: 'ignored_duplicate',
        original_reply: originalReply,
        final_reply: finalReply,
        result: { status: record.status },
      });
      return {
        intent: 'review_duplicate_ignored',
        confidence: 1,
        requires_followup: false,
        reply: `Rejected. No reply will be posted for review ${command.reviewId}.`,
      };
    }
    if (record?.status === 'escalated' && command.action === 'escalate') {
      appendReviewApprovalAudit({
        approval_id: record.approval_id,
        review_id: command.reviewId,
        actor,
        channel,
        timestamp: new Date().toISOString(),
        action: 'ignored_duplicate',
        original_reply: originalReply,
        final_reply: finalReply,
        result: { status: record.status },
      });
      return {
        intent: 'review_duplicate_ignored',
        confidence: 1,
        requires_followup: false,
        reply: `Escalated review ${command.reviewId} for manual handling.`,
      };
    }

    if (command.action === 'edit') {
      finalReply = command.replyText || '';
      if (record?.final_reply === finalReply && ['edited_by_ceo', 'posted'].includes(record.status)) {
        appendReviewApprovalAudit({
          approval_id: record.approval_id,
          review_id: command.reviewId,
          actor,
          channel,
          timestamp: new Date().toISOString(),
          action: 'ignored_duplicate',
          original_reply: originalReply,
          final_reply: finalReply,
          result: { status: record.status },
        });
        return {
          intent: 'review_duplicate_ignored',
          confidence: 1,
          requires_followup: false,
          reply: `Updated draft reply for review ${command.reviewId}. Send "approve review ${command.reviewId}" to approve.`,
        };
      }
      const editResult = await callReviewSystem(`/api/reviews/${command.reviewId}/reply`, {
        method: 'PATCH',
        body: JSON.stringify({ reply_text: finalReply, actor: 'mi-core', source: channel }),
      });
      if (!editResult.ok) throw new Error(`Review System edit failed (${editResult.status}): ${JSON.stringify(editResult.body)}`);
      result = editResult.body;
      updateReviewApproval(command.reviewId, { status: 'edited_by_ceo', final_reply: finalReply, last_result: result, last_error: undefined });
    } else if (command.action === 'approve') {
      const approveResult = await callReviewSystem(`/api/reviews/${command.reviewId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'mi-core', source: channel }),
      });
      if (!approveResult.ok) throw new Error(`Review System approve failed (${approveResult.status}): ${JSON.stringify(approveResult.body)}`);
      const postResult = await callReviewSystem(`/api/reviews/${command.reviewId}/post`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'mi-core', source: channel, dry_run: true }),
      });
      if (!postResult.ok) throw new Error(`Review System post failed (${postResult.status}): ${JSON.stringify(postResult.body)}`);
      result = { approve: approveResult.body, post: postResult.body };
      updateReviewApproval(command.reviewId, { status: 'posted', last_result: result, last_error: undefined });
    } else if (command.action === 'reject') {
      const rejectResult = await callReviewSystem(`/api/reviews/${command.reviewId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'mi-core', source: channel, reason: 'Rejected by CEO via WhatsApp' }),
      });
      if (!rejectResult.ok) throw new Error(`Review System reject failed (${rejectResult.status}): ${JSON.stringify(rejectResult.body)}`);
      result = rejectResult.body;
      updateReviewApproval(command.reviewId, { status: 'rejected_by_ceo', last_result: result, last_error: undefined });
    } else {
      const escalateResult = await callReviewSystem(`/api/reviews/${command.reviewId}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ actor: 'mi-core', source: channel, reason: 'Escalated by CEO via WhatsApp' }),
      });
      if (!escalateResult.ok) throw new Error(`Review System escalate failed (${escalateResult.status}): ${JSON.stringify(escalateResult.body)}`);
      result = escalateResult.body;
      updateReviewApproval(command.reviewId, { status: 'escalated', last_result: result, last_error: undefined });
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    updateReviewApproval(command.reviewId, { status: 'post_failed', last_error: error });
  }

  appendReviewApprovalAudit({
    approval_id: record?.approval_id || `review-${command.reviewId}`,
    review_id: command.reviewId,
    actor,
    channel,
    timestamp: new Date().toISOString(),
    action: command.action,
    original_reply: originalReply,
    final_reply: finalReply,
    result,
    error,
  });

  if (error) {
    return {
      intent: 'review_approval_failed',
      confidence: 1,
      requires_followup: true,
      reply: `❌ Review ${command.reviewId} failed: ${error}`,
    };
  }

  const labels: Record<ReviewCommandAction, string> = {
    approve: `Approved. Reply was queued in dry-run/live mode for review ${command.reviewId}.`,
    reject: `Rejected. No reply will be posted for review ${command.reviewId}.`,
    edit: `Updated draft reply for review ${command.reviewId}. Send "approve review ${command.reviewId}" to approve.`,
    escalate: `Escalated review ${command.reviewId} for manual handling.`,
  };
  return {
    intent: `review_${command.action}`,
    confidence: 1,
    requires_followup: false,
    reply: labels[command.action],
  };
}

function firstToken(input: string): { command: string; args: string } {
  const trimmed = input.trim();
  const match = trimmed.match(/^([a-zA-Z][\w-]*)(?:\s+(.*))?$/);
  if (!match) return { command: '', args: trimmed };
  return {
    command: match[1].toLowerCase(),
    args: (match[2] || '').trim(),
  };
}

function isGreeting(input: string): boolean {
  return /^(alo|hello|hi|hey|chào|chao|em ơi|mi ơi|ping|test)\b[.!?\s]*$/i.test(input.trim());
}

async function greetingCommand(): Promise<CeoCommandResult> {
  const nodes = await getJson('/api/nodes').catch(() => null);
  const wa = await getJson('/api/whatsapp/health').catch(() => null);
  const laptop1 = (nodes?.nodes || []).find((n: any) => n.node_id === 'laptop1');
  return {
    intent: 'ceo_greeting',
    confidence: 1,
    requires_followup: false,
    reply: [
      'Dạ anh, em đây.',
      `Mi-Core: online. WhatsApp: ${wa?.api_key_status || 'unknown'}. Laptop1: ${laptop1?.status || 'unknown'}.`,
      'Anh muốn em kiểm tra status, dự án, logs, hay việc hôm nay?',
    ].join('\n'),
  };
}

function pendingApprovalLines(limit = 5): string[] {
  const gatePending = getPending();
  const waPending = getPendingWhatsAppApprovals();
  const lines: string[] = [];

  for (const action of gatePending.slice(0, limit)) {
    lines.push(`- ${action.id} [L${action.risk_level}] ${action.description.slice(0, 120)}`);
  }

  for (const action of waPending.slice(0, Math.max(0, limit - lines.length))) {
    lines.push(`- ${action.approval_id} ${action.action_description.slice(0, 120)}`);
  }

  return lines;
}

async function statusCommand(): Promise<CeoCommandResult> {
  const summary = getSummary();
  const pendingGate = getPending().length;
  const pendingWa = getPendingWhatsAppApprovals().length;

  return {
    intent: 'ceo_status',
    confidence: 1,
    requires_followup: false,
    reply: [
      '*Mi-Core Phone OS Status*',
      `WhatsApp: online, ${summary.total_messages} message(s), ${summary.recent_errors} recent error(s)`,
      `Approvals: ${pendingGate + pendingWa} pending`,
      'Queue: governed execution path enabled',
      'Big Data: Postgres/MinIO/Qdrant baseline is owned by MI_MASTER_PHASE_READY validation',
      'Mode: WhatsApp-first command center',
    ].join('\n'),
  };
}

async function getJson(path: string): Promise<any> {
  const port = process.env.MI_PORT || 4001;
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return res.ok ? res.json() : null;
}

function compactStatus(data: any): string {
  if (!data) return 'unreachable';
  return String(data.status || data.body?.status || data.error || (data.ok ? 'healthy' : 'unknown'));
}

async function laptopProjectCommand(projectId: string, title: string): Promise<CeoCommandResult> {
  const data = await getJson(`/api/nodes/laptop1/projects/${projectId}/status`);
  return {
    intent: `node_laptop1_project_${projectId}`,
    confidence: 1,
    requires_followup: false,
    reply: `*${title}*\nLaptop1: ${compactStatus(data)}\n${JSON.stringify(data || {}, null, 2).slice(0, 700)}`,
  };
}

async function laptopLogsCommand(projectId: string, title: string): Promise<CeoCommandResult> {
  const data = await getJson(`/api/nodes/laptop1/projects/${projectId}/logs`);
  return {
    intent: `node_laptop1_logs_${projectId}`,
    confidence: 1,
    requires_followup: false,
    reply: `*${title} Logs*\n${JSON.stringify(data || {}, null, 2).slice(0, 1200)}`,
  };
}

async function approvalsCommand(): Promise<CeoCommandResult> {
  const lines = pendingApprovalLines();
  const recent = getApprovals(5);

  return {
    intent: 'ceo_approvals',
    confidence: 1,
    requires_followup: lines.length > 0,
    reply: [
      '*Approvals*',
      lines.length ? lines.join('\n') : 'No pending approvals.',
      '',
      `Recent approval records: ${recent.length}`,
      'Anh reply "approve <id>" để duyệt, hoặc "cancel" để bỏ.',
    ].join('\n').trim(),
  };
}

async function todayCommand(): Promise<CeoCommandResult> {
  const summary = await generateDailySummary();
  return {
    intent: 'ceo_daily_briefing',
    confidence: 1,
    requires_followup: false,
    reply: summary.text,
  };
}

function capabilityCommand(intent: string, title: string, lines: string[]): CommandHandler {
  return async () => ({
    intent,
    confidence: 1,
    requires_followup: false,
    reply: [`*${title}*`, ...lines].join('\n'),
  });
}

function devCommand(): CommandHandler {
  return async () => {
    const approvalLines = pendingApprovalLines(3);
    return {
      intent: 'ceo_dev_command_center',
      confidence: 1,
      requires_followup: approvalLines.length > 0,
      reply: [
        '*Dev Command Center*',
        'Checkpoint: mi-master-phase-ready-v1',
        'Allowed now: QA, health, security review, release planning, approved fixes',
        'Blocked until approval: new feature build, deploy, destructive migration, credential changes',
        approvalLines.length ? `Pending approvals:\n${approvalLines.join('\n')}` : 'Pending approvals: none',
      ].join('\n'),
    };
  };
}

const COMMANDS: Record<string, CommandHandler> = {
  status: statusCommand,
  health: async (args: string): Promise<CeoCommandResult> => {
    if (args.trim().toLowerCase() === 'all') {
      const nodes = await getJson('/api/nodes');
      const wa = await getJson('/api/whatsapp/health');
      const enterprise = await getJson('/api/enterprise/health');
      return {
        intent: 'ceo_health_all',
        confidence: 1,
        requires_followup: false,
        reply: [
          '*Mi Health All*',
          `Enterprise: ${compactStatus(enterprise)}`,
          `WhatsApp: ${compactStatus(wa)}`,
          `Nodes: ${nodes?.online ?? 0}/${nodes?.total ?? 0} online`,
        ].join('\n'),
      };
    }
    return statusCommand();
  },
  today: todayCommand,
  approvals: approvalsCommand,
  approve: async () => ({
    intent: 'ceo_approval_help',
    confidence: 1,
    requires_followup: true,
    reply: 'Anh reply "approve <id>" để xác nhận action.',
  }),
  reject: async () => ({
    intent: 'ceo_approval_help',
    confidence: 1,
    requires_followup: true,
    reply: 'Use: /mi reject <approval_id>',
  }),
  dev: devCommand(),
  release: capabilityCommand('ceo_release', 'Release Control', [
    'Current release baseline: mi-master-phase-ready-v1',
    'Next release requires build, validation, report update, clean commit, tag, and backup.',
  ]),
  qa: capabilityCommand('ceo_qa', 'QA Control', [
    'Required suite: npm run build, npm run harness:test, Big Data health/sample/search/quality, mi-master-validate.',
    'Failures must create a fix task before release approval.',
  ]),
  security: capabilityCommand('ceo_security', 'Security Control', [
    'Sensitive actions require approval: payroll, financial, export, deploy, delete, permission changes.',
    'WhatsApp API key auth and replay protection are active on /api/whatsapp/mi.',
  ]),
  projects: async (): Promise<CeoCommandResult> => {
    const data = await getJson('/api/nodes/laptop1/projects');
    if (data?.projects?.length) {
      return {
        intent: 'ceo_projects',
        confidence: 1,
        requires_followup: false,
        reply: '*Laptop1 Projects*\n' + data.projects.map((p: any) => `- ${p.project_id}: ${compactStatus(p)}`).join('\n'),
      };
    }
    return {
      intent: 'ceo_projects',
      confidence: 1,
      requires_followup: false,
      reply: '*Projects*\nLaptop1 has not registered or is unreachable.',
    };
  },
  project: async (args: string): Promise<CeoCommandResult> => {
    const target = args.trim().toLowerCase();
    if (target.includes('whatsapp')) return laptopProjectCommand('whatsapp-ai-gateway', 'WhatsApp Gateway');
    if (target.includes('doordash')) return laptopProjectCommand('doordash-compaigns', 'DoorDash Campaigns');
    if (target.includes('integration')) return laptopProjectCommand('integration-system', 'Integration Background Agent');
    return COMMANDS.projects(args, { sender: '', senderName: '', chatId: '' });
  },
  logs: async (args: string): Promise<CeoCommandResult> => {
    const target = args.trim().toLowerCase();
    if (target.includes('doordash')) return laptopLogsCommand('doordash-compaigns', 'DoorDash');
    return {
      intent: 'node_laptop1_logs_unknown',
      confidence: 1,
      requires_followup: true,
      reply: 'Use: /mi logs doordash laptop1',
    };
  },
  roadmap: capabilityCommand('ceo_roadmap', 'Roadmap', [
    'Phase 21: CEO Communication Layer',
    'Phase 22: PM-Skill',
    'Phase 23: Local AI Stack',
    'Phase 24: Memory + Knowledge',
    'Phase 25-30: Alerts, Dev, Ops, Daily Briefing, Voice, Autonomous Assistant',
  ]),
  sprint: capabilityCommand('ceo_sprint', 'Sprint', [
    'Sprint focus: make WhatsApp the primary operating interface.',
    'Deliverables: command router, proactive alerts, PM-Skill summaries, voice path, approved action executor.',
  ]),
  blockers: capabilityCommand('ceo_blockers', 'Blockers', [
    'Open risks: connector credentials, local model capacity, persistent approval store, action execution permissions.',
    'Use /mi approvals to clear blocked actions.',
  ]),
  risks: capabilityCommand('ceo_risks', 'Risks', [
    'High: financial/payroll mutations without approval.',
    'Medium: connector drift and stale dashboard data.',
    'Medium: local AI fallback capacity and observability.',
  ]),
  progress: capabilityCommand('ceo_progress', 'Progress', [
    'Completed baseline: MI_MASTER_PHASE_READY checkpoint, tag, backup, Big Data validation.',
    'Current phase: CEO OS WhatsApp command surface.',
  ]),
  tasks: capabilityCommand('ceo_tasks', 'Tasks', [
    'Task execution will route through approval and queue governance.',
    'Write actions are draft-first until approved.',
  ]),
  assign: capabilityCommand('ceo_assign', 'Assign', [
    'Assignment commands are supported as governed actions.',
    'Use natural language after /mi assign; Mi will draft the action and request approval when needed.',
  ]),
  alerts: capabilityCommand('ceo_alerts', 'Alerts', [
    'Alert engine target: proactive WhatsApp notices for critical reviews, disputes, payroll, connector failures, and release blockers.',
    'Use /mi mute or /mi watch once Phase 25 persistence is enabled.',
  ]),
  mute: capabilityCommand('ceo_alert_mute', 'Alert Mute', [
    'Mute policy is planned for Phase 25.',
    'Current behavior: no persisted mute rules have been applied.',
  ]),
  watch: capabilityCommand('ceo_alert_watch', 'Alert Watch', [
    'Watch policy is planned for Phase 25.',
    'Current watch targets: approvals, runtime health, connector failures, business operations.',
  ]),
  stores: capabilityCommand('ceo_stores', 'Stores', [
    'Store command target: sales, operations, food safety, disputes, reviews, staffing, and incidents.',
    'Connector-backed store KPIs are planned in Phase 27.',
  ]),
  reviews: capabilityCommand('ceo_reviews', 'Reviews', [
    'Review command target: Google, Yelp, DoorDash, UberEats review intake and response drafts.',
    'Public replies require approval before send.',
  ]),
  disputes: capabilityCommand('ceo_disputes', 'Disputes', [
    'Dispute command target: delivery marketplace disputes, evidence collection, and response drafts.',
    'Financial-impact actions require approval.',
  ]),
  payroll: capabilityCommand('ceo_payroll', 'Payroll', [
    'Payroll is a sensitive domain.',
    'Read-only summaries are allowed; changes require approval and audit.',
  ]),
  qb: capabilityCommand('ceo_quickbooks', 'QuickBooks', [
    'QuickBooks command target: invoices, expenses, cash position, reconciliation exceptions.',
    'Financial mutations require approval.',
  ]),
  dashboard: capabilityCommand('ceo_dashboard', 'Dashboard', [
    'Dashboard remains secondary.',
    'Primary CEO interface is WhatsApp; dashboard is for drill-down and visibility.',
  ]),
  // ── Phase 1 additions ──────────────────────────────────────────────────
  help: async (_args: string, _ctx: CeoCommandContext): Promise<CeoCommandResult> => ({
    intent: 'ceo_help',
    confidence: 1,
    requires_followup: false,
    reply: helpText('vi'),
  }),
  bigdata: async (): Promise<CeoCommandResult> => {
    try {
      const port = process.env.MI_PORT || 4001;
      const res = await fetch(`http://127.0.0.1:${port}/api/bigdata/health`);
      const h = res.ok ? await res.json() as Record<string, string> : null;
      const ok = (k: string) => h?.[k] === 'ok' ? '✅' : '❌';
      return {
        intent: 'bigdata_health',
        confidence: 1,
        requires_followup: false,
        reply: h
          ? `*Big Data Health*\nPostgreSQL: ${ok('postgres')}\nMinIO: ${ok('minio')}\nQdrant: ${ok('qdrant')}\nOverall: ${h.overall === 'ok' ? '✅ OK' : '❌ ' + h.overall}`
          : '❌ Big Data không phản hồi. Kiểm tra Docker.',
      };
    } catch {
      return { intent: 'bigdata_health', confidence: 1, requires_followup: false, reply: '❌ Big Data unreachable.' };
    }
  },
  bd: async (): Promise<CeoCommandResult> => COMMANDS.bigdata('', { sender: '', senderName: '', chatId: '' }),
  nodes: async (): Promise<CeoCommandResult> => {
    try {
      const port = process.env.MI_PORT || 4001;
      const res = await fetch(`http://127.0.0.1:${port}/api/nodes/status`);
      const data = res.ok ? await res.json() as { nodes?: Array<{ node_id: string; status: string }> } : null;
      const nodes = data?.nodes || [];
      const lines = nodes.length ? nodes.map(n => `• ${n.node_id}: ${n.status}`) : ['Chưa có node nào kết nối.'];
      return { intent: 'nodes_status', confidence: 1, requires_followup: false, reply: '*Node Agents*\n' + lines.join('\n') };
    } catch {
      return { intent: 'nodes_status', confidence: 1, requires_followup: false, reply: '*Nodes*\nNode controller chưa khởi động.' };
    }
  },
  laptop1: async (_args: string): Promise<CeoCommandResult> => {
    try {
      const port = process.env.MI_PORT || 4001;
      const res = await fetch(`http://127.0.0.1:${port}/api/nodes/laptop1/health`);
      const data = res.ok ? await res.json() as Record<string, unknown> : null;
      const projectsRes = await fetch(`http://127.0.0.1:${port}/api/nodes/laptop1/projects`, { signal: AbortSignal.timeout(16000) }).catch(() => null);
      const projects = projectsRes?.ok ? await projectsRes.json() as { projects?: Array<{ project_id: string; status?: string; error?: string }> } : null;
      const projectLines = projects?.projects?.length
        ? '\n' + projects.projects.map(p => `- ${p.project_id}: ${p.status || p.error || 'unknown'}`).join('\n')
        : '';
      return { intent: 'node_laptop1', confidence: 1, requires_followup: false,
        reply: data ? `*Laptop 1*\nStatus: ${data.status || data.error || 'unknown'}${projectLines}` : '*Laptop 1*\nChưa kết nối.' };
    } catch {
      return { intent: 'node_laptop1', confidence: 1, requires_followup: false, reply: '*Laptop 1*\nKhông thể kết nối.' };
    }
  },
  laptop2: async (_args: string): Promise<CeoCommandResult> => {
    try {
      const port = process.env.MI_PORT || 4001;
      const res = await fetch(`http://127.0.0.1:${port}/api/nodes/laptop2/status`);
      const data = res.ok ? await res.json() as Record<string, unknown> : null;
      return { intent: 'node_laptop2', confidence: 1, requires_followup: false,
        reply: data ? `*Laptop 2*\n${JSON.stringify(data, null, 2).slice(0, 800)}` : '*Laptop 2*\nChưa kết nối.' };
    } catch {
      return { intent: 'node_laptop2', confidence: 1, requires_followup: false, reply: '*Laptop 2*\nKhông thể kết nối.' };
    }
  },
  remember: capabilityCommand('ceo_memory_remember', 'Memory', [
    'Memory writes route through the memory boundary.',
    'Use natural language after /mi remember; sensitive personal data must be approved.',
  ]),
  search: capabilityCommand('ceo_memory_search', 'Knowledge Search', [
    'Knowledge search target: Qdrant, Supermemory, and RAGFlow routing in Phase 24.',
    'For now, ask the search query after /mi search.',
  ]),
  history: capabilityCommand('ceo_memory_history', 'History', [
    'History target: WhatsApp actions, approvals, project decisions, and business events.',
    'Phase 24 will unify these into searchable memory.',
  ]),
  learn: capabilityCommand('ceo_memory_learn', 'Learning', [
    'Learning target: convert repeated CEO preferences and business rules into governed memory.',
    'Sensitive learning requires explicit approval.',
  ]),
};

export async function routeCeoCommand(
  normalized: string,
  context: CeoCommandContext,
): Promise<CeoCommandResult | null> {
  const reviewCommand = parseReviewCommand(normalized);
  if (reviewCommand) return handleReviewCommand(reviewCommand, context);

  if (isGreeting(normalized)) return greetingCommand();

  const { command, args } = firstToken(normalized);
  if (!command) return null;

  const handler = COMMANDS[command];
  if (!handler) return null;

  return handler(args, context);
}
