/**
 * Task Query Engine — Phase 16
 * Answers 5 CEO questions directly from operational data. No LLM required.
 */

import { buildSnapshot, type OperationalSnapshot, type OpenTask, type GraphRisk } from './task-data-collector';

export interface TaskAnswer {
  question_key: string;
  answer_vi: string;           // Vietnamese response ready for WhatsApp
  summary_line: string;        // one-line summary
  items: OpenTask[];
  data_source: string[];       // which data sources were read
  generated_at: string;
}

// ── Priority sort ────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { P0: 0, CRITICAL: 0, P1: 1, HIGH: 1, P2: 2, MEDIUM: 2, P3: 3, LOW: 3 };

function byPriority(a: OpenTask, b: OpenTask): number {
  return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
}

function formatAge(hours: number): string {
  if (hours < 1) return 'vừa xong';
  if (hours < 24) return `${hours}h trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function priorityLabel(p: string): string {
  const map: Record<string, string> = { P0: '🔴 P0', P1: '🟠 P1', P2: '🟡 P2', P3: '🟢 P3' };
  return map[p] || p;
}

// ── Q1: "Hôm nay anh có task gì?" ────────────────────────────────────────────

export function queryTodayTasks(snap?: OperationalSnapshot): TaskAnswer {
  const s = snap || buildSnapshot();
  const all = [
    ...s.open_work_orders,
    ...s.pending_approvals,
    ...s.open_blockers,
  ].sort(byPriority);

  const lines: string[] = ['Em thấy hôm nay anh có:'];
  if (s.open_work_orders.length)   lines.push(`• ${s.open_work_orders.length} work order đang mở`);
  if (s.pending_approvals.length)  lines.push(`• ${s.pending_approvals.length} approval đang chờ`);
  if (s.open_blockers.length)      lines.push(`• ${s.open_blockers.length} blocker chưa xử lý`);
  if (s.certifications_pending.length) lines.push(`• ${s.certifications_pending.length} skill chờ nâng cấp`);

  if (all.length === 0) {
    lines.length = 0;
    lines.push('Hôm nay không có task nào đang mở. All clear! ✅');
  } else {
    lines.push('');
    lines.push('Ưu tiên cao nhất:');
    for (const t of all.slice(0, 3)) {
      lines.push(`${priorityLabel(t.priority)} [${t.type.toUpperCase()}] ${t.title}`);
      if (t.project) lines.push(`   → Project: ${t.project} (${formatAge(t.age_hours)})`);
    }
  }

  return {
    question_key: 'today_tasks',
    answer_vi: lines.join('\n'),
    summary_line: `${all.length} task đang mở (${s.pending_approvals.length} approval, ${s.open_blockers.length} blocker)`,
    items: all,
    data_source: ['work_orders', 'approval_gate', 'incident_memory'],
    generated_at: s.as_of,
  };
}

// ── Q2: "Có gì cần anh duyệt không?" ─────────────────────────────────────────

export function queryPendingApprovals(snap?: OperationalSnapshot): TaskAnswer {
  const s = snap || buildSnapshot();

  const approvals = s.pending_approvals.sort(byPriority);
  const certs = s.certifications_pending;

  const lines: string[] = [];

  if (approvals.length === 0 && certs.length === 0) {
    lines.push('Hiện không có gì cần anh duyệt. ✅');
  } else {
    if (approvals.length > 0) {
      lines.push(`✋ ${approvals.length} approval đang chờ anh:`);
      lines.push('');
      for (const a of approvals) {
        lines.push(`${priorityLabel(a.priority)} ${a.title}`);
        if (a.detail) lines.push(`   ${a.detail}`);
        lines.push(`   ⏱ ${formatAge(a.age_hours)}`);
      }
    }
    if (certs.length > 0) {
      if (approvals.length > 0) lines.push('');
      lines.push(`📋 ${certs.length} skill đang chờ anh xét duyệt nâng cấp:`);
      for (const c of certs) {
        lines.push(`   • ${c.title}`);
        if (c.detail) lines.push(`     ${c.detail}`);
      }
    }
  }

  return {
    question_key: 'pending_approvals',
    answer_vi: lines.join('\n'),
    summary_line: `${approvals.length} approval + ${certs.length} cert đang chờ duyệt`,
    items: [...approvals, ...certs],
    data_source: ['approval_gate', 'certifications'],
    generated_at: s.as_of,
  };
}

// ── Q2b: "Việc gì đang chờ anh?" (broader — approvals + stuck blockers + reminders) ─

export function queryWaitingForCeo(snap?: OperationalSnapshot): TaskAnswer {
  const s = snap || buildSnapshot();
  const waiting = [
    ...s.pending_approvals,
    ...s.certifications_pending,
    ...s.active_reminders,
    ...s.open_blockers.filter(b => b.age_hours >= 4),   // blockers stuck > 4h need CEO attention
  ].sort(byPriority);

  const lines: string[] = [];
  if (waiting.length === 0) {
    lines.push('Hiện không có việc nào đang chờ anh. 👍');
  } else {
    lines.push(`Có ${waiting.length} việc đang chờ anh:`);
    lines.push('');
    for (const t of waiting) {
      const icon = t.type === 'approval' ? '✋' : t.type === 'certification' ? '📋' : t.type === 'reminder' ? '⏰' : '⚠️';
      lines.push(`${icon} ${priorityLabel(t.priority)} ${t.title}`);
      if (t.detail) lines.push(`   ${t.detail}`);
    }
  }

  return {
    question_key: 'waiting_for_ceo',
    answer_vi: lines.join('\n'),
    summary_line: `${waiting.length} việc đang chờ anh`,
    items: waiting,
    data_source: ['approval_gate', 'certifications', 'reminders', 'incident_memory'],
    generated_at: s.as_of,
  };
}

// ── Q3: "Blocker nào cần xử lý?" ─────────────────────────────────────────────

export function queryBlockers(snap?: OperationalSnapshot): TaskAnswer {
  const s = snap || buildSnapshot();
  const blockers = [
    ...s.open_blockers,
    ...s.open_work_orders.filter(wo => wo.status === 'rejected' || wo.status === 'qa_pending'),
  ].sort(byPriority);

  const lines: string[] = [];
  if (blockers.length === 0) {
    lines.push('Không có blocker nào. Tất cả đang chạy ổn. ✅');
  } else {
    lines.push(`Có ${blockers.length} blocker cần xử lý:`);
    lines.push('');
    for (const b of blockers) {
      lines.push(`🔴 ${priorityLabel(b.priority)} ${b.title}`);
      lines.push(`   Project: ${b.project || 'N/A'} | ${formatAge(b.age_hours)}`);
      if (b.detail) lines.push(`   ${b.detail}`);
    }
    const staleCount = blockers.filter(b => b.age_hours >= 24).length;
    if (staleCount > 0) {
      lines.push('');
      lines.push(`⚠️ ${staleCount} blocker đã tồn tại hơn 24h — cần xử lý ngay.`);
    }
  }

  return {
    question_key: 'blockers',
    answer_vi: lines.join('\n'),
    summary_line: `${blockers.length} blocker đang mở`,
    items: blockers,
    data_source: ['incident_memory', 'work_orders'],
    generated_at: s.as_of,
  };
}

// ── Q4/Q5: "Có gì đáng lo không?" ────────────────────────────────────────────

export function queryConcerns(snap?: OperationalSnapshot): TaskAnswer {
  const s = snap || buildSnapshot();
  const concerns = s.concern_items.sort(byPriority);
  const spofs = s.graph_risks.filter(r => r.is_spof);
  const highRisk = s.graph_risks.filter(r => !r.is_spof && r.criticality_score >= 50);

  const lines: string[] = [];
  const hasAnyConcern = concerns.length > 0 || spofs.length > 0;

  if (!hasAnyConcern) {
    lines.push('Hệ thống ổn định. Không có gì đáng lo lúc này. ✅');
    if (s.graph_risks.length > 0) {
      lines.push('');
      lines.push('📊 Graph Intelligence — hệ thống đang theo dõi:');
      for (const r of s.graph_risks.slice(0, 3)) {
        lines.push(`   • ${r.entity_name} — criticality: ${r.criticality_score}/100`);
      }
    }
  } else {
    lines.push('⚠️ Có một số điểm cần chú ý:');

    // Operational concerns
    if (concerns.length > 0) {
      lines.push('');
      lines.push('🔧 Operational:');
      for (const c of concerns.slice(0, 5)) {
        const urgency = c.age_hours >= 48 ? ' 🚨 KHẨN' : c.age_hours >= 24 ? ' ⏰ Trễ' : '';
        lines.push(`   ${priorityLabel(c.priority)} [${c.type.toUpperCase()}]${urgency} ${c.title}`);
        if (c.project) lines.push(`      → ${c.project} | ${formatAge(c.age_hours)}`);
      }
      if (concerns.length > 5) lines.push(`   ... và ${concerns.length - 5} điểm khác`);
    }

    // Graph Intelligence — SPOF warnings
    if (spofs.length > 0) {
      lines.push('');
      lines.push('🕸️ Graph Intelligence — Single Points of Failure:');
      for (const spof of spofs) {
        lines.push(`   🔴 ${spof.entity_name} — ${spof.in_degree} project phụ thuộc (criticality: ${spof.criticality_score}/100)`);
        lines.push(`      Nếu ${spof.entity_name} sập → toàn bộ platform bị ảnh hưởng`);
      }
    }

    // High-risk non-SPOF
    if (highRisk.length > 0) {
      lines.push('');
      lines.push('📊 Thực thể rủi ro cao (cần monitoring):');
      for (const r of highRisk.slice(0, 3)) {
        lines.push(`   🟠 ${r.entity_name} — ${r.in_degree} dependencies (score: ${r.criticality_score}/100)`);
      }
    }

    const p0 = concerns.filter(c => c.priority === 'P0').length;
    if (p0 > 0) lines.push(`\n🔴 ${p0} item P0 — cần xử lý ngay lập tức!`);
  }

  const sources = ['work_orders', 'incident_memory', 'approval_gate'];
  if (s.graph_risks.length > 0) sources.push('graph_intelligence');

  return {
    question_key: 'concerns',
    answer_vi: lines.join('\n'),
    summary_line: concerns.length === 0 && spofs.length === 0
      ? 'Không có điểm đáng lo'
      : `${concerns.length} operational concern, ${spofs.length} SPOF`,
    items: concerns,
    data_source: sources,
    generated_at: s.as_of,
  };
}

// ── Q5: "Hôm nay team đang làm gì?" ──────────────────────────────────────────

export function queryTeamActivity(snap?: OperationalSnapshot): TaskAnswer {
  const s = snap || buildSnapshot();
  const activity = s.recent_team_activity;

  const roleDisplay: Record<string, string> = {
    engineering_manager: 'Dev1 (Engineering)',
    developer: 'Dev1',
    product_manager: 'PM',
    qa_agent: 'QA Agent',
    qa: 'QA',
    release: 'Release',
    auditor_agent: 'Auditor',
    ceo_interpreter: 'CEO Interpreter',
  };

  // Group by role
  const byRole: Record<string, typeof activity> = {};
  for (const a of activity) {
    const role = a.agent_role;
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(a);
  }

  const lines: string[] = [];
  if (activity.length === 0) {
    lines.push('Không có hoạt động nào trong 24h qua.');
  } else {
    lines.push(`Trong 24h qua, team đã thực hiện ${activity.length} actions:`);
    lines.push('');
    for (const [role, acts] of Object.entries(byRole)) {
      const display = roleDisplay[role] || role;
      const passed = acts.filter(a => a.verdict === 'PASS').length;
      const topAction = acts[0];
      lines.push(`👤 ${display} — ${acts.length} actions (${passed} PASS)`);
      lines.push(`   Gần nhất: ${topAction.action_type} trên ${topAction.target}`);
    }
    // In-flight work orders
    if (s.open_work_orders.length > 0) {
      lines.push('');
      lines.push(`📋 ${s.open_work_orders.length} work order đang xử lý:`);
      for (const wo of s.open_work_orders.slice(0, 3)) {
        lines.push(`   • [${wo.status?.toUpperCase()}] ${wo.project || 'N/A'} — ${wo.title.slice(0, 50)}`);
      }
    }
  }

  return {
    question_key: 'team_activity',
    answer_vi: lines.join('\n'),
    summary_line: `${activity.length} actions trong 24h, ${s.open_work_orders.length} WO đang mở`,
    items: s.open_work_orders,
    data_source: ['execution_ledger', 'work_orders'],
    generated_at: s.as_of,
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function dispatchTaskQuery(question: string): TaskAnswer | null {
  const n = question.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd').replace(/[^a-z0-9\s]/g, ' ').trim();

  const snap = buildSnapshot();   // single snapshot, reused across all queries

  // Q1 — today's tasks
  if (/hom nay.*task|task.*hom nay|co task|co viec|viec hom nay|task gi|lam gi hom|anh co task/.test(n)) {
    return queryTodayTasks(snap);
  }
  // Q2 — pending approvals (specific: "cần anh duyệt")
  if (/can anh duyet|co gi.*duyet|duyet.*khong|can duyet|phe duyet|approval.*can|can.*approval/.test(n)) {
    return queryPendingApprovals(snap);
  }
  // Q2b — broader waiting (anything waiting for CEO)
  if (/dang cho|cho.*anh|viec gi.*cho|co gi.*cho|approval/.test(n)) {
    return queryWaitingForCeo(snap);
  }
  // Q3 — team activity
  if (/team.*dang|dang lam gi|hom nay lam|ai dang|nguoi lam|team lam/.test(n)) {
    return queryTeamActivity(snap);
  }
  // Q4 — blockers
  if (/blocker|co blocker|can xu ly|bi block|loi nao|co loi khong/.test(n)) {
    return queryBlockers(snap);
  }
  // Q5 — concerns / risk
  if (/dang lo|lo khong|van de|nguy hiem|canh bao|co gi dang lo|co gi.*lo|rui ro/.test(n)) {
    return queryConcerns(snap);
  }

  return null;   // not a task query
}

// ── Is this a task query? (for intent detection) ──────────────────────────────

export function isTaskQuery(text: string): boolean {
  return dispatchTaskQuery(text) !== null;
}
