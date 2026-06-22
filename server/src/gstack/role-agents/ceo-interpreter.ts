/**
 * CEO Interpreter Agent
 * Translates raw CEO natural language into structured scope + clarifications.
 * First agent in every pipeline — sets context for all downstream agents.
 */

import { WorkOrder } from '../work-order-engine';
import { logAction } from '../execution-ledger';

export interface InterpretResult {
  understood_request: string;
  scope: string[];
  out_of_scope: string[];
  clarifications_needed: string[];
  confidence: number;
  language: 'vi' | 'en' | 'mixed';
}

const SCOPE_MAP: Record<string, string[]> = {
  fix_bug: ['identify root cause', 'apply safe patch', 'verify fix with tests'],
  audit_project: ['scan source code', 'identify errors', 'categorize severity', 'document findings'],
  build_feature: ['define API contract', 'implement logic', 'write tests', 'document'],
  deploy_release: ['verify QA gate', 'prepare rollback', 'execute deployment', 'post-deploy check'],
  check_status: ['health sweep', 'PM2 status', 'runtime metrics', 'format report'],
  monitor_runtime: ['collect metrics', 'check error rates', 'alert on anomalies'],
  create_report: ['gather data', 'compile findings', 'format for CEO'],
  search_knowledge: ['query knowledge universe', 'rank results', 'summarize'],
  send_message: ['draft message', 'confirm recipient', 'await approval', 'send'],
  rollback: ['identify rollback point', 'verify state', 'execute rollback', 'confirm'],
  unknown: ['understand request', 'ask for clarification'],
};

function detectLanguage(text: string): 'vi' | 'en' | 'mixed' {
  const viWords = (text.match(/[àáảãạăắặẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi) || []).length;
  const enWords = (text.match(/\b(the|is|are|was|has|have|do|does|will|can|should|would|fix|check|build|deploy)\b/gi) || []).length;
  if (viWords > 3) return enWords > 2 ? 'mixed' : 'vi';
  return 'en';
}

export async function interpret(wo: WorkOrder): Promise<InterpretResult> {
  const intent = wo.intent.intent;
  const target = wo.target_project || 'all systems';
  const lang = detectLanguage(wo.raw_request);

  const scope = SCOPE_MAP[intent] || SCOPE_MAP['unknown'];

  const clarifications: string[] = [];
  if (intent === 'unknown') clarifications.push('Cần làm rõ yêu cầu của CEO');
  if (intent === 'fix_bug' && !wo.target_project) clarifications.push('Chưa xác định project cụ thể cần fix');
  if (intent === 'deploy_release' && !wo.target_project) clarifications.push('Cần xác định phiên bản cần deploy');

  const understood = buildUnderstoodStatement(intent, target, wo.raw_request, lang);

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'ceo_interpreter',
    action_type: 'interpret_request',
    target,
    evidence: understood,
    verdict: clarifications.length === 0 ? 'PASS' : 'PENDING',
    detail: `Intent: ${intent} | Language: ${lang} | Scope items: ${scope.length}`,
  });

  return {
    understood_request: understood,
    scope,
    out_of_scope: ['unrelated system changes', 'financial transactions', 'external communications without approval'],
    clarifications_needed: clarifications,
    confidence: wo.intent.confidence,
    language: lang,
  };
}

function buildUnderstoodStatement(intent: string, target: string, raw: string, lang: 'vi' | 'en' | 'mixed'): string {
  const statements: Record<string, string> = {
    fix_bug: `CEO muốn fix lỗi trên ${target}. Mi sẽ: quét mã nguồn, xác định nguyên nhân, áp dụng bản vá an toàn, chạy test, báo cáo kết quả.`,
    audit_project: `CEO muốn kiểm tra ${target}. Mi sẽ: scan toàn bộ source code, phân loại lỗi theo mức độ nghiêm trọng, fix lỗi an toàn, chạy QA, báo cáo.`,
    build_feature: `CEO muốn xây dựng tính năng mới trên ${target}. Mi sẽ: định nghĩa API, implement, test, và staging để CEO review.`,
    deploy_release: `CEO muốn deploy ${target} lên production. Mi sẽ: kiểm tra QA gate, chuẩn bị rollback, chờ CEO approve, và theo dõi sau deploy.`,
    check_status: `CEO muốn kiểm tra trạng thái ${target}. Mi sẽ: quét health tất cả service, collect metrics, báo cáo tóm tắt.`,
    monitor_runtime: `CEO muốn theo dõi runtime ${target}. Mi sẽ: collect metrics, kiểm tra error rate, alert nếu có vấn đề.`,
    create_report: `CEO muốn tạo báo cáo về ${target}. Mi sẽ: tổng hợp dữ liệu từ Knowledge Universe và định dạng báo cáo.`,
    search_knowledge: `CEO muốn tìm kiếm thông tin về ${target}. Mi sẽ: query Knowledge Universe và tóm tắt kết quả.`,
    send_message: `CEO muốn gửi tin nhắn. Mi sẽ: soạn thảo, xác nhận nội dung với CEO, rồi gửi sau khi được approve.`,
    rollback: `CEO muốn rollback ${target}. Mi sẽ: xác định điểm rollback, verify trạng thái, thực thi sau khi được CEO approve.`,
    unknown: `Mi chưa hiểu rõ yêu cầu. Vui lòng cung cấp thêm thông tin về: "${raw.slice(0, 80)}"`,
  };
  return statements[intent] || statements['unknown'];
}
