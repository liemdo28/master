/**
 * Phase 9 — CEO Report Format
 * Every completed Work Order returns exactly 8 sections to CEO.
 * Format is WhatsApp-optimized (markdown bold, no HTML).
 *
 * Sections:
 *   1. Anh yêu cầu gì
 *   2. Mi đã hiểu gì
 *   3. Mi đã làm gì
 *   4. Kết quả
 *   5. Bằng chứng
 *   6. Rủi ro còn lại
 *   7. Việc cần anh duyệt
 *   8. Confidence score
 */

import { WorkOrder, WorkOrderResult } from './work-order-engine';
import { CertificationResult } from './qa-certification-engine';

// Bundle type returned by getEvidenceBundle() shim
type EvidenceBundle = ReturnType<typeof import('./evidence-engine').getEvidenceBundle>;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CeoReportInput {
  wo: WorkOrder;
  result: WorkOrderResult;
  evidence: EvidenceBundle;
  certification: CertificationResult;
  actions_taken: string[];          // human-readable list of what agents did
  needs_approval: string[];         // list of pending items requiring CEO decision
  risks_remaining: string[];        // open issues that were not fixed
}

export interface CeoReport {
  work_order_id: string;
  generated_at: string;
  whatsapp_message: string;         // full 8-section formatted message
  sections: {
    s1_request: string;
    s2_understanding: string;
    s3_actions: string;
    s4_result: string;
    s5_evidence: string;
    s6_risks: string;
    s7_approval_needed: string;
    s8_confidence: string;
  };
  report_path?: string;
}

// ── Section builders ──────────────────────────────────────────────────────────

function s1_request(wo: WorkOrder): string {
  return `*1️⃣ Anh yêu cầu gì*\n"${wo.raw_request}"`;
}

function s2_understanding(wo: WorkOrder): string {
  const intentMap: Record<string, string> = {
    audit_project:    'Kiểm tra toàn diện dự án, tìm lỗi, báo cáo',
    fix_bug:          'Tìm và sửa lỗi cụ thể (nếu an toàn)',
    build_feature:    'Lên kế hoạch và xây dựng tính năng mới',
    deploy_release:   'Triển khai phiên bản mới lên production',
    rollback:         'Khôi phục phiên bản trước do sự cố',
    check_status:     'Kiểm tra trạng thái hệ thống hiện tại',
    monitor_runtime:  'Theo dõi runtime, log, và hiệu suất',
    search_knowledge: 'Tìm kiếm thông tin trong cơ sở tri thức',
    create_report:    'Tổng hợp và tạo báo cáo',
    send_message:     'Soạn và gửi thông điệp',
  };
  const intent = wo.intent?.intent || 'unknown';
  const understood = intentMap[intent] || `Xử lý yêu cầu: ${intent}`;
  const target = wo.target_project ? ` cho *${wo.target_project.toUpperCase()}*` : '';
  return `*2️⃣ Mi đã hiểu gì*\n${understood}${target}\nMức độ ưu tiên: ${wo.priority} | Rủi ro: L${wo.intent?.risk_level || 1}`;
}

function s3_actions(actions: string[]): string {
  if (actions.length === 0) return `*3️⃣ Mi đã làm gì*\nKhông có hành động nào được thực hiện`;
  const list = actions.slice(0, 8).map((a, i) => `${i + 1}. ${a}`).join('\n');
  return `*3️⃣ Mi đã làm gì*\n${list}`;
}

function s4_result(result: WorkOrderResult, cert: CertificationResult): string {
  const verdictLabel: Record<string, string> = {
    DELIVERED:        '✅ Hoàn thành',
    PARTIAL:          '⚠️ Hoàn thành một phần',
    APPROVAL_REQUIRED:'⏳ Đang chờ anh duyệt',
    FAILED:           '❌ Thất bại',
    CANCELLED:        '🚫 Đã huỷ',
  };
  const label = verdictLabel[result.verdict] || result.verdict;
  const certLine = cert.cert_id ? `\n🏆 Certification: ${cert.cert_id}` : '';
  return `*4️⃣ Kết quả*\n${label}${certLine}\n${result.summary?.slice(0, 120) || ''}`;
}

function s5_evidence(evidence: EvidenceBundle): string {
  const parts: string[] = [];

  if (evidence.files_inspected.length > 0) {
    parts.push(`📁 Đã kiểm tra ${evidence.files_inspected.length} file`);
    evidence.files_inspected.slice(0, 3).forEach((e: any) => parts.push(`   • ${e.filename || e.title}: ${e.outcome}`));
  }
  if (evidence.commands_executed.length > 0) {
    parts.push(`⚙️ Đã chạy ${evidence.commands_executed.length} lệnh`);
    evidence.commands_executed.slice(0, 3).forEach((e: any) => parts.push(`   • ${e.title.slice(0, 50)}`));
  }
  if (evidence.test_outputs.length > 0) {
    const passed = evidence.test_outputs.filter((e: any) => e.outcome === 'pass').length;
    parts.push(`🧪 Tests: ${passed}/${evidence.test_outputs.length} PASS`);
  }
  if (evidence.errors_found.length > 0) {
    parts.push(`🔴 Lỗi phát hiện: ${evidence.errors_found.length}`);
    evidence.errors_found.slice(0, 3).forEach((e: any) => parts.push(`   • [${(e.severity || 'error').toUpperCase()}] ${e.title.slice(0, 60)}`));
  }
  if (evidence.changes_made.length > 0) {
    parts.push(`✏️ Thay đổi: ${evidence.changes_made.length} file`);
    evidence.changes_made.slice(0, 3).forEach((e: any) => parts.push(`   • ${e.filename || e.title}`));
  }
  if (evidence.artifacts.length > 0) {
    parts.push(`📄 Artifacts: ${evidence.artifacts.map((a: any) => a.filename || a.title).join(', ')}`);
  }

  if (parts.length === 0) {
    parts.push(`Tổng cộng ${evidence.total_items} mục bằng chứng`);
  }

  return `*5️⃣ Bằng chứng*\n${parts.join('\n')}`;
}

function s6_risks(risks: string[], cert: CertificationResult): string {
  const gateRisks = cert.gates
    .filter(g => g.status === 'FAIL' || g.status === 'WARN')
    .map(g => `${g.name}: ${g.details}`);
  const allRisks = [
    ...risks,
    ...gateRisks.slice(0, 3),
  ].filter(Boolean);

  if (allRisks.length === 0) return `*6️⃣ Rủi ro còn lại*\nKhông có rủi ro tồn đọng ✅`;
  const list = allRisks.slice(0, 5).map(r => `• ${r.slice(0, 80)}`).join('\n');
  return `*6️⃣ Rủi ro còn lại*\n${list}`;
}

function s7_approvalNeeded(items: string[]): string {
  if (items.length === 0) return `*7️⃣ Việc cần anh duyệt*\nKhông có — Mi đã xử lý tất cả ✅`;
  const list = items.slice(0, 5).map((item, i) => `${i + 1}. ${item.slice(0, 80)}`).join('\n');
  return `*7️⃣ Việc cần anh duyệt*\n${list}`;
}

function s8_confidence(cert: CertificationResult): string {
  const score = cert.confidence_score;
  const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  let label: string;
  if (score >= 90) label = '✅ Đủ điều kiện production';
  else if (score >= 70) label = '⚠️ Chưa đủ 90% — cần cải thiện';
  else label = '❌ Dưới ngưỡng tối thiểu — cần kiểm tra lại';

  const gatesSummary = cert.gates
    .map((g, index) => `${g.status === 'PASS' ? '✅' : g.status === 'FAIL' ? '❌' : '⚠️'} G${index + 1}: ${g.name}`)
    .join('\n');

  return `*8️⃣ Confidence Score*\n${bar} ${score}%\n${label}\n\n${gatesSummary}`;
}

// ── Main report builder ───────────────────────────────────────────────────────

export function buildCeoReport(input: CeoReportInput): CeoReport {
  const { wo, result, evidence, certification, actions_taken, needs_approval, risks_remaining } = input;

  const sections = {
    s1_request:       s1_request(wo),
    s2_understanding: s2_understanding(wo),
    s3_actions:       s3_actions(actions_taken),
    s4_result:        s4_result(result, certification),
    s5_evidence:      s5_evidence(evidence),
    s6_risks:         s6_risks(risks_remaining, certification),
    s7_approval_needed: s7_approvalNeeded(needs_approval),
    s8_confidence:    s8_confidence(certification),
  };

  const divider = '\n─────────────────\n';
  const whatsapp_message = [
    `📋 *Work Order ${wo.request_id}*`,
    divider,
    sections.s1_request,
    sections.s2_understanding,
    sections.s3_actions,
    sections.s4_result,
    divider,
    sections.s5_evidence,
    sections.s6_risks,
    sections.s7_approval_needed,
    divider,
    sections.s8_confidence,
  ].join('\n\n');

  return {
    work_order_id: wo.request_id,
    generated_at: new Date().toISOString(),
    whatsapp_message,
    sections,
  };
}

// ── Quick builder for orchestrator ────────────────────────────────────────────

export function quickCeoReport(
  wo: WorkOrder,
  result: WorkOrderResult,
  evidence: EvidenceBundle,
  certification: CertificationResult,
): string {
  // Derive actions_taken from evidence
  const actions: string[] = [
    ...evidence.commands_executed.map((e: any) => e.title),
    ...evidence.files_inspected.map((e: any) => `Kiểm tra file: ${e.filename || e.title}`),
    ...evidence.test_outputs.map((e: any) => e.title),
    ...evidence.changes_made.map((e: any) => `Sửa: ${e.filename || e.title}`),
  ].slice(0, 8);

  const risks = [
    ...evidence.errors_found.filter((e: any) => e.severity !== 'info').map((e: any) => e.title || e.summary),
    ...certification.gates
      .filter(g => g.status === 'FAIL')
      .map(g => `${g.name}: ${g.details}`),
  ].slice(0, 5);

  const approvals = result.needs_approval || [];

  const report = buildCeoReport({ wo, result, evidence, certification, actions_taken: actions, needs_approval: approvals, risks_remaining: risks });
  return report.whatsapp_message;
}
