/**
 * Intent Classifier — Mi Executive OS WS1
 *
 * Classifies CEO messages (Vietnamese + English) into structured intents.
 * Used by BrainRouter to select the optimal brain and context strategy.
 */

export type IntentDomain =
  // Core executive
  | 'briefing'           // "hôm nay làm gì" — daily briefing
  | 'task_create'        // "tạo task" — create task
  | 'task_query'         // "task nào overdue" — query tasks
  | 'project_status'     // "dự án X đang thế nào" — project health
  // Communication
  | 'email_read'         // "email quan trọng" — read emails
  | 'email_send'         // "gửi email cho" — send email
  | 'email_draft'        // "soạn email" — draft email
  | 'calendar_view'      // "lịch hôm nay" — view calendar
  | 'calendar_create'    // "tạo meeting" — create event
  | 'whatsapp_summary'   // "tóm tắt whatsapp" — WA message summary
  // Business data
  | 'data_analysis'      // "phân tích doanh thu" — run analytics
  | 'data_question'      // "ngày nào cao nhất" — query existing analysis
  | 'report_generate'    // "tạo report" — generate report
  // Compliance & legal
  | 'compliance_query'   // "sales tax Texas" — US compliance question
  | 'labor_law'          // "lương tối thiểu CA" — labor law question
  | 'payroll_question'   // "payroll risk" — payroll/HR question
  // Operations
  | 'store_info'         // "Bakudan địa chỉ" — store information
  | 'file_search'        // "tìm file" — search files
  | 'file_send'          // "tìm và gửi file" — find + send file
  | 'drive_upload'       // "upload lên Drive" — upload file
  // Engineering
  | 'code_review'        // "review code" — code review
  | 'code_debug'         // "bug này là gì" — debugging
  | 'code_explain'       // "giải thích đoạn code" — explain code
  // Health & personal
  | 'health_query'       // "sức khỏe" — health data
  | 'reminder_set'       // "nhắc anh" — set reminder
  | 'memory_save'        // "nhớ cái này" — save to memory
  | 'memory_query'       // "anh đã nói gì về" — recall memory
  // General
  | 'approval_action'    // "approve / reject" — approval commands
  | 'skill_request'      // "tạo content", "SEO analysis" — skill call
  | 'chat';              // general conversation fallback

export type BrainName =
  | 'qwen-fast'       // qwen3:1.7b — simple, quick
  | 'qwen-balanced'   // qwen3:8b  — general purpose
  | 'qwen-deep'       // qwen3:14b — complex reasoning
  | 'qwen-coder'      // qwen2.5-coder:7b — engineering
  | 'compliance'      // compliance DB + qwen
  | 'data-analyst'    // DataAnalystEngine (already wired)
  | 'skill-router'    // delegate to skill registry
  | 'claude-api';     // Claude API (if key configured)

export interface ClassifiedIntent {
  domain: IntentDomain;
  brain: BrainName;
  confidence: number;           // 0-1
  requires_live_data: boolean;  // pull connectors?
  requires_compliance_db: boolean;
  requires_data_analyst: boolean;
  requires_approval: boolean;
  is_write_action: boolean;
  jurisdiction?: 'texas' | 'california' | 'federal' | 'san-antonio' | 'stockton';
  store?: 'bakudan' | 'raw';
  language: 'vi' | 'en' | 'mixed';
  raw: string;
}

// ── Language detection ────────────────────────────────────────────────────
function detectLanguage(text: string): 'vi' | 'en' | 'mixed' {
  const viChars = (text.match(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi) || []).length;
  const words = text.split(/\s+/).length;
  const viRatio = viChars / Math.max(words, 1);
  if (viRatio > 0.5) return 'vi';
  if (viRatio > 0.1) return 'mixed';
  return 'en';
}

// ── Store detection ───────────────────────────────────────────────────────
function detectStore(t: string): 'bakudan' | 'raw' | undefined {
  if (/bakudan|ramen|san antonio|texas|tx\b/i.test(t)) return 'bakudan';
  if (/raw sushi|sushi|stockton|california|ca\b/i.test(t)) return 'raw';
  return undefined;
}

// ── Jurisdiction detection ─────────────────────────────────────────────
function detectJurisdiction(t: string): ClassifiedIntent['jurisdiction'] {
  if (/san antonio|bexar/i.test(t)) return 'san-antonio';
  if (/stockton|san joaquin/i.test(t)) return 'stockton';
  if (/texas|\btx\b|lone star/i.test(t)) return 'texas';
  if (/california|\bca\b|golden state/i.test(t)) return 'california';
  if (/federal|irs|futa|fica/i.test(t)) return 'federal';
  // Derive from store
  const store = detectStore(t);
  if (store === 'bakudan') return 'texas';
  if (store === 'raw') return 'california';
  return undefined;
}

// ── Main classifier ───────────────────────────────────────────────────────
export function classifyIntent(text: string): ClassifiedIntent {
  const t = text.toLowerCase().trim();
  const lang = detectLanguage(text);
  const store = detectStore(t);
  const jurisdiction = detectJurisdiction(t);

  const base: Omit<ClassifiedIntent, 'domain' | 'brain' | 'confidence'> = {
    requires_live_data: false,
    requires_compliance_db: false,
    requires_data_analyst: false,
    requires_approval: false,
    is_write_action: false,
    jurisdiction,
    store,
    language: lang,
    raw: text,
  };

  // ── Approval commands (highest priority) ─────────────────────────────
  if (/^(approve|reject|\/mi\s+approve|\/mi\s+reject)/i.test(t)) {
    return { ...base, domain: 'approval_action', brain: 'qwen-fast', confidence: 0.99, requires_approval: false };
  }

  // ── Memory commands ───────────────────────────────────────────────────
  if (/nhớ|lưu|remember this|save this/i.test(t) && !/nhắc/i.test(t)) {
    return { ...base, domain: 'memory_save', brain: 'qwen-fast', confidence: 0.9 };
  }
  if (/nhớ lại|đã nói|recall|what.*said|memory.*about/i.test(t)) {
    return { ...base, domain: 'memory_query', brain: 'qwen-balanced', confidence: 0.85 };
  }

  // ── Reminders ─────────────────────────────────────────────────────────
  if (/nhắc|remind/i.test(t) && /\d|phút|giờ|ngày|minute|hour|day|after|every|lúc/i.test(t)) {
    return { ...base, domain: 'reminder_set', brain: 'qwen-fast', confidence: 0.9 };
  }

  // ── US Compliance / Legal / Tax (BEFORE general chat) ─────────────────
  const complianceTriggers = [
    /sales tax|thuế bán hàng|thuế doanh thu/i,
    /minimum wage|lương tối thiểu|minimum pay/i,
    /overtime|làm thêm giờ/i,
    /payroll tax|payroll risk|thuế lương/i,
    /labor law|luật lao động/i,
    /meal break|rest break|nghỉ ca/i,
    /worker.*comp|workers comp/i,
    /permits?|giấy phép/i,
    /compliance|tuân thủ pháp luật/i,
    /tip credit|tip pool|tiền tip/i,
    /fica|futa|edd|twc|cdtfa/i,
    /sick leave|nghỉ ốm|paid leave/i,
    /business license|giấy phép kinh doanh/i,
    /health inspection|food safety permit/i,
    /alcohol.*permit|liquor.*license/i,
  ];
  if (complianceTriggers.some(r => r.test(t))) {
    const isPayroll = /payroll|lương|tip|fica|futa/i.test(t);
    const isLabor = /labor|overtime|wage|break|leave/i.test(t);
    return {
      ...base,
      domain: isPayroll ? 'payroll_question' : isLabor ? 'labor_law' : 'compliance_query',
      brain: 'compliance',
      confidence: 0.92,
      requires_compliance_db: true,
    };
  }

  // ── Data Analysis ─────────────────────────────────────────────────────
  if (/phân tích|analyze|doanh thu|revenue|sales|bán hàng|thống kê|analytics/i.test(t)) {
    return { ...base, domain: 'data_analysis', brain: 'data-analyst', confidence: 0.9, requires_data_analyst: true };
  }
  if (/ngày nào|giờ nào|món nào|top.*item|peak hour|best day|slowest|doanh thu.*cao|cơ hội/i.test(t) && /dữ liệu|data|file|csv|excel/i.test(t)) {
    return { ...base, domain: 'data_question', brain: 'data-analyst', confidence: 0.85, requires_data_analyst: true };
  }

  // ── Engineering / Code ────────────────────────────────────────────────
  if (/review.*code|code.*review|kiểm tra code/i.test(t)) {
    return { ...base, domain: 'code_review', brain: 'qwen-coder', confidence: 0.9 };
  }
  if (/debug|bug|lỗi.*code|error.*in code|fix.*code|sửa.*code/i.test(t)) {
    return { ...base, domain: 'code_debug', brain: 'qwen-coder', confidence: 0.88 };
  }
  if (/giải thích.*code|explain.*code|code.*này.*làm gì|what does.*code/i.test(t)) {
    return { ...base, domain: 'code_explain', brain: 'qwen-coder', confidence: 0.85 };
  }

  // ── Briefing / Daily overview ─────────────────────────────────────────
  if (/hôm nay.*làm gì|what.*do today|today.*agenda|daily brief|tóm tắt.*hôm nay|morning brief/i.test(t)) {
    return { ...base, domain: 'briefing', brain: 'qwen-balanced', confidence: 0.95, requires_live_data: true };
  }

  // ── Task management ───────────────────────────────────────────────────
  if (/tạo task|create task|add task|thêm task/i.test(t)) {
    return { ...base, domain: 'task_create', brain: 'qwen-balanced', confidence: 0.9, is_write_action: true, requires_approval: true };
  }
  if (/task.*overdue|overdue.*task|quá hạn|trễ hạn|task.*nào/i.test(t)) {
    return { ...base, domain: 'task_query', brain: 'qwen-balanced', confidence: 0.88, requires_live_data: true };
  }
  if (/dự án|project.*status|project.*health|issue.*từ team/i.test(t)) {
    return { ...base, domain: 'project_status', brain: 'qwen-balanced', confidence: 0.88, requires_live_data: true };
  }

  // ── Email ─────────────────────────────────────────────────────────────
  if (/gửi email|send email|email.*cho/i.test(t)) {
    return { ...base, domain: 'email_send', brain: 'qwen-balanced', confidence: 0.9, is_write_action: true, requires_approval: true };
  }
  if (/soạn email|draft email|viết email/i.test(t)) {
    return { ...base, domain: 'email_draft', brain: 'qwen-balanced', confidence: 0.88 };
  }
  if (/email.*quan trọng|important.*email|inbox|gmail/i.test(t)) {
    return { ...base, domain: 'email_read', brain: 'qwen-balanced', confidence: 0.88, requires_live_data: true };
  }

  // ── Calendar ──────────────────────────────────────────────────────────
  if (/tạo meeting|create meeting|book.*meeting|schedule.*meeting|tạo lịch/i.test(t)) {
    return { ...base, domain: 'calendar_create', brain: 'qwen-balanced', confidence: 0.9, is_write_action: true, requires_approval: true };
  }
  if (/lịch.*hôm nay|calendar|sự kiện|meeting.*hôm nay|today.*event/i.test(t)) {
    return { ...base, domain: 'calendar_view', brain: 'qwen-fast', confidence: 0.88, requires_live_data: true };
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────
  if (/tóm tắt.*whatsapp|whatsapp.*summary|tin nhắn.*hôm nay/i.test(t)) {
    return { ...base, domain: 'whatsapp_summary', brain: 'qwen-balanced', confidence: 0.9 };
  }

  // ── File operations ───────────────────────────────────────────────────
  if (/tìm.*file.*gửi|find.*file.*send|file.*rồi.*gửi/i.test(t)) {
    return { ...base, domain: 'file_send', brain: 'qwen-balanced', confidence: 0.88, is_write_action: true, requires_approval: true };
  }
  if (/tìm file|find file|search.*file|file.*nào/i.test(t)) {
    return { ...base, domain: 'file_search', brain: 'qwen-fast', confidence: 0.88 };
  }
  if (/upload.*drive|tải lên drive/i.test(t)) {
    return { ...base, domain: 'drive_upload', brain: 'qwen-fast', confidence: 0.88, is_write_action: true, requires_approval: true };
  }

  // ── Health ────────────────────────────────────────────────────────────
  if (/sức khỏe|health|nhịp tim|heart rate|bước chân|steps|giấc ngủ|sleep/i.test(t)) {
    return { ...base, domain: 'health_query', brain: 'qwen-fast', confidence: 0.85, requires_live_data: true };
  }

  // ── Skill requests (content, SEO, marketing) ─────────────────────────
  if (/tạo content|create content|viết.*bài|write.*post|seo|marketing|quảng cáo/i.test(t)) {
    return { ...base, domain: 'skill_request', brain: 'skill-router', confidence: 0.85 };
  }

  // ── Store info ────────────────────────────────────────────────────────
  if (/địa chỉ|address|giờ mở cửa|hours|phone|số điện thoại|store info/i.test(t) && store) {
    return { ...base, domain: 'store_info', brain: 'qwen-fast', confidence: 0.88 };
  }

  // ── Report generation ─────────────────────────────────────────────────
  if (/tạo report|generate report|báo cáo|report.*doanh thu/i.test(t)) {
    return { ...base, domain: 'report_generate', brain: 'qwen-balanced', confidence: 0.88, requires_data_analyst: true };
  }

  // ── Default: general chat ─────────────────────────────────────────────
  const isComplex = text.split(/\s+/).length > 30 || /why|how|analyze|compare|explain|tại sao|so sánh|phân tích/i.test(t);
  return {
    ...base,
    domain: 'chat',
    brain: isComplex ? 'qwen-deep' : 'qwen-balanced',
    confidence: 0.6,
  };
}
