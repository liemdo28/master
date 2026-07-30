/**
 * Natural Intent Router — Phase 1 Jarvis Build
 * Maps free-form Vietnamese/English CEO messages to Mi actions.
 * No /commands required. "Mi ơi" just works.
 */

export type NaturalIntent =
  | 'greeting'
  | 'farewell'
  | 'how_are_you'
  | 'help_natural'
  | 'system_status'
  | 'laptop1_status'
  | 'laptop2_status'
  | 'all_nodes_status'
  | 'project_status'
  | 'workspace_overview'
  | 'dashboard_status'
  | 'dashboard_link'
  | 'connector_health'
  | 'doordash_status'
  | 'doordash_revenue'
  | 'whatsapp_gateway_status'
  | 'integration_status'
  | 'bigdata_health'
  | 'dev_status'
  | 'create_dev_task'
  | 'report_request'
  | 'restart_project'
  | 'logs_request'
  | 'clear_logs'
  | 'node_issue_report'
  | 'store_issue_report'
  | 'approval_response'
  | 'mute_alerts'
  | 'unmute_alerts'
  | 'what_is_important'
  | 'what_is_blocking'
  | 'risks_summary'
  | 'store_ops'
  | 'payroll_status'
  | 'review_status'
  | 'unknown_clarify';

export type ActionMode =
  | 'chat_only'
  | 'read_status'
  | 'search_data'
  | 'create_task'
  | 'run_safe_action'
  | 'dangerous_action_requires_approval'
  | 'unknown_clarify';

export interface NaturalRoute {
  handled: boolean;
  intent: NaturalIntent;
  actionMode: ActionMode;
  target?: string;
  projectId?: string;
  param?: string;
}

function norm(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[?!.,]+$/g, '')
    .replace(/\s+/g, ' ');
}

function has(input: string, ...patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(input));
}

function stripMi(text: string): string {
  return text
    .replace(/^mi\s*(oi|o'i|ui|oi)?\s*[,.]?\s*/i, '')
    .replace(/^\s*(em|mi)\s*(oi|o'i)?\s*/i, '')
    .trim();
}

export function classifyNaturalMessage(message: string): NaturalRoute {
  const raw = norm(message);
  const input = stripMi(raw);

  // ── Approval inline responses ─────────────────────────────────────────────
  if (/^(approve|approved|ok\s*em|duyet|dong y|chap nhan|yes|ok done)(\s|$)/i.test(input) ||
      /^(cancel|huy|reject|tu choi|no)\b/i.test(input) ||
      /^(khong|ko)$/i.test(input)) {
    return { handled: true, intent: 'approval_response', actionMode: 'run_safe_action' };
  }

  // ── Mute / unmute ─────────────────────────────────────────────────────────
  if (has(input, /mute|im lang|tat.*canh bao|tat alert/)) {
    const hours = parseInt(input.match(/(\d+)\s*(h|gio)/)?.[1] || '2');
    return { handled: true, intent: 'mute_alerts', actionMode: 'run_safe_action', param: String(hours) };
  }
  if (has(input, /unmute|bat.*canh bao|bat alert|on alert/)) {
    return { handled: true, intent: 'unmute_alerts', actionMode: 'run_safe_action' };
  }

  // ── Greetings ─────────────────────────────────────────────────────────────
  if (has(raw,
    /^(alo|hello|hi|hey|chao|ping|test|yo)(\s*$|\s+mi\b)/,
    /^(mi|em)\s*(oi|o'i|ui)?\s*$/,
    /^chao\s*(mi|em)\s*$/,
    /^mi\s*oi\s*$/,
    /^em\s*oi\s*$/
  )) {
    return { handled: true, intent: 'greeting', actionMode: 'chat_only' };
  }

  if (has(input, /tam biet|bye|good night|ngu ngon|chuc ngu ngon/)) {
    return { handled: true, intent: 'farewell', actionMode: 'chat_only' };
  }

  if (has(input, /khoe khong|em.*the nao|mi.*ok.*khong|ban.*the nao/)) {
    return { handled: true, intent: 'how_are_you', actionMode: 'chat_only' };
  }

  // ── What's important today ────────────────────────────────────────────────
  if (has(input,
    /hom nay.*quan trong|quan trong.*hom nay/,
    /mai.*task|task.*mai|ngay mai.*task|viec.*mai|mai.*co.*task/,
    /sang nay.*co gi|co gi.*sang nay/,
    /hom nay.*co gi|co gi.*hom nay/,
    /uu tien.*hom nay|hom nay.*uu tien/,
    /can.*lam gi.*hom nay|hom nay.*can.*lam/,
    /tom tat.*hom nay|hom nay.*tom tat/,
    /brief.*today|today.*brief/,
    /what.*important|important.*today/,
    /tinh hinh.*chung|overview.*today/,
    /morning.*update|update.*morning/
  )) {
    return { handled: true, intent: 'what_is_important', actionMode: 'read_status' };
  }

  // ── Blockers ─────────────────────────────────────────────────────────────
  if (has(input,
    /blocker|dang bi chan|bi tac|bi loi|van de.*chinh/,
    /vuong mac|khong chay duoc/,
    /co gi.*bi.*loi|loi.*la gi|dang.*sai/,
    /dang.*bi.*van de|problem.*with/
  )) {
    return { handled: true, intent: 'what_is_blocking', actionMode: 'read_status' };
  }

  // ── Risk / warnings ──────────────────────────────────────────────────────
  if (has(input,
    /rui ro|risk|nguy co/,
    /canh bao|warning/,
    /co van de gi khong|co gi sai khong/,
    /tat ca.*ok|everything.*ok|all.*good/,
    /co loi gi khong|loi gi/
  )) {
    return { handled: true, intent: 'risks_summary', actionMode: 'read_status' };
  }

  // ── System overall status ────────────────────────────────────────────────
  if (has(input,
    /he thong.*the nao|the nao.*he thong/,
    /toan bo.*tinh hinh|tinh hinh.*toan bo/,
    /tat ca.*server|server.*tat ca/,
    /^(status|health|tong quan|overview)$/,
    /mi.*core.*ok|mi.*core.*sao/,
    /system.*status/
  )) {
    return { handled: true, intent: 'system_status', actionMode: 'read_status' };
  }

  // ── Dashboard / project workspace ────────────────────────────────────────
  if (has(input,
    /dashboard|dash board|bang dieu khien|admin panel|control panel/,
    /task.*maria|approval center|approval.*pending/
  )) {
    if (has(input, /link|url|mo|open|vao dau|co link/)) {
      return { handled: true, intent: 'dashboard_link', actionMode: 'read_status', target: 'dashboard' };
    }
    return { handled: true, intent: 'dashboard_status', actionMode: 'read_status', target: 'dashboard' };
  }

  if (has(input,
    /tat ca.*project|cac project|all.*project|scan.*project|project.*list/,
    /workspace|master.*project|work.*project/,
    /viec.*cua.*t|work.*cua.*t|cong viec.*cua.*t/,
    /connect.*work|connect.*project|khong.*connect.*work|khong.*connect.*project/
  )) {
    return { handled: true, intent: 'workspace_overview', actionMode: 'read_status', target: 'all' };
  }

  if (has(input,
    /connector|ket noi|kết nối|data source|nguon du lieu/,
    /mi.*connect|connect.*mi|he thong.*lien ket|lien ket.*he thong/
  )) {
    return { handled: true, intent: 'connector_health', actionMode: 'read_status', target: 'all' };
  }

  // ── Clear/delete logs (dangerous — requires approval) ────────────────────
  if (has(input, /xoa log|xóa log|clear log|delete log|don log|dọn log/)) {
    const proj = has(input, /doordash/) ? 'doordash-compaigns'
               : has(input, /whatsapp|gateway/) ? 'whatsapp-ai-gateway'
               : 'integration-system';
    return { handled: true, intent: 'clear_logs', actionMode: 'dangerous_action_requires_approval', target: 'laptop1', projectId: proj };
  }

  // ── Node issue report (context setter) ───────────────────────────────────
  if (has(input, /laptop\s*1|laptop1|may\s*1/) &&
      has(input, /loi|bug|van de|van đe|dang loi|hong|hu|bi loi|khong chay/)) {
    return { handled: true, intent: 'node_issue_report', actionMode: 'read_status', target: 'laptop1' };
  }

  // ── Laptop 1 ─────────────────────────────────────────────────────────────
  if (/^laptop\s*1\s*$|^laptop1\s*$/.test(input) ||
      (has(input, /laptop\s*1|laptop1|may\s*1/) &&
       has(input, /sao roi|tinh hinh|status|health|online|chay|ok|the nao|check|fix chua|xong chua|sua chua|duoc chua/))) {
    return { handled: true, intent: 'laptop1_status', actionMode: 'read_status', target: 'laptop1' };
  }

  // ── Laptop 2 ─────────────────────────────────────────────────────────────
  if (has(input, /laptop\s*2|laptop2|may\s*2/)) {
    return { handled: true, intent: 'laptop2_status', actionMode: 'read_status', target: 'laptop2' };
  }

  // ── All nodes ────────────────────────────────────────────────────────────
  if (has(input, /tat ca.*laptop|tat ca.*may|all.*node|cac may/)) {
    return { handled: true, intent: 'all_nodes_status', actionMode: 'read_status' };
  }

  // ── DoorDash ─────────────────────────────────────────────────────────────
  if (has(input, /doordash|door dash|giao do an|delivery/)) {
    if (has(input, /restart|khoi dong|reboot/)) {
      return { handled: true, intent: 'restart_project', actionMode: 'dangerous_action_requires_approval', target: 'laptop1', projectId: 'doordash-compaigns' };
    }
    if (has(input, /log|nhat ky/)) {
      return { handled: true, intent: 'logs_request', actionMode: 'search_data', target: 'laptop1', projectId: 'doordash-compaigns' };
    }
    if (has(input, /doanh thu|revenue|ban duoc|bao nhieu|thu nhap/)) {
      return { handled: true, intent: 'doordash_revenue', actionMode: 'read_status', target: 'laptop1', projectId: 'doordash-compaigns' };
    }
    return { handled: true, intent: 'doordash_status', actionMode: 'read_status', target: 'laptop1', projectId: 'doordash-compaigns' };
  }

  // ── WhatsApp Gateway ─────────────────────────────────────────────────────
  if (has(input, /whatsapp|gateway/)) {
    if (has(input, /restart|khoi dong|reboot/)) {
      return { handled: true, intent: 'restart_project', actionMode: 'dangerous_action_requires_approval', target: 'laptop1', projectId: 'whatsapp-ai-gateway' };
    }
    if (has(input, /log/)) {
      return { handled: true, intent: 'logs_request', actionMode: 'search_data', target: 'laptop1', projectId: 'whatsapp-ai-gateway' };
    }
    return { handled: true, intent: 'whatsapp_gateway_status', actionMode: 'read_status', target: 'laptop1', projectId: 'whatsapp-ai-gateway' };
  }

  // ── Integration ──────────────────────────────────────────────────────────
  if (has(input, /integration|background.*agent|agent.*nen/)) {
    if (has(input, /log/)) {
      return { handled: true, intent: 'logs_request', actionMode: 'search_data', target: 'laptop1', projectId: 'integration-system' };
    }
    return { handled: true, intent: 'integration_status', actionMode: 'read_status', target: 'laptop1', projectId: 'integration-system' };
  }

  // ── Big Data ─────────────────────────────────────────────────────────────
  if (has(input, /bigdata|big data|postgres|minio|qdrant|co so du lieu/)) {
    return { handled: true, intent: 'bigdata_health', actionMode: 'read_status' };
  }

  // ── Store issue report (context setter) ──────────────────────────────────
  // Note: norm() keeps "đ" (U+0111) so "vấn đề"→"van đe", "lỗi"→"loi"
  if (has(input, /stone oak|bandera|rim\b|bakudan|raw sushi/) &&
      has(input, /van de|van đe|loi|bug|hong|bi loi|khong on/)) {
    const storeName = /stone oak/i.test(input) ? 'Stone Oak'
                    : /bandera/i.test(input) ? 'Bandera'
                    : /bakudan/i.test(input) ? 'Bakudan'
                    : /raw sushi/i.test(input) ? 'Raw Sushi'
                    : /rim/i.test(input) ? 'Rim' : 'store';
    return { handled: true, intent: 'store_issue_report', actionMode: 'read_status', target: storeName };
  }

  // ── Store operations ─────────────────────────────────────────────────────
  if (has(input, /cua hang|stone oak|bandera|rim\b|bakudan|raw sushi|nha hang/) &&
      has(input, /sao roi|the nao|status|tinh hinh|ok|chay|hoat dong/)) {
    return { handled: true, intent: 'store_ops', actionMode: 'read_status' };
  }

  // ── Payroll ──────────────────────────────────────────────────────────────
  if (has(input, /luong|payroll|tra luong/)) {
    return { handled: true, intent: 'payroll_status', actionMode: 'read_status' };
  }

  // ── Reviews ──────────────────────────────────────────────────────────────
  if (has(input, /review|danh gia|google.*review|yelp/)) {
    return { handled: true, intent: 'review_status', actionMode: 'read_status' };
  }

  // ── Dev ───────────────────────────────────────────────────────────────────
  if (has(input, /dev\b|developer|dev1|dev2/) &&
      has(input, /sao roi|dang lam gi|tinh hinh|status/)) {
    return { handled: true, intent: 'dev_status', actionMode: 'read_status' };
  }

  if (has(input, /tao task|giao task|giao viec/) &&
      has(input, /dev|fix|build|code/)) {
    return { handled: true, intent: 'create_dev_task', actionMode: 'create_task' };
  }

  // ── Reports ──────────────────────────────────────────────────────────────
  if (has(input, /bao cao|report|gui report|xuat report/)) {
    return { handled: true, intent: 'report_request', actionMode: 'search_data' };
  }

  // ── Help ─────────────────────────────────────────────────────────────────
  if (has(input,
    /mi.*lam duoc gi|mi.*co the gi|mi.*giup duoc gi/,
    /help|tro giup|huong dan/,
    /mi.*co.*kha nang|mi.*biet.*lam/
  )) {
    return { handled: true, intent: 'help_natural', actionMode: 'chat_only' };
  }

  // ── Catch-all for anything addressed to Mi ───────────────────────────────
  if (/^(mi|em)\b/.test(raw)) {
    return { handled: true, intent: 'unknown_clarify', actionMode: 'unknown_clarify' };
  }

  return { handled: false, intent: 'unknown_clarify', actionMode: 'unknown_clarify' };
}
