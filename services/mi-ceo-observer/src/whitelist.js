/**
 * Whitelist & Security Policy — Phase 4
 *
 * Controls which chats/contacts the CEO Observer will process.
 * Three tiers:
 *   AUTO_ALLOWED    — summarize, create task, create reminder, classify
 *   APPROVAL_REQUIRED — send WA, email, publish, finance response
 *   BLOCKED         — delete data, transfer money, deploy, change creds
 */

const fs = require('fs');
const path = require('path');

const POLICY_PATH = path.resolve('./data/whitelist.json');

const DEFAULT_POLICY = {
  // Chat IDs explicitly allowed (empty = allow all CEO conversations)
  allowed_chat_ids: [],
  // Chat IDs explicitly blocked (e.g. noisy groups)
  blocked_chat_ids: [],
  // Contact IDs (senders) that trigger auto-workflow creation
  priority_contacts: [],
  // Group names that are always monitored (regex patterns)
  monitored_group_patterns: [
    'team', 'staff', 'nhan vien', 'bakudan', 'raw', 'quan ly', 'management'
  ],
};

function loadPolicy() {
  try {
    if (fs.existsSync(POLICY_PATH)) {
      return { ...DEFAULT_POLICY, ...JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8')) };
    }
  } catch {}
  return { ...DEFAULT_POLICY };
}

function savePolicy(policy) {
  try {
    fs.mkdirSync(path.dirname(POLICY_PATH), { recursive: true });
    fs.writeFileSync(POLICY_PATH, JSON.stringify(policy, null, 2));
  } catch (e) {
    require('./logger').warn('Failed to save whitelist policy', { error: e.message });
  }
}

/**
 * Determine if a chat should be observed by the CEO Observer.
 */
function shouldObserve(chatId, chatName = '') {
  const policy = loadPolicy();

  // Explicit block list always wins
  if (policy.blocked_chat_ids.includes(chatId)) return false;

  // Explicit allow list
  if (policy.allowed_chat_ids.length > 0) {
    if (policy.allowed_chat_ids.includes(chatId)) return true;
    // Also check monitored group patterns
    const nameNorm = (chatName || '').toLowerCase();
    const matchesPattern = policy.monitored_group_patterns.some(p =>
      nameNorm.includes(p.toLowerCase())
    );
    if (matchesPattern) return true;
    return false;
  }

  // Default: observe all (no whitelist = monitor everything)
  return true;
}

/**
 * Classify what action tier is allowed for a given action type.
 */
const ACTION_TIERS = {
  // AUTO_ALLOWED — no human approval needed
  summarize: 'AUTO_ALLOWED',
  create_task: 'AUTO_ALLOWED',
  create_reminder: 'AUTO_ALLOWED',
  classify_message: 'AUTO_ALLOWED',
  create_workflow: 'AUTO_ALLOWED',

  // APPROVAL_REQUIRED — must get CEO confirmation before executing
  send_whatsapp: 'APPROVAL_REQUIRED',
  send_email: 'APPROVAL_REQUIRED',
  website_publish: 'APPROVAL_REQUIRED',
  social_publish: 'APPROVAL_REQUIRED',
  finance_response: 'APPROVAL_REQUIRED',
  send_report: 'APPROVAL_REQUIRED',

  // BLOCKED — never execute, return error
  delete_data: 'BLOCKED',
  transfer_money: 'BLOCKED',
  deploy_production: 'BLOCKED',
  change_credentials: 'BLOCKED',
  delete_messages: 'BLOCKED',
};

function getActionTier(action) {
  return ACTION_TIERS[action] || 'APPROVAL_REQUIRED';
}

function isAutoAllowed(action) {
  return getActionTier(action) === 'AUTO_ALLOWED';
}

function isBlocked(action) {
  return getActionTier(action) === 'BLOCKED';
}

module.exports = {
  shouldObserve,
  getActionTier,
  isAutoAllowed,
  isBlocked,
  loadPolicy,
  savePolicy,
  ACTION_TIERS,
};
