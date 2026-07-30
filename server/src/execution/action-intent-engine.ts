/**
 * DEV5 — Phase E1: Action Intent Engine
 * 
 * Classifies every CEO message into:
 *   1. informational_question — just wants info
 *   2. action_request — wants Mi to DO something
 *   3. approval_response — responding to pending approval
 *   4. followup — continuing a conversation
 *   5. dangerous_action — high-risk (deploy, delete, pay, submit)
 *   6. unknown_clarify — can't determine, must ask
 *
 * KEY: "t muốn post 1 bài trên Raw website, thu hút SEO"
 * is NOT informational — it is ACTION REQUEST triggering workflow creation.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type MessageClass =
  | 'informational_question'
  | 'action_request'
  | 'approval_response'
  | 'followup'
  | 'dangerous_action'
  | 'unknown_clarify';

export type BusinessDomain =
  | 'website_marketing'
  | 'seo_content'
  | 'social_media'
  | 'email_comms'
  | 'finance_qb'
  | 'dashboard_monitoring'
  | 'bug_fix'
  | 'campaign'
  | 'flyer_design'
  | 'video_production'
  | 'google_sheets'
  | 'deployment'
  | 'payroll'
  | 'calendar'
  | 'inventory'
  | 'general';

export type WorkflowType =
  | 'SEO_CONTENT'
  | 'WEBSITE_POST'
  | 'SOCIAL_POST'
  | 'EMAIL_DRAFT'
  | 'DASHBOARD_AUDIT'
  | 'BUG_FIX'
  | 'FINANCE_REPORT'
  | 'QB_CHECK'
  | 'CAMPAIGN'
  | 'FLYER'
  | 'VIDEO'
  | 'GOOGLE_SHEET_UPDATE'
  | 'GENERAL_TASK';

export interface ActionIntent {
  message_class: MessageClass;
  domain: BusinessDomain;
  workflow_types: WorkflowType[];
  target_entity: string | undefined;
  approval_required: boolean;
  confidence: number;
  action_verbs: string[];
  entity_mentions: string[];
  raw_keywords: string[];
}

// ── Entity resolution ──────────────────────────────────────────────────────

export interface EntityDefinition {
  aliases: RegExp[];
  canonical_name: string;
  domain_hints: string[];
  website?: string;
}

const KNOWN_ENTITIES: EntityDefinition[] = [
  {
    aliases: [/\braw\b|raw\s*sushi|rawsushi|rawsushibar|raw\s*sushi\s*bar|raw\s*seo/],
    canonical_name: 'Raw Sushi',
    domain_hints: ['website_marketing', 'seo_content', 'social_media', 'campaign'],
    website: 'rawsushibar.com',
  },
  {
    aliases: [/bakudan|bakudan\s*ramen|bakudan\s*bar/],
    canonical_name: 'Bakudan Ramen',
    domain_hints: ['website_marketing', 'seo_content', 'social_media', 'campaign', 'flyer_design'],
    website: 'bakudanramen.com',
  },
  {
    aliases: [/stone\s*oak/],
    canonical_name: 'Stone Oak',
    domain_hints: ['store_ops', 'campaign', 'flyer_design'],
  },
  {
    aliases: [/bandera/],
    canonical_name: 'Bandera',
    domain_hints: ['store_ops', 'campaign', 'flyer_design'],
  },
  { aliases: [/rim\b/], canonical_name: 'Rim', domain_hints: ['store_ops'] },
  { aliases: [/maria/], canonical_name: 'Maria', domain_hints: ['email_comms'] },
  {
    aliases: [/doordash|door\s*dash/],
    canonical_name: 'DoorDash',
    domain_hints: ['campaign', 'dashboard_monitoring'],
  },
  {
    aliases: [/qb|quickbooks|quick\s*books/],
    canonical_name: 'QuickBooks',
    domain_hints: ['finance_qb'],
  },
  {
    aliases: [/payroll|luong|lương|salary|nhan\s*vien|nhân\s*viên/],
    canonical_name: 'Payroll',
    domain_hints: ['payroll'],
  },
  {
    aliases: [/calendar|lich|lịch|schedule|cuoc\s*hop|cuộc\s*họp|appointment/],
    canonical_name: 'Calendar',
    domain_hints: ['calendar'],
  },
  {
    aliases: [/inventory|ton\s*kho|tồn\s*kho|kho\s*hang|kho\s*hàng/],
    canonical_name: 'Inventory',
    domain_hints: ['inventory'],
  },
  {
    aliases: [/budget|ngan\s*sach|ngân\s*sách/],
    canonical_name: 'Budget',
    domain_hints: ['finance_qb'],
  },
  {
    aliases: [/mi-core|micore/],
    canonical_name: 'Mi-Core',
    domain_hints: ['bug_fix', 'deployment'],
  },
  {
    aliases: [/whatsapp|wa\s*gateway|whatsapp\s*gateway/],
    canonical_name: 'WhatsApp Gateway',
    domain_hints: ['bug_fix', 'deployment'],
  },
  {
    aliases: [/dashboard/],
    canonical_name: 'Dashboard',
    domain_hints: ['dashboard_monitoring'],
  },
];

export function resolveEntities(text: string): { entity: string | undefined; website: string | undefined } {
  const lower = text.toLowerCase();
  for (const ent of KNOWN_ENTITIES) {
    for (const alias of ent.aliases) {
      if (alias.test(lower)) {
        return { entity: ent.canonical_name, website: ent.website };
      }
    }
  }
  return { entity: undefined, website: undefined };
}

// ── Action verb detection ──────────────────────────────────────────────────

const ACTION_VERBS: Array<{ pattern: RegExp; verb: string }> = [
  { pattern: /\b(tao|tao\s*bai|viet|lam|dang\s*bai|post|upload)\b/, verb: 'create_post' },
  { pattern: /\b(gui|send|phat|chuyen)\b/, verb: 'send' },
  { pattern: /\b(sua|fix|khac\s*phuc|repair|patch)\b/, verb: 'fix' },
  { pattern: /\b(kiem\s*tra|check|review|audit|scan|inspect)\b/, verb: 'check' },
  { pattern: /\b(deploy|tri\s*en\s*khai|release|push|xuat\s*ban|publish)\b/, verb: 'deploy' },
  { pattern: /\b(xoa|delete|remove|clear|don)\b/, verb: 'delete' },
  { pattern: /\b(thiet\s*ke|design)\b/, verb: 'design' },
  { pattern: /\b(update|cap\s*nhat|sua\s*doi|modify|edit)\b/, verb: 'update' },
  { pattern: /\b(bao|báo|bao\s*cao|báo\s*cáo|tao\s*bao\s*cao|tạo\s*báo\s*cáo|report|xuat\s*bao\s*cao|xuất\s*báo\s*cáo)\b/, verb: 'report' },
  { pattern: /\b(truy\s*van|query|lookup|search|tim\s*kiem)\b/, verb: 'search' },
  { pattern: /\b(create|generate|build|make)\b/, verb: 'create' },
];

// ── Dangerous action patterns ──────────────────────────────────────────────

const DANGEROUS_PATTERNS: RegExp[] = [
  /\b(deploy|tri\s*en\s*khai).*(production|prod)\b/,
  /\b(submit|nop).*(tax|thue|bill|hoa\s*don)\b/,
  /\b(pay|thanhtoan|thanh\s*toan|tra\s*tien|pay\s*bill)\b/,
  /\b(delete\s*database|xoa\s*csdl|drop\s*table|truncate)\b/,
  /\b(send|gui).*(customer|khach\s*hang).*(email|tin\s*nhan)\b/,
  /\b(deploy\s*production|production\s*deploy|push\s*to\s*prod)\b/,
  /\b(submit\s*tax|nop\s*thue|tax\s*filing)\b/,
  /\b(pay\s*invoice|pay\s*bill|thanh\s*toan\s*hoa\s*don)\b/,
];

// ── Domain-specific patterns ───────────────────────────────────────────────

const SEO_CONTENT_PATTERNS: RegExp[] = [
  /\b(seo|seo\s*article|bai\s*seo)\b/,
  /\braw\s*seo\b/,
  /\b(post|dang\s*bai|publish|xuat\s*ban).*(website|trang|web)\b/,
  /\b(bai\s*viet|article|content|noi\s*dung).*(seo|website|web|post)\b/,
  /\b(tao|viet|write|create|generate).*(bai|article|content|post|seo)\b/,
  /\b(viet\s*bai|write\s*article|create\s*content|tao\s*content)\b/,
];

const CAMPAIGN_PATTERNS: RegExp[] = [
  /\b(campaign|chien\s*dich)\b/,
  /\b(tao|create|run|chay).*(campaign|chien\s*dich)\b/,
];

const FLYER_PATTERNS: RegExp[] = [
  /\b(flyer|poster|banner|infographic|tem\s*tri\s*an|menu)\b/,
];

const EMAIL_PATTERNS: RegExp[] = [
  /\b(email|gui\s*email|send\s*email|draft\s*email|gmail)\b/,
  /\b(gui|send|write|viet).*(email|mail|thu)\b/,
];

const VIDEO_PATTERNS: RegExp[] = [
  /\b(video|clip|reel|story|shorts|youtube)\b/,
];

const GOOGLE_SHEET_PATTERNS: RegExp[] = [
  /\b(google\s*sheet|sheet|bang\s*tinh|spreadsheet)\b/,
];

const FINANCE_PATTERNS: RegExp[] = [
  /\b(qb|quickbooks|tai\s*chinh|tài\s*chính|finance|p&l|bao\s*cao\s*tai\s*chinh|báo\s*cáo\s*tài\s*chính)\b/,
  /\b(doanh\s*thu|revenue|sales)\b/,
  /\b(chi\s*phi|chi\s*phí|expense|expenses|cost|costs|spend|spending)\b/,
  /\b(bill|hoa\s*don|invoice|receipt|phieu\s*thu)\b/,
];

// ── Domain classification ──────────────────────────────────────────────────

function classifyDomain(text: string, entity?: string): BusinessDomain {
  const lower = text.toLowerCase();

  if (SEO_CONTENT_PATTERNS.some(p => p.test(lower))) return 'seo_content';
  if (CAMPAIGN_PATTERNS.some(p => p.test(lower))) return 'campaign';
  if (FLYER_PATTERNS.some(p => p.test(lower))) return 'flyer_design';
  if (EMAIL_PATTERNS.some(p => p.test(lower))) return 'email_comms';
  if (VIDEO_PATTERNS.some(p => p.test(lower))) return 'video_production';
  if (GOOGLE_SHEET_PATTERNS.some(p => p.test(lower))) return 'google_sheets';
  if (FINANCE_PATTERNS.some(p => p.test(lower))) return 'finance_qb';

  if (entity) {
    const ent = KNOWN_ENTITIES.find(e => e.canonical_name === entity);
    if (ent && ent.domain_hints.length > 0) {
      return ent.domain_hints[0] as BusinessDomain;
    }
  }

  if (/\b(fix|sua|bug|error|crash|loi)\b/.test(lower)) return 'bug_fix';
  if (/\b(dashboard|dash|check.*status)\b/.test(lower)) return 'dashboard_monitoring';
  if (/\b(deploy|release|push)\b/.test(lower)) return 'deployment';
  if (/\b(post|website|publish|seo|article|bai)\b/.test(lower)) return 'website_marketing';

  return 'general';
}

function mapDomainToWorkflows(domain: BusinessDomain): WorkflowType[] {
  const map: Record<BusinessDomain, WorkflowType[]> = {
    seo_content:          ['SEO_CONTENT', 'WEBSITE_POST'],
    website_marketing:    ['WEBSITE_POST', 'SEO_CONTENT'],
    social_media:         ['SOCIAL_POST'],
    email_comms:          ['EMAIL_DRAFT'],
    finance_qb:           ['FINANCE_REPORT', 'QB_CHECK'],
    dashboard_monitoring: ['DASHBOARD_AUDIT'],
    bug_fix:              ['BUG_FIX'],
    campaign:             ['CAMPAIGN'],
    flyer_design:         ['FLYER'],
    video_production:     ['VIDEO'],
    google_sheets:        ['GOOGLE_SHEET_UPDATE'],
    deployment:           ['GENERAL_TASK'],
    payroll:              ['GENERAL_TASK'],
    calendar:             ['GENERAL_TASK'],
    inventory:            ['GENERAL_TASK'],
    general:              ['GENERAL_TASK'],
  };
  return map[domain] || ['GENERAL_TASK'];
}

function extractActionKeywords(text: string): string[] {
  const stopwords = new Set(['a', 'an', 'the', 'va', 'hoac', 'thi', 'de', 'cho', 'trong', 'cua', 'la', 'se', 'co', 'khong', 'nhu', 'khi', 'neu', 'anh', 'em', 'oi', 'roi', 'nao', 'gi', 'ko', 'ok', 'hay', 'di', 'tren', 'len', 'mot', 'cai', 'nay', 'do']);
  return text.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w)).slice(0, 15);
}

// ── Main classifier ────────────────────────────────────────────────────────

export function classifyActionIntent(rawMessage: string): ActionIntent {
  const lower = rawMessage.toLowerCase();
  const { entity } = resolveEntities(rawMessage);

  // 1. Dangerous actions FIRST
  if (DANGEROUS_PATTERNS.some(p => p.test(lower))) {
    return {
      message_class: 'dangerous_action',
      domain: 'deployment',
      workflow_types: ['GENERAL_TASK'],
      target_entity: entity,
      approval_required: true,
      confidence: 95,
      action_verbs: ['dangerous'],
      entity_mentions: entity ? [entity] : [],
      raw_keywords: extractActionKeywords(lower),
    };
  }

  // 2. Approval responses
  if (/^(approve|approved|ok\s*em|duyet|dong\s*y|chap\s*nhan|yes|ok\s*done|cancel|huy|reject|tu\s*choi|no)\b/i.test(lower.trim())) {
    return {
      message_class: 'approval_response',
      domain: 'general',
      workflow_types: [],
      target_entity: undefined,
      approval_required: false,
      confidence: 95,
      action_verbs: ['respond'],
      entity_mentions: [],
      raw_keywords: [lower.trim()],
    };
  }

  // 3. Detect action verbs
  const detectedVerbs: string[] = [];
  for (const av of ACTION_VERBS) {
    if (av.pattern.test(lower)) {
      detectedVerbs.push(av.verb);
    }
  }

  // 4. Classify domain
  const domain = classifyDomain(lower, entity);

  // 5. Determine informational vs action
  const hasCreationIntent = /\b(muon|muốn|want|t muon|muon tao|muốn tạo|muon viet|muốn viết|muon lam|muốn làm|muon post|muon dang|muon gui|muốn gửi|can|cần|please|lam gi|làm gì|lam on|làm ơn)\b/.test(lower);
  const isShorthandAction =
    domain === 'seo_content' ||
    (domain === 'email_comms' && !!entity) ||
    (domain === 'dashboard_monitoring' && /\bdashboard\b/.test(lower));
  const isActionRequest = detectedVerbs.length > 0 || hasCreationIntent || isShorthandAction;

  // 6. Informational question patterns
  const isInformational = (
    /\b(sao roi|sao rồi|the nao|thế nào|co gi|có gì|how|what|why|where|bao nhieu|bao nhiêu|status|health|check)\b/.test(lower) ||
    domain === 'finance_qb'
  )
    && !isActionRequest
    && !hasCreationIntent;

  let messageClass: MessageClass;
  if (isActionRequest) {
    messageClass = 'action_request';
  } else if (isInformational) {
    messageClass = 'informational_question';
  } else if (hasFollowupSignal(lower)) {
    messageClass = 'followup';
  } else {
    messageClass = 'unknown_clarify';
  }

  const needsApproval = messageClass === 'action_request';
  const workflowTypes = (messageClass === 'action_request' || (messageClass === 'informational_question' && domain === 'finance_qb'))
    ? mapDomainToWorkflows(domain)
    : [];

  return {
    message_class: messageClass,
    domain,
    workflow_types: workflowTypes,
    target_entity: entity,
    approval_required: needsApproval,
    confidence: isActionRequest ? 85 : isInformational ? 90 : 50,
    action_verbs: detectedVerbs,
    entity_mentions: entity ? [entity] : [],
    raw_keywords: extractActionKeywords(lower),
  };
}

function hasFollowupSignal(text: string): boolean {
  return /\b(nua|them|tiep|con|cung|roi|ok|understood)\b/.test(text);
}

// ── Convenience: does this intent need a workflow? ─────────────────────────

export function needsWorkflow(intent: ActionIntent): boolean {
  return intent.message_class === 'action_request' && intent.workflow_types.length > 0;
}

// ── Convenience: is this the acceptance test case? ────────────────────────

export function isRawSushiSEORequest(intent: ActionIntent): boolean {
  return (
    intent.message_class === 'action_request' &&
    intent.target_entity === 'Raw Sushi' &&
    (intent.domain === 'seo_content' || intent.domain === 'website_marketing')
  );
}
