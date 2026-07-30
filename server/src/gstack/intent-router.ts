/**
 * GStack Intent Router
 * Classifies CEO natural language into structured intent types.
 * Powers the Work Order Engine's first stage.
 */

export type CeoIntent =
  | 'build_feature'
  | 'fix_bug'
  | 'audit_project'
  | 'deploy_release'
  | 'rollback'
  | 'search_knowledge'
  | 'create_report'
  | 'send_message'
  | 'check_status'
  | 'monitor_runtime'
  | 'query_personal_tasks'   // Phase 16 — direct operational data, no LLM
  | 'query_finance'          // D1 — finance truth layer, never fabricates
  | 'query_asset'            // Phase 6 — company asset registry (projects, services, departments)
  | 'security_block'         // DEV3 — dangerous bypass/override commands, always blocked
  | 'unknown';

export interface IntentResult {
  intent: CeoIntent;
  confidence: number;       // 0-100
  target_project?: string;
  target_component?: string;
  keywords: string[];
  requires_approval: boolean;
  risk_level: 1 | 2 | 3;   // 1=auto, 2=single-approve, 3=double-approve
}

function norm(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Intent classification rules — ordered by priority
const RULES: Array<{
  intent: CeoIntent;
  patterns: RegExp[];
  risk_level: 1 | 2 | 3;
  requires_approval: boolean;
}> = [
  // DEV3 — Security block (HIGHEST priority — dangerous bypass/override commands never execute)
  {
    intent: 'security_block',
    patterns: [
      /\b(bypass|skip|ignore|override)\b.*\b(approval|auth|security|ceo|phe duyet)\b/,
      /\b(approve|deploy|execute|run|chay)\b.*\b(without|khong can|bo qua)\b.*\b(approval|ceo|auth)\b/,
      /\b(force|ep|bat buoc)\b.*\b(deploy|execute|approve|merge)\b/,
      /\b(disable|tat|vo hieu)\b.*\b(approval|auth|security|lock)\b/,
      /\b(tu dong|auto)\b.*\b(approve|phe duyet)\b.*\b(without|khong can|bo qua)\b/,
    ],
    risk_level: 3,
    requires_approval: false,
  },
  // Phase 16 — Personal Task Intelligence (highest priority — short-circuits before AI)
  {
    intent: 'query_personal_tasks',
    patterns: [
      /\b(hom nay|hnay|today)\b.*\b(task|viec|lam gi|co gi)\b/,
      /\b(task|viec)\b.*\b(hom nay|hnay|today)\b/,
      /\b(viec gi|task gi)\b.*\b(dang cho|cho anh)\b/,
      /\b(dang cho|cho anh)\b.*\b(task|viec|duyet|lo|nguy|co gi)\b/,
      /\b(can.*anh)\b.*\b(duyet|review|task|viec)\b/,
      /\b(blocker|bi block|co blocker)\b/,
      /\b(co gi|van de|lo)\b.*\b(dang lo|nguy|canh bao|lo khong)\b/,
      /\b(co gi)\b.*\b(dang lo)\b/,
      /\b(team|nguoi)\b.*\b(dang lam|hom nay|hnay)\b/,
      /\b(lich|schedule|calendar)\b.*\b(hom nay|hnay|today|tuan|week)\b/,
      /\b(hom nay|hnay)\b.*\b(lich|schedule|co gi|meeting|hop)\b/,
      /\b(can duyet|can anh duyet)\b/,
      /anh co task|co task gi|task nao dang/,
      /co gi can anh duyet/,
      // Fuzzy / abbreviated inputs (NLP stress test)
      /anh co viec|co viec gi|viec gi roi|co gi moi/,
      /hnay.*viec|hnay.*task|hnay.*duyet|hnay.*co gi/,
      /h nay.*co gi|h nay.*viec|h nay.*task|h nay.*duyet/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
  // D1 — Finance Truth Layer (high priority — before check_status which has broad patterns)
  {
    intent: 'query_finance',
    patterns: [
      /\b(doanh\s*thu|oanh\s*thu|revenue|sales|ban\s*hang|doanh\s*so)\b/,
      /\b(hom\s*nay|tuan\s*nay|thang\s*nay|quy\s*nay|nam\s*nay)\b.*\b(bao\s*nhieu|la\s*bao|duoc|ket\s*qua)\b/,
      /\b(bao\s*nhieu)\b.*\b(tien|dong|usd|vnd)\b/,
      /\b(raw\s*sushi|bakudan\s*ramen|bakudan|stockton|stone\s*oak|rim|bandera)\b.*\b(doanh\s*thu|revenue|sales|bao\s*nhieu|lam\s*an)\b/,
      /\b(store|cua\s*hang|chi\s*nhanh)\b.*\b(nao|manh|yeu|tot|kem|tang|giam|so\s*sanh)\b/,
      /\b(loi\s*nhuan|profit|margin|chi\s*phi|thu\s*nhap|income)\b/,
      /\b(tang|giam)\b.*\b(doanh\s*thu|revenue|sales)\b/,
      /\b(doanh\s*thu|revenue)\b.*\b(tang|giam|so\s*voi|compare)\b/,
      /\b(qb|quickbooks)\b.*\b(doanh\s*thu|revenue|invoice|payment|transaction)\b/,
      /\b(ke\s*toan|accounting|tai\s*chinh|finance)\b/,
      /\b(store\s*nao|chi\s*nhanh\s*nao)\b.*\b(manh|yeu|tang|giam|tot\s*nhat|kem\s*nhat)\b/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
  {
    intent: 'fix_bug',
    patterns: [
      /\b(fix|sua|khac phuc|resolve|debug|repair)\b.*\b(loi|bug|error|issue|crash|broken)\b/,
      /\b(loi|bug|error|crash)\b.*\b(fix|sua|khac phuc)\b/,
      /\b(bi loi|bi hong|bi crash|khong chay|not working)\b/,
      /fix.*production|production.*fix/,
    ],
    risk_level: 2,
    requires_approval: false,
  },
  {
    intent: 'audit_project',
    patterns: [
      /\b(kiem tra|audit|check|inspect|review|scan|phan tich)\b.*\b(project|code|source|dashboard|he thong|system|mi.?core|whatsapp|visibility)\b/,
      /\b(tim loi|find.*bug|find.*issue|detect.*error)\b/,
      /\b(dashboard|mi-core|whatsapp|visibility)\b.*\b(kiem tra|check|audit|review)\b/,
      /\b(audit|kiem\s*tra)\b.*\b(dashboard|he\s*thong|source|code|project)\b/,
      /kiem tra.*fix|audit.*fix/,
      // Fuzzy: "review auto ổn ko", "rv auto on kh"
      /\b(review|rv)\b.*\b(auto|automation)\b/,
      /\b(review.*auto|rv.*auto)\b/,
      // Fuzzy: "Dashboard ổn không", "dash on ko"
      /\b(dash|dashboard|db|mi.?core|rv)\b.*\b(on ko|on kh|tot ko|okay|hoat dong|chay duoc|bi gi)\b/,
      /\b(on ko|on kh|tot ko|okay ko|chay ko)\b.*\b(dash|db|review|auto|mi|pm2)\b/,
      // D2: "audit toàn bộ Dashboard"
      /\b(audit|kiem\s*tra|coi|xem)\b.*\b(toan\s*bo|all|tat\s*ca|he\s*thong)\b/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
  {
    intent: 'build_feature',
    patterns: [
      /\b(build|tao|them|add|create|implement|phat trien|develop)\b.*\b(feature|tinh nang|module|chuc nang)\b/,
      /\b(viet|write)\b.*\b(code|script|module|api|route)\b/,
      /\b(tich hop|integrate|connect)\b.*\b(api|service|tool)\b/,
      // Creative content tasks
      /\b(tao|viet|lam|create|generate|thiet ke|design)\b.*\b(image|anh|hinh|flyer|poster|banner|infographic)\b/,
      /\b(tao|viet|lam|create|generate)\b.*\b(bai|article|seo|content|noi dung|post|dang bai|social|mang xa hoi)\b/,
      /\b(tao|viet|lam|create|generate)\b.*\b(video|clip|reel|story|presentation|thuyet trinh)\b/,
      /\b(flyer|poster|banner|infographic|social media|mang xa hoi|bai dang|seo article)\b/,
      // DEV3: file/folder creation (must be before task patterns)
      /\b(tao|create|write|save|lam)\b.*\b(file|folder|thu muc|document|doc|txt|json|csv|xlsx)\b/,
      /\b(tao|create)\b.*\b(report|bao\s*cao)\b.*\b(cho anh|cho em|cho team|gui)\b/,
    ],
    risk_level: 2,
    requires_approval: false,
  },
  {
    intent: 'deploy_release',
    patterns: [
      /\b(deploy|release|push|xuat ban|trien khai|phat hanh)\b/,
      /\b(production|prod)\b.*\b(deploy|update|push)\b/,
      /\b(len production|up production|production ready)\b/,
    ],
    risk_level: 3,
    requires_approval: true,
  },
  {
    intent: 'rollback',
    patterns: [
      /\b(rollback|revert|hoan tac|khoi phuc)\b/,
      /\b(undo|revert)\b.*\b(deploy|release|change)\b/,
    ],
    risk_level: 3,
    requires_approval: true,
  },
  // Phase 6 — Asset Registry (projects, services, department ownership, source health)
  {
    intent: 'query_asset' as CeoIntent,
    patterns: [
      /\b(company project|du an cong ty|danh sach project)\b/,
      /\b(service.*down|service nao|which service|dich vu nao)\b/,
      /\b(department.*own|bo phan.*phu trach|ai phu trach|who own)\b/,
      /\b(source.*health|data source|nguon du lieu)\b/,
      /\b(project.*owner|owner.*project|phu trach project)\b/,
      /\b(agent project|mi.*project|company asset)\b/,
      /\b(ds project|list project|liet ke project)\b/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
  {
    intent: 'check_status',
    patterns: [
      /\b(status|tinh hinh|trang thai|sao roi|the nao)\b/,
      /\b(dang chay|running|online|offline|up|down)\b/,
      /\b(health|kiem tra|check)\b.*\b(service|server|process|pm2)\b/,
      /\b(co gi|anything|anything new|bao cao nhanh)\b/,
      // Fuzzy: "Dashboard đâu", "dash đâu", "db đâu", "dassh dau"
      /\b(dash|dashboard|dassh|db|pm2|mi.?core|whatsapp)\b.*\b(dau|o dau|roi|the nao|sao)\b/,
      /\b(dau|o dau)\b.*\b(dash|dashboard|db|pm2)\b/,
      // Standalone project name with location/status query
      /^(dash|dashboard|dassh|db)\s+(dau|o dau|sao roi|the nao)$/,
      // QB / QuickBooks status shorthand — "coi qb", "qb sao", "qb the nao"
      /\b(coi|check|xem)\s+(?:qb|quickbooks)\b/,
      /\b(?:qb|quickbooks)\b.*\b(sao|the nao|status|roi|oke|ok|chay|sync)\b/,
      /^qb$/, // bare "qb" alone — CEO asking about QB
      // D2: "coi giùm anh", "xem giùm", "kiểm tra giúp" — action aliases with no target
      /\b(coi|xem|kiem\s*tra)\s+(?:gium|giup|nhanh|thu)\b/,
      // Raw Sushi — "raw sao rồi", "coi raw", "bakudan sao rồi"
      /\b(coi|check|xem|kiem\s*tra)\s+(?:raw|bakudan)\b/,
      /\b(?:raw\s*sushi|bakudan\s*ramen|bakudan)\b.*\b(sao|the nao|status|roi|oke|ok)\b/,
      /\braw\b.*\b(sao|the nao|status|oke|ok|roi)\b/,
      // Stockton — "stockton sao rồi", "coi stockton"
      /\b(stockton)\b.*\b(sao|the nao|status|oke|ok|roi)\b/,
      /\b(coi|check|xem)\s+stockton\b/,
      // D2: Stone Oak, Rim, Bandera stores
      /\b(stone\s*oak|stone\s*oaks|stoneoaks)\b.*\b(sao|the nao|status|roi)\b/,
      /\b(coi|check|xem)\s+(?:stone\s*oak|rim|bandera)\b/,
      /\b(rim|bandera)\b.*\b(sao|the nao|status|roi)\b/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
  {
    intent: 'monitor_runtime',
    patterns: [
      /\b(monitor|theo doi|watch|observe|alert)\b/,
      /\b(runtime|uptime|log|error.*rate|crash.*rate)\b/,
      /\b(pm2|process|memory|cpu)\b.*\b(check|monitor|theo doi)\b/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
  {
    intent: 'search_knowledge',
    patterns: [
      /\b(tim|search|find|tra cuu|query)\b.*\b(knowledge|tai lieu|document|bao cao|report)\b/,
      /\b(em co biet|do you know|what is|la gi|la cai gi)\b/,
      /\b(lich su|history|record|log)\b.*\b(project|task|deploy)\b/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
  // send_message before create_report — "gui X bao cao" must be send, not create
  {
    intent: 'send_message',
    patterns: [
      /\b(gui|send|nhan tin|message|email|noti|notify)\b.*\b(to|cho|toi|den)\b/,
      /\b(thong bao|notify|alert)\b.*\b(team|nhan vien|ceo|manager)\b/,
      // D2: Shorthand without "cho/toi" — "gui Maria", "nhan Maria", "mail Maria"
      /\b(gui|send|email|nhan\s*tin|nhan|mail)\s+(?:maria|hoang|nguyen|anh|em|boss|team|manager)\b/,
      // "gui/nhan/mail X bao cao/draft/ket qua" — X is recipient, not create
      /\b(gui|send|mail|nhan)\s+\w+\b.*\b(ban\s*nhap|draft|bao\s*cao|ket\s*qua|report)\b/,
    ],
    risk_level: 2,
    requires_approval: true,
  },
  {
    intent: 'create_report',
    patterns: [
      /\b(tao|create|generate|viet|write|lam)\b.*\b(bao\s*cao|report)\b/,
      /\b(tong hop|summary|summarize)\b/,
      /\b(doc|document|viet\s*bao\s*cao|write\s*report)\b/,
    ],
    risk_level: 1,
    requires_approval: false,
  },
];

// Project/component extraction
const PROJECT_PATTERNS: Array<{ pattern: RegExp; project: string }> = [
  { pattern: /dashboard/i, project: 'dashboard' },
  { pattern: /mi.?core|mi-core/i, project: 'mi-core' },
  { pattern: /whatsapp/i, project: 'whatsapp-ai-gateway' },
  { pattern: /visibility/i, project: 'visibility' },
  { pattern: /bakudan|ramen/i, project: 'bakudan-ramen' },
  { pattern: /raw\s*sushi|rawsushi/i, project: 'raw-sushi' },
  { pattern: /stockton/i, project: 'stockton' },
  { pattern: /stone\s*oak|stoneoaks/i, project: 'stone-oak' },
  { pattern: /\brim\b/i, project: 'rim' },
  { pattern: /bandera/i, project: 'bandera' },
  { pattern: /knowledge|qdrant/i, project: 'knowledge-universe' },
  { pattern: /dev1|dev 1/i, project: 'dev1' },
  { pattern: /dev2|dev 2/i, project: 'dev2' },
  { pattern: /dev3|dev 3/i, project: 'dev3' },
  { pattern: /jarvis/i, project: 'jarvis' },
  { pattern: /antigravity/i, project: 'antigravity-gateway' },
];

export function classifyIntent(text: string): IntentResult {
  const n = norm(text);

  // Extract target project
  let target_project: string | undefined;
  for (const pp of PROJECT_PATTERNS) {
    if (pp.pattern.test(text)) { target_project = pp.project; break; }
  }

  // Match intent rules
  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(n)) {
        const keywords = extractKeywords(n);
        return {
          intent: rule.intent,
          confidence: 80 + (keywords.length * 2 > 10 ? 10 : keywords.length * 2),
          target_project,
          keywords,
          requires_approval: rule.requires_approval,
          risk_level: rule.risk_level,
        };
      }
    }
  }

  return {
    intent: 'unknown',
    confidence: 0,
    target_project,
    keywords: extractKeywords(n),
    requires_approval: false,
    risk_level: 1,
  };
}

function extractKeywords(normalized: string): string[] {
  const stopwords = new Set(['a', 'an', 'the', 'va', 'va', 'hoac', 'thi', 'de', 'cho', 'trong', 'cua', 'la', 'se', 'co', 'khong', 'nhu', 'khi', 'neu', 'anh', 'em', 'oi', 'roi', 'nao', 'gi', 'ko', 'ok', 'hay', 'di']);
  return normalized.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));
}
