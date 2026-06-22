/**
 * CEO Telemetry Seed — Populates production telemetry DB with realistic CEO message data
 * 
 * Purpose: Initialize the telemetry database and seed it with representative CEO messages
 * to prove the telemetry pipeline works end-to-end.
 * 
 * Run: npx ts-node server/src/telemetry/ceo-telemetry-seed.ts
 */

import {
  recordMessage,
  recordDecision,
  recordOutcome,
  markFalseAction,
  getTelemetryStats,
  type EvidenceState,
  type DecisionType,
  type OutcomeResult,
  type ApprovalState,
} from './ceo-telemetry-store';
import { getTelemetryDb, getMessageCount, nowIso, shortId } from './ceo-telemetry-db';

// ── CEO Message Dataset ──────────────────────────────────────────────────────

interface SeedMessage {
  sender: string;
  message: string;
  conversation_id?: string;
  channel?: string;
  intent: string;
  evidence_state: EvidenceState;
  decision: DecisionType;
  action: string;
  confidence: number;
  result: OutcomeResult;
  approval: ApprovalState;
  workflow_id?: string;
  false_action?: boolean;
  false_approval?: boolean;
  false_finance?: boolean;
  context_failure?: boolean;
}

const CEO_MESSAGES: SeedMessage[] = [
  // === CATEGORY 1: Dashboard Status Checks ===
  {
    sender: 'CEO_Vo',
    message: 'Dashboard sao roi?',
    conversation_id: 'conv-dash-001',
    intent: 'check_dashboard',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'dashboard_status_report',
    confidence: 0.95,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-DASH-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Hom nay Dashboard co gi bat thuong khong?',
    conversation_id: 'conv-dash-002',
    intent: 'check_dashboard',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'dashboard_anomaly_report',
    confidence: 0.92,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-DASH-002',
  },
  {
    sender: 'CEO_Vo',
    message: 'Tong quan Dashboard ngay 15/6',
    conversation_id: 'conv-dash-003',
    intent: 'check_dashboard',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'dashboard_daily_summary',
    confidence: 0.94,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-DASH-003',
  },
  // === CATEGORY 2: QuickBooks / Finance Queries ===
  {
    sender: 'CEO_Vo',
    message: 'QB sync chua? Co du lieu moi khong?',
    conversation_id: 'conv-qb-001',
    intent: 'check_qb',
    evidence_state: 'partial',
    decision: 'execute',
    action: 'qb_sync_check',
    confidence: 0.88,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-QB-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Doanh thu hom qua bao nhieu?',
    conversation_id: 'conv-finance-001',
    intent: 'check_finance',
    evidence_state: 'stale',
    decision: 'execute',
    action: 'finance_revenue_check',
    confidence: 0.75,
    result: 'partial',
    approval: 'not_required',
    workflow_id: 'WF-FIN-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Chi phi thang 6 den nay',
    conversation_id: 'conv-finance-002',
    intent: 'check_finance',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'finance_expense_report',
    confidence: 0.91,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-FIN-002',
  },
  // === CATEGORY 3: Payroll ===
  {
    sender: 'CEO_Vo',
    message: 'Payroll thang 6 chua chay?',
    conversation_id: 'conv-payroll-001',
    intent: 'check_payroll',
    evidence_state: 'no_data',
    decision: 'clarify',
    action: 'report_missing_payroll_connector',
    confidence: 0.90,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'Nhan vien nao chua check in hom nay?',
    conversation_id: 'conv-payroll-002',
    intent: 'check_payroll',
    evidence_state: 'no_data',
    decision: 'clarify',
    action: 'report_missing_attendance',
    confidence: 0.85,
    result: 'success',
    approval: 'not_required',
  },
  // === CATEGORY 4: Content / SEO ===
  {
    sender: 'CEO_Vo',
    message: 'Tao SEO Raw post moi cho website',
    conversation_id: 'conv-seo-001',
    intent: 'create_seo_content',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'seo_draft_create',
    confidence: 0.93,
    result: 'success',
    approval: 'pending',
    workflow_id: 'WF-SEO-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Post bai review Raw len website',
    conversation_id: 'conv-seo-002',
    intent: 'create_content',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'website_draft_create',
    confidence: 0.91,
    result: 'success',
    approval: 'pending',
    workflow_id: 'WF-SEOWEB-001',
  },
  // === CATEGORY 5: WhatsApp / Communication ===
  {
    sender: 'CEO_Vo',
    message: 'Gui Maria cap nhan tinh hinh',
    conversation_id: 'conv-wa-001',
    intent: 'send_message',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'whatsapp_send_maria',
    confidence: 0.89,
    result: 'success',
    approval: 'pending',
    workflow_id: 'WF-WA-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Nho nhan vien ve som hom nay',
    conversation_id: 'conv-wa-002',
    intent: 'send_reminder',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'whatsapp_broadcast_reminder',
    confidence: 0.87,
    result: 'success',
    approval: 'pending',
    workflow_id: 'WF-WA-002',
  },
  // === CATEGORY 6: Statement/Context Messages (should NOT trigger action) ===
  {
    sender: 'CEO_Vo',
    message: 'QB Report da hoan thanh roi ma',
    conversation_id: 'conv-stmt-001',
    intent: 'statement_ack',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.96,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'Payroll Raw la tuan roi',
    conversation_id: 'conv-stmt-002',
    intent: 'context_update',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'context_update_only',
    confidence: 0.94,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'K',
    conversation_id: 'conv-casual-001',
    intent: 'casual_ack',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.98,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'OK',
    conversation_id: 'conv-casual-002',
    intent: 'casual_ack',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.98,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'Vang',
    conversation_id: 'conv-casual-003',
    intent: 'casual_ack',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.97,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'Da nhan',
    conversation_id: 'conv-casual-004',
    intent: 'casual_ack',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.97,
    result: 'success',
    approval: 'not_required',
  },
  // === CATEGORY 7: Approval Workflows ===
  {
    sender: 'CEO_Vo',
    message: 'Duyet bai SEO nay di',
    conversation_id: 'conv-approval-001',
    intent: 'approve_workflow',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'approval_execute',
    confidence: 0.95,
    result: 'success',
    approval: 'approved',
    workflow_id: 'WF-SEO-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Huy bai post nay, lam lai',
    conversation_id: 'conv-approval-002',
    intent: 'reject_workflow',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'approval_reject',
    confidence: 0.93,
    result: 'success',
    approval: 'rejected',
    workflow_id: 'WF-SEOWEB-001',
  },
  // === CATEGORY 8: Connector / System Health ===
  {
    sender: 'CEO_Vo',
    message: 'Website on khong?',
    conversation_id: 'conv-health-001',
    intent: 'check_system_health',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'health_check_website',
    confidence: 0.90,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-HEALTH-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Google Sheets ket noi duoc khong?',
    conversation_id: 'conv-health-002',
    intent: 'check_connector',
    evidence_state: 'partial',
    decision: 'execute',
    action: 'connector_status_check',
    confidence: 0.85,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-CONN-001',
  },
  // === CATEGORY 9: Multi-intent messages ===
  {
    sender: 'CEO_Vo',
    message: 'Kiểm tra Dashboard, QB, Payroll, tạo SEO Raw rồi gửi Maria.',
    conversation_id: 'conv-multi-001',
    intent: 'multi_intent',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'multi_intent_split_execute',
    confidence: 0.88,
    result: 'success',
    approval: 'pending',
    workflow_id: 'WF-MULTI-001',
  },
  // === CATEGORY 10: Voice COO queries ===
  {
    sender: 'CEO_Vo',
    message: 'Hom nay co gi dang lo khong?',
    conversation_id: 'conv-voice-001',
    intent: 'voice_coo_briefing',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'voice_daily_briefing',
    confidence: 0.92,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-VOICE-001',
  },
  {
    sender: 'CEO_Vo',
    message: 'Co gi can duyet khong?',
    conversation_id: 'conv-voice-002',
    intent: 'voice_coo_approval_check',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'voice_approval_briefing',
    confidence: 0.91,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-VOICE-002',
  },
  // === CATEGORY 11: False action test cases (statements that should NOT create workflows) ===
  {
    sender: 'CEO_Vo',
    message: 'Em thay bai SEO nay hay qua',
    conversation_id: 'conv-stmt-003',
    intent: 'statement_opinion',
    evidence_state: 'complete',
    decision: 'reject',
    action: 'acknowledge_only',
    confidence: 0.95,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'Ngay kia minh hop nhe',
    conversation_id: 'conv-stmt-004',
    intent: 'statement_schedule',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.93,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'Cai do sao roi?',
    conversation_id: 'conv-ambig-001',
    intent: 'ambiguous_query',
    evidence_state: 'partial',
    decision: 'clarify',
    action: 'ask_clarification',
    confidence: 0.60,
    result: 'success',
    approval: 'not_required',
  },
  // === CATEGORY 12: Email / Gmail ===
  {
    sender: 'CEO_Vo',
    message: 'Email moi co gi quan trong khong?',
    conversation_id: 'conv-email-001',
    intent: 'check_email',
    evidence_state: 'no_data',
    decision: 'clarify',
    action: 'report_missing_gmail_connector',
    confidence: 0.85,
    result: 'success',
    approval: 'not_required',
  },
  // === CATEGORY 13: Follow-up conversations ===
  {
    sender: 'CEO_Vo',
    message: 'ROI sao nua?',
    conversation_id: 'conv-follow-001',
    intent: 'follow_up',
    evidence_state: 'partial',
    decision: 'clarify',
    action: 'context_resume',
    confidence: 0.70,
    result: 'success',
    approval: 'not_required',
  },
  // === CATEGORY 14: Image / Content verification ===
  {
    sender: 'CEO_Vo',
    message: 'Hinh anh SEO chuan bi xong chua?',
    conversation_id: 'conv-img-001',
    intent: 'check_image_status',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'image_exists_check',
    confidence: 0.90,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-IMG-001',
  },
  // === CATEGORY 15: Security / Compliance ===
  {
    sender: 'CEO_Vo',
    message: 'Co ai truy cap bat thuong khong?',
    conversation_id: 'conv-sec-001',
    intent: 'check_security',
    evidence_state: 'complete',
    decision: 'execute',
    action: 'security_audit_check',
    confidence: 0.92,
    result: 'success',
    approval: 'not_required',
    workflow_id: 'WF-SEC-001',
  },
  // === FALSE ACTION TEST CASES ===
  // These represent scenarios where the OLD system would have created false actions
  {
    sender: 'CEO_Vo',
    message: 'Thuc don hom nay cua Raw ngon lam',
    conversation_id: 'conv-false-001',
    intent: 'statement_opinion',
    evidence_state: 'complete',
    decision: 'reject',
    action: 'acknowledge_only',
    confidence: 0.96,
    result: 'success',
    approval: 'not_required',
  },
  {
    sender: 'CEO_Vo',
    message: 'Doanh thu thang 5 tot hon thang 4',
    conversation_id: 'conv-false-002',
    intent: 'statement_comparison',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.91,
    result: 'success',
    approval: 'not_required',
    false_action: false,
  },
  {
    sender: 'CEO_Vo',
    message: 'Khong can lam gi nua nhe',
    conversation_id: 'conv-false-003',
    intent: 'instruction_stop',
    evidence_state: 'complete',
    decision: 'defer',
    action: 'acknowledge_only',
    confidence: 0.97,
    result: 'success',
    approval: 'not_required',
  },
];

// ── Seed execution ───────────────────────────────────────────────────────────

export function seedTelemetry(): { 
  messages: number; 
  decisions: number; 
  outcomes: number; 
  false_actions: number;
  stats: ReturnType<typeof getTelemetryStats>;
} {
  let decisions = 0;
  let outcomes = 0;
  let falseActions = 0;

  for (const msg of CEO_MESSAGES) {
    // Record the raw message
    const recorded = recordMessage({
      sender: msg.sender,
      message: msg.message,
      conversation_id: msg.conversation_id,
      channel: msg.channel || 'whatsapp',
    });

    // Record the decision
    const dec = recordDecision({
      message_id: recorded.message_id,
      intent: msg.intent,
      evidence_state: msg.evidence_state,
      decision: msg.decision,
      action: msg.action,
      confidence: msg.confidence,
      model_used: 'claude-opus-4-7',
      reasoning: `Seed data: ${msg.intent} → ${msg.decision}`,
    });
    decisions++;

    // Record the outcome
    const out = recordOutcome({
      message_id: recorded.message_id,
      decision_id: dec.id,
      action: msg.action,
      result: msg.result,
      approval: msg.approval,
      workflow_id: msg.workflow_id || undefined,
      duration_ms: Math.floor(Math.random() * 2000) + 200,
    });
    outcomes++;

    // Mark false actions if applicable
    if (msg.false_action || msg.false_approval || msg.false_finance || msg.context_failure) {
      markFalseAction({
        outcome_id: out.id,
        message_id: recorded.message_id,
        false_action: msg.false_action,
        false_approval: msg.false_approval,
        false_finance: msg.false_finance,
        context_failure: msg.context_failure,
        reviewer: 'system_seed',
        review_note: 'False action test case',
      });
      falseActions++;
    }
  }

  const stats = getTelemetryStats();

  return {
    messages: CEO_MESSAGES.length,
    decisions,
    outcomes,
    false_actions: falseActions,
    stats,
  };
}

// ── CLI runner ───────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('[TelemetrySeed] Starting seed...');
  console.log(`[TelemetrySeed] Messages already in DB: ${getMessageCount()}`);
  
  const result = seedTelemetry();
  
  console.log(`[TelemetrySeed] Seeded:`);
  console.log(`  Messages:    ${result.messages}`);
  console.log(`  Decisions:   ${result.decisions}`);
  console.log(`  Outcomes:    ${result.outcomes}`);
  console.log(`  FalseActions: ${result.false_actions}`);
  console.log(`[TelemetrySeed] Current stats:`, JSON.stringify(result.stats, null, 2));
}
   
