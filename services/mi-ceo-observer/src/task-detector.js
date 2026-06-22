/**
 * Task Detector — NLP classifier for CEO WhatsApp conversations.
 *
 * Detects tasks, deadlines, requests, approvals, finance questions,
 * and complaints from raw message text (Vietnamese + English).
 */

// Vietnamese diacritic normalization
function norm(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PATTERNS = {
  task: [
    /\b(lam|lam viec|thuc hien|can lam|nho lam|to do|action item|follow up|followup)\b/,
    /\b(chuan bi|prepare|setup|set up|khai bao|submit|nop)\b/,
    /\b(check|kiem tra|xem lai|review|confirm|xac nhan)\b.*\b(ngay|hom nay|tuan|week|truoc)\b/,
    /\b(gui|send|forward|chuyen)\b.*\b(cho|to|anh|em|team|nguyen|maria|nhan vien)\b/,
    /\b(update|cap nhat|bao cao|report|bao)\b/,
    /\b(can|need|phai|must|should)\b.*\b(lam|do|complete|xong|finish)\b/,
  ],
  deadline: [
    /\b(deadline|han chot|han nop|het han|due|due date)\b/,
    /\b(truoc|before|by)\b.*\b(\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|thang))\b/,
    /\b(hom nay|today|ngay mai|tomorrow|tuan nay|this week|cuoi tuan|weekend)\b.*\b(phai|must|can|need|xong|done)\b/,
    /\b(nhac|remind|nhac nho|reminder)\b/,
    /\b(\d{1,2}h|\d{1,2}:\d{2})\b.*\b(hop|meeting|call|goi)\b/,
  ],
  finance: [
    /\b(doanh thu|revenue|oanh so|sales|thu nhap|income|loi nhuan|profit)\b/,
    /\b(quickbooks|qb|ke toan|accounting|bao cao tai chinh|financial report)\b/,
    /\b(tien|money|payment|thanh toan|hoa don|invoice|chi phi|expense|cost)\b/,
    /\b(reconcile|doi soat|kiem tra so|check balance|balance)\b/,
    /\b(b1|b2|bakudan|raw|rawsushi)\b.*\b(doanh thu|revenue|thu|sales)\b/,
  ],
  approval: [
    /\b(approve|phe duyet|cho phep|dong y|agreed|ok|oke)\b.*\b(chua|chua|yet|or not)\b/,
    /\b(can|need|phai)\b.*\b(approve|phe duyet|sign off|xac nhan)\b/,
    /\b(waiting|cho|dang cho)\b.*\b(approve|phe duyet|feedback|reply)\b/,
    /\b(anh co the|anh oi|boss|giam doc)\b.*\b(approve|duyet|xem|confirm)\b/,
  ],
  complaint: [
    /\b(khach hang|customer|guest)\b.*\b(khieu nai|complain|complaint|phan nan|feedback|bad|toi|kem)\b/,
    /\b(sai|wrong|error|loi|van de|problem|issue|bug)\b.*\b(can|need|phai|must)\b.*\b(fix|sua|resolve)\b/,
    /\b(giao thieu|thieu|missing|khong co|not found|lost)\b.*\b(don hang|order|payment|hang)\b/,
  ],
  request: [
    /\b(co the|can you|anh oi|em oi)\b.*\b(giup|help|lam|do|check|kiem tra|gui|send)\b/,
    /\b(tao|create|viet|write|lam|build|setup)\b.*\b(bai|article|report|bao cao|file|doc)\b/,
    /\b(tim|find|search|kiem|look for)\b.*\b(thong tin|info|data|so lieu|document)\b/,
  ],
};

/**
 * Classify a message and return detected intent types + confidence.
 *
 * @param {string} text
 * @param {{ chatName?: string, isGroup?: boolean, sender?: string }} context
 * @returns {{ intents: string[], confidence: number, summary: string, should_create_workflow: boolean }}
 */
function detectTaskIntents(text, context = {}) {
  const normalized = norm(text);
  const detected = [];

  for (const [intent, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        detected.push(intent);
        break;
      }
    }
  }

  // Confidence: 1 match = 60%, 2+ matches = 85%, deadline or finance = boost to 90%
  let confidence = 0;
  if (detected.length >= 2) confidence = 85;
  else if (detected.length === 1) confidence = 60;
  if (detected.includes('deadline') || detected.includes('finance')) confidence = Math.max(confidence, 90);

  const sensitivity = parseInt(process.env.TASK_DETECTION_SENSITIVITY || '2', 10);
  const threshold = sensitivity === 1 ? 85 : sensitivity === 3 ? 50 : 60;
  const should_create_workflow = confidence >= threshold && detected.length > 0;

  const summary = detected.length > 0
    ? `Detected: [${detected.join(', ')}] (${confidence}%)`
    : 'No actionable intent detected';

  return { intents: detected, confidence, summary, should_create_workflow };
}

/**
 * Build a GStack request from a detected CEO conversation event.
 */
function buildWorkflowRequest(event) {
  const { text, sender_name, chat_name, intents, is_group } = event;
  const context = is_group ? `[${chat_name}] ${sender_name}` : sender_name;

  // Build natural-language request for mi-core GStack
  if (intents.includes('finance')) {
    return `[CEO Observer] ${context}: "${text.slice(0, 200)}" — Phân tích tài chính và kiểm tra dữ liệu QB.`;
  }
  if (intents.includes('approval')) {
    return `[CEO Observer] ${context} đang chờ approval: "${text.slice(0, 200)}"`;
  }
  if (intents.includes('deadline') || intents.includes('task')) {
    return `[CEO Observer] Task phát hiện từ ${context}: "${text.slice(0, 200)}" — Tạo workflow theo dõi.`;
  }
  if (intents.includes('complaint')) {
    return `[CEO Observer] Khiếu nại từ ${context}: "${text.slice(0, 200)}" — Escalation cần xử lý.`;
  }
  return `[CEO Observer] Request từ ${context}: "${text.slice(0, 200)}"`;
}

module.exports = { detectTaskIntents, buildWorkflowRequest, norm };
