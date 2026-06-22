/**
 * Phase 8 — Auto-Fix Boundary
 * Single source of truth for what Mi may fix automatically vs. what requires CEO approval.
 * Used by Developer Agent and Approval Engine before any write action.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutoFixVerdict = 'SAFE_AUTO_FIX' | 'REQUIRES_APPROVAL' | 'BLOCKED';

export interface AutoFixAction {
  action_type: string;       // e.g. 'edit_file', 'run_command', 'deploy'
  target: string;            // file path, service name, URL, etc.
  description: string;
  affects_production?: boolean;
  affects_database?: boolean;
  affects_customer?: boolean;
  affects_security?: boolean;
  affects_payments?: boolean;
}

export interface AutoFixResult {
  verdict: AutoFixVerdict;
  reason: string;
  category: string;
  risk_level: 1 | 2 | 3;
  ceo_message?: string;      // Vietnamese message to show CEO if approval needed
}

// ── Safe auto-fix categories ──────────────────────────────────────────────────
// Mi may execute these WITHOUT asking CEO

const SAFE_AUTO_FIX_PATTERNS: Array<{
  category: string;
  description: string;
  matchers: RegExp[];
}> = [
  {
    category: 'comments',
    description: 'Add, remove, or update code comments',
    matchers: [/comment/i, /jsdoc/i, /docstring/i],
  },
  {
    category: 'documentation',
    description: 'Markdown docs, README, changelog, reports',
    matchers: [/\.md$/i, /readme/i, /changelog/i, /\.txt$/i, /docs?\//i],
  },
  {
    category: 'logs',
    description: 'Add or adjust log statements (console.log, logger)',
    matchers: [/add.*log/i, /console\.log/i, /logger\./i],
  },
  {
    category: 'test_updates',
    description: 'Update test assertions, add test cases',
    matchers: [/\.test\./i, /\.spec\./i, /tests?\//i, /update.*test/i],
  },
  {
    category: 'minor_config',
    description: 'Non-production config: timeouts, retry counts, log levels',
    matchers: [/timeout/i, /retry_count/i, /log_level/i, /max_items/i],
  },
  {
    category: 'read_only_diagnostics',
    description: 'Read files, scan logs, run health checks — no writes',
    matchers: [/scan/i, /inspect/i, /read/i, /health.?check/i, /audit/i, /diagnos/i],
  },
  {
    category: 'type_fixes',
    description: 'TypeScript type annotations that do not change runtime behavior',
    matchers: [/type.*fix/i, /add.*type/i, /annotation/i],
  },
  {
    category: 'lint_format',
    description: 'Code formatting and lint auto-fixes (no logic changes)',
    matchers: [/format/i, /prettier/i, /eslint.*fix/i, /lint.*fix/i],
  },
];

// ── Blocked categories ────────────────────────────────────────────────────────
// Mi must NEVER do these, even with CEO approval in the message

const HARD_BLOCKED_PATTERNS: Array<{
  category: string;
  reason: string;
  matchers: RegExp[];
}> = [
  {
    category: 'payment_action',
    reason: 'Payment operations are never automated',
    matchers: [/payment/i, /stripe/i, /charge/i, /refund/i, /invoice.*send/i, /pay.*customer/i],
  },
  {
    category: 'delete_production_data',
    reason: 'Data deletion is irreversible',
    matchers: [/drop.*table/i, /delete.*from.*where/i, /truncate/i, /rm\s+-rf/i, /purge.*data/i],
  },
  {
    category: 'security_credential_change',
    reason: 'Credential rotation requires human verification',
    matchers: [/rotate.*key/i, /change.*password/i, /update.*secret/i, /new.*api.*key.*save/i],
  },
];

// ── Requires CEO approval ─────────────────────────────────────────────────────
// Mi may do these ONLY after explicit CEO approval

const REQUIRES_APPROVAL_PATTERNS: Array<{
  category: string;
  description: string;
  risk_level: 1 | 2 | 3;
  matchers: RegExp[];
}> = [
  {
    category: 'production_deploy',
    description: 'Deploy to production environment',
    risk_level: 3,
    matchers: [/deploy/i, /trien khai/i, /release.*prod/i, /len production/i, /publish/i],
  },
  {
    category: 'database_mutation',
    description: 'INSERT, UPDATE, or schema change on live database',
    risk_level: 3,
    matchers: [/insert.*into/i, /update.*set/i, /alter.*table/i, /migrate.*db/i, /db.*write/i],
  },
  {
    category: 'destructive_file_op',
    description: 'Delete or overwrite production files',
    risk_level: 2,
    matchers: [/delete.*file/i, /overwrite/i, /rm\s+/i, /unlink/i],
  },
  {
    category: 'customer_reply',
    description: 'Send email, WhatsApp, or any message to a customer',
    risk_level: 2,
    matchers: [/send.*email/i, /reply.*customer/i, /send.*message/i, /gmail.*send/i, /gui.*email/i],
  },
  {
    category: 'public_website_change',
    description: 'Edit content on public-facing website',
    risk_level: 2,
    matchers: [/public.*page/i, /homepage/i, /landing.*page/i, /website.*content/i, /web.*publish/i],
  },
  {
    category: 'service_restart',
    description: 'Restart or kill a production process',
    risk_level: 2,
    matchers: [/pm2.*restart/i, /kill.*process/i, /service.*restart/i, /reboot/i],
  },
  {
    category: 'config_change_prod',
    description: 'Change production environment variables or secrets',
    risk_level: 2,
    matchers: [/\.env.*prod/i, /set.*env/i, /env.*var.*change/i, /prod.*config.*write/i],
  },
];

// ── Core classifier ───────────────────────────────────────────────────────────

export function classifyAutoFix(action: AutoFixAction): AutoFixResult {
  const searchText = `${action.action_type} ${action.target} ${action.description}`.toLowerCase();

  // 1. Hard-blocked — never, regardless of approval
  if (action.affects_payments) {
    return { verdict: 'BLOCKED', reason: 'Payment actions are never automated', category: 'payment_action', risk_level: 3 };
  }
  for (const rule of HARD_BLOCKED_PATTERNS) {
    if (rule.matchers.some(p => p.test(searchText))) {
      return { verdict: 'BLOCKED', reason: rule.reason, category: rule.category, risk_level: 3 };
    }
  }

  // 2. Context flags — immediate approval requirement
  if (action.affects_production || action.affects_database || action.affects_customer || action.affects_security) {
    const flag = action.affects_production ? 'production' : action.affects_database ? 'database' : action.affects_customer ? 'customer' : 'security';
    return {
      verdict: 'REQUIRES_APPROVAL',
      reason: `Action affects ${flag} — requires CEO approval`,
      category: `${flag}_impact`,
      risk_level: action.affects_production || action.affects_database ? 3 : 2,
      ceo_message: `⏳ Em cần anh duyệt hành động này trước khi thực hiện.\n*Lý do:* Ảnh hưởng đến ${flag}.\n*Hành động:* ${action.description.slice(0, 80)}`,
    };
  }

  // 3. Requires approval patterns
  for (const rule of REQUIRES_APPROVAL_PATTERNS) {
    if (rule.matchers.some(p => p.test(searchText))) {
      return {
        verdict: 'REQUIRES_APPROVAL',
        reason: rule.description,
        category: rule.category,
        risk_level: rule.risk_level,
        ceo_message: `⏳ *Cần anh duyệt:* ${rule.description}\n*Hành động:* ${action.description.slice(0, 80)}`,
      };
    }
  }

  // 4. Safe auto-fix patterns
  for (const rule of SAFE_AUTO_FIX_PATTERNS) {
    if (rule.matchers.some(p => p.test(searchText)) || rule.matchers.some(p => p.test(action.target))) {
      return { verdict: 'SAFE_AUTO_FIX', reason: rule.description, category: rule.category, risk_level: 1 };
    }
  }

  // 5. Default — unknown actions require approval
  return {
    verdict: 'REQUIRES_APPROVAL',
    reason: 'Unknown action type — defaulting to approval required for safety',
    category: 'unknown',
    risk_level: 2,
    ceo_message: `⏳ Em không chắc hành động này có an toàn không. Anh có muốn em thực hiện không?\n*Hành động:* ${action.description.slice(0, 80)}`,
  };
}

export function isSafeAutoFix(action: AutoFixAction): boolean {
  return classifyAutoFix(action).verdict === 'SAFE_AUTO_FIX';
}

export function isBlocked(action: AutoFixAction): boolean {
  return classifyAutoFix(action).verdict === 'BLOCKED';
}

export function listSafeCategories(): string[] {
  return SAFE_AUTO_FIX_PATTERNS.map(r => r.category);
}

export function listApprovalCategories(): string[] {
  return REQUIRES_APPROVAL_PATTERNS.map(r => r.category);
}

export function formatBoundaryForCeo(): string {
  const safe = SAFE_AUTO_FIX_PATTERNS.map(r => `  ✅ ${r.description}`).join('\n');
  const approval = REQUIRES_APPROVAL_PATTERNS.map(r => `  ⏳ ${r.description}`).join('\n');
  const blocked = HARD_BLOCKED_PATTERNS.map(r => `  🚫 ${r.reason}`).join('\n');
  return `*SAFE (tự động):*\n${safe}\n\n*Cần anh duyệt:*\n${approval}\n\n*Không bao giờ tự làm:*\n${blocked}`;
}
