/**
 * /ldagent Command Handler
 *
 * Entry point for the group session mode.
 * Manages the agent session lifecycle and dispatches to workflows.
 *
 * Session flow:
 *   /ldagent → detect/ask store → MENU → user picks workflow →
 *   WORKFLOW_ACTIVE (delegates to broth-command / info-commands) →
 *   WAITING_MORE → YES → MENU  |  NO/END → CLOSED
 */

const agentMgr  = require('../sessions/agent-session-manager');
const { STATES, CLOSE_REASONS } = agentMgr;
const brothCommand  = require('./broth-command');
const storeRegistry = require('../stores/store-registry');
const { t }         = require('../i18n/translations');
const { detect }   = require('../i18n/detector');
const langMem       = require('../i18n/language-memory');
const tempWorkflow  = require('../workflows/guided/temperature-workflow');
const guidedEngine  = require('../workflows/guided/guided-workflow-engine');
const templateCache = require('../templates/template-cache');
const dailyTemplate = require('../templates/daily-entry-template-service');
const { makeLogger } = require('../logger');
const nlpResolver = require('../nlp/command-resolver');

const log = makeLogger('whatsapp');

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKFLOW_MENU = [
  { id: '1', label: 'Daily Entry Log',     cmd: '/broth' },
  { id: '2', label: 'Broth Count',         cmd: '/broth' },
  { id: '3', label: 'Temperature Check',   cmd: null },
  { id: '4', label: 'Food Safety Review',  cmd: null },
  { id: '5', label: 'System Status',       cmd: '/status' },
];

const WAKE_COMMANDS = (process.env.GROUP_WAKE_COMMANDS || '/ldagent,/help,/status,/template,/log')
  .split(',').map(s => s.trim().toLowerCase());

// ── Command detection ─────────────────────────────────────────────────────────
function isLdagentCommand(text) {
  return /^\/ldagent\s*$/i.test(String(text || '').trim());
}

function isWakeCommand(text) {
  const t = String(text || '').trim().toLowerCase();
  return WAKE_COMMANDS.some(cmd => t.startsWith(cmd));
}

// ── Non-owner reply ───────────────────────────────────────────────────────────
function getNonOwnerReply(ownerName) {
  if (process.env.NON_OWNER_REPLY_MODE === 'minimal_warning') {
    return `⚠️ Agent is currently assisting ${ownerName}.\nPlease wait until the session is closed.`;
  }
  return null; // silent
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * Handle /ldagent start command.
 */
async function startLdagent({ chatId, isGroup, groupName, sender, senderName, timestamp }) {
  const mapped = isGroup ? await storeRegistry.resolveGroup(chatId) : null;
  if (isGroup && !mapped) {
    return { handled: true, blocked: true, blockReason: 'unmapped_group', reply: storeRegistry.unmappedGroupReply() };
  }

  if (mapped) await storeRegistry.markLastMessage(chatId, groupName);
  const detectedStore = mapped?.store_name || detectStoreFromGroup(groupName);
  const resolvedLang = await langMem.resolveLanguage({
    phone: sender,
    storeId: mapped?.store_id || null,
    text: '',
  }).catch(() => ({ lang: 'en' }));
  const language = resolvedLang?.lang || 'en';

  const session = await agentMgr.createSession({
    chatId, isGroup, groupName,
    ownerId: sender, ownerName: senderName,
    store: detectedStore,
    storeId: mapped?.store_id || null,
    language,
  });

  if (!detectedStore) {
    // Ask for store
    return {
      handled: true,
      reply: `👋 ${senderName || ''}\n${readyHelp(language)}\n\n${storePrompt(language)}`.trim(),
    };
  }

  // Store known — show menu
  agentMgr.setState(chatId, STATES.MENU);
  return { handled: true, reply: buildMenuMessage(senderName, detectedStore, language) };
}

/**
 * Route a message from the session owner to the correct handler.
 */
async function handleOwnerMessage({ chatId, isGroup, sender, senderName, text, timestamp, groupName, client }) {
  const session = agentMgr.getSession(chatId);
  if (!session) return { handled: false };

  agentMgr.touchActivity(chatId);
  const trimmed = text.trim();
  const lang = session.language || 'en';
  const nlp = !trimmed.startsWith('/') ? nlpResolver.resolveCommand(trimmed) : null;
  const controlIntent = nlp?.autoHandle ? nlp.intent : null;
  const upper = normalizeSessionControl(trimmed, controlIntent);

  if (session.state === STATES.WORKFLOW_ACTIVE && upper === 'STATUS') {
    return handleWorkflowMessage({ chatId, session, text, sender, senderName, isGroup, groupName, timestamp, client });
  }

  // ── Global session controls ────────────────────────────────────────────────
  if (upper === 'END' || upper === 'NO') {
    const closed = await agentMgr.closeSession(chatId, CLOSE_REASONS.USER_END);
    // Also clear any broth session
    brothCommand.clearSession(chatId, sender);
    return {
      handled: true,
      reply: `Thank you, ${session.ownerName}. Session closed. 👋`,
    };
  }

  if (upper === 'YES' || upper === 'MENU') {
    agentMgr.clearWorkflow(chatId);
    agentMgr.setState(chatId, STATES.MENU);
    return { handled: true, reply: buildMenuMessage(session.ownerName, session.store, lang) };
  }

  if (upper === 'HELP') {
    return { handled: true, reply: sessionHelpMessage() };
  }

  if (upper === 'STATUS') {
    return { handled: true, reply: buildSessionStatus(session) };
  }

  if (upper === 'CANCEL') {
    // Cancel active workflow but keep session
    brothCommand.clearSession(chatId, sender);
    agentMgr.clearWorkflow(chatId);
    agentMgr.setState(chatId, STATES.MENU);
    return { handled: true, reply: `❌ Workflow cancelled.\n\n${buildMenuMessage(session.ownerName, session.store, lang)}` };
  }

  // ── WAITING_STORE → parse store selection ──────────────────────────────────
  if (session.state === STATES.WAITING_STORE) {
    return handleStoreSelection({ chatId, session, text, sender, senderName });
  }

  // ── MENU → parse workflow selection ───────────────────────────────────────
  if (session.state === STATES.MENU) {
    return handleMenuSelection({ chatId, session, text, sender, senderName, isGroup, groupName, timestamp, client });
  }

  // ── WAITING_MORE → YES/NO already handled above; anything else → re-show ──
  if (session.state === STATES.WAITING_MORE) {
    agentMgr.setState(chatId, STATES.MENU);
    return { handled: true, reply: buildMenuMessage(session.ownerName, session.store, lang) };
  }

  // ── WORKFLOW_ACTIVE → delegate to broth-command ────────────────────────────
  if (session.state === STATES.WORKFLOW_ACTIVE) {
    return handleWorkflowMessage({ chatId, session, text, sender, senderName, isGroup, groupName, timestamp, client });
  }

  return { handled: false };
}

// ── Store selection ───────────────────────────────────────────────────────────
function handleStoreSelection({ chatId, session, text, sender, senderName }) {
  if (session.isGroup && session.storeId) {
    agentMgr.setState(chatId, STATES.MENU);
    return { handled: true, reply: buildMenuMessage(senderName, session.store, session.language || 'en') };
  }
  const store = parseStoreSelection(text) || detectStoreFromText(text);
  if (!store) {
    const lang = session.language || 'en';
    return { handled: true, reply: `⚠️ ${lang === 'vi' ? 'Không nhận ra cửa hàng.' : 'Store not recognised.'}\n\n${storePrompt(lang)}` };
  }
  agentMgr.setStore(chatId, store);
  agentMgr.setState(chatId, STATES.MENU);
  return { handled: true, reply: buildMenuMessage(senderName, store, session.language || 'en') };
}

// ── Workflow menu selection ───────────────────────────────────────────────────
async function handleMenuSelection({ chatId, session, text, sender, senderName, isGroup, groupName, timestamp, client }) {
  const trimmed = text.trim();
  const lang = session.language || detect(text);
  const nlp = !trimmed.startsWith('/') ? nlpResolver.resolveCommand(trimmed) : null;
  const nlpIntent = nlp?.autoHandle ? nlp.intent : null;

  const choice  = WORKFLOW_MENU.find(w => w.id === trimmed.replace(/^\//, ''));

  // Direct /broth command
  if (/^\/broth/i.test(trimmed) || (choice && [1, 2].includes(+choice.id)) || nlpIntent === 'DAILY_ENTRY' || nlpIntent === 'BROTH_COUNT') {
    return startWorkflow({ chatId, session, workflow: 'daily_entry', cmd: trimmed.startsWith('/broth') ? trimmed : '/broth', sender, senderName, isGroup, groupName, timestamp, client });
  }

  // /status
  if (/^\/status$/i.test(trimmed) || (choice?.id === '5') || nlpIntent === 'STATUS') {
    const infoCmd = require('./info-commands');
    const reply = await infoCmd.handleInfoCommand('/status');
    return { handled: true, reply: reply || 'Status unavailable' };
  }

  // Temperature Check (option 3) — fully functional now
  if (/^\/?3$/i.test(trimmed) || choice?.id === '3') {
    agentMgr.setWorkflow(chatId, 'temperature_check');
    const storeInfo = session.store ? storeRegistry.getStoreByName(session.store) : null;
    const result = await tempWorkflow.startTempWorkflow({
      chatId, isGroup, sender, senderName,
      text: trimmed,
      groupName: groupName || session.groupName || '',
      store: session.store || 'Store',
      storeId: storeInfo?.store_id || session.storeId || null,
      timestamp,
      client,
    });
    return { handled: true, reply: result.reply || t('sys_unavailable', lang) };
  }

  // Unknown selection
  if (!choice) {
    return { handled: true, reply: t('sys_unavailable', lang) + '\n\n' + buildMenuMessage(senderName, session.store, lang) };
  }

  // Food Safety Review (option 4) — not yet built
  return { handled: true, reply: t('sys_unavailable', lang) };
}

// ── Start a workflow ──────────────────────────────────────────────────────────
async function startWorkflow({ chatId, session, workflow, cmd, sender, senderName, isGroup, groupName, timestamp, client }) {
  agentMgr.setWorkflow(chatId, workflow);

  if (workflow === 'daily_entry') {
    // Use guided one-at-a-time workflow for Daily Entry Log
    const template = dailyTemplate.getCurrentTemplate();
    const items = dailyTemplate.getTemplateItems();
    if (!template.available || !items || items.length === 0) {
      return { handled: true, reply: dailyTemplate.NOT_AVAILABLE_MESSAGE };
    }
    const thresholds = Object.fromEntries(items.map(item => [
      item.item_name,
      { min: item.target_min ?? null, max: item.target_max ?? null },
    ]));
    const storeInfo = session.store ? storeRegistry.getStoreByName(session.store) : null;
    const reply = guidedEngine.startGuidedWorkflow({
      chatId, sender, senderName,
      store: session.store || 'Store',
      storeId: storeInfo?.store_id || session.storeId || null,
      workflowType: 'daily_entry',
      items,
      thresholds,
      templateVersion: template.template_version,
      lang: session.language || detect(cmd),
      groupName: groupName || session.groupName || '',
    });
    return { handled: true, reply: reply || '⚠️ Could not start workflow.' };
  }

  // Delegate to command router for other workflows
  const commandRouter = require('./command-router');
  const result = await commandRouter.handleCommand({
    chatId, isGroup, sender, senderName,
    text: cmd,
    groupName: groupName || session.groupName || '',
    timestamp,
    client,
  });

  return { handled: true, reply: result.reply || '⚠️ Could not start workflow.' };
}

// ── Workflow message handler ──────────────────────────────────────────────────
async function handleWorkflowMessage({ chatId, session, text, sender, senderName, isGroup, groupName, timestamp, client }) {
  // Daily Entry Log — uses guided one-at-a-time engine
  if (session.activeWorkflow === 'daily_entry') {
    const guidedResult = await guidedEngine.handleReply({ chatId, sender, senderName, text, groupName: groupName || session.groupName || '' });

    if (guidedResult?.handled) {
      // Check if guided workflow completed (returns a complete payload)
      if (guidedResult.complete) {
        // Hand off to broth-command finalization (sheet write, manager alerts, etc.)
        const storeInfo = session.store ? storeRegistry.getStoreByName(session.store) : null;
        const result = await finalizeGuidedEntry({
          chatId, sender, senderName, isGroup, groupName, timestamp, client,
          session, storeInfo,
          counts: guidedResult.counts,
          lang: session.language || guidedResult.lang,
        });
        // Workflow finished — move to WAITING_MORE
        agentMgr.clearWorkflow(chatId);
        agentMgr.setState(chatId, STATES.WAITING_MORE);
        return {
          handled: true,
          result: result.result,
          reply: `${result.reply || ''}\n\nDo you need anything else?\nYES — continue\nNO — close session`.trim(),
        };
      }

      // Check if cancelled
      if (guidedResult.cancelled) {
        agentMgr.clearWorkflow(chatId);
        agentMgr.setState(chatId, STATES.MENU);
        return { handled: true, reply: `❌ Workflow cancelled.\n\n${buildMenuMessage(session.ownerName, session.store, session.language || 'en')}` };
      }

      return { handled: true, reply: guidedResult.reply };
    }

    return { handled: true, reply: `⚠️ Not understood. Send STATUS to see your draft, or CANCEL to stop.` };
  }

  // Temperature Check — uses temperature workflow
  if (session.activeWorkflow === 'temperature_check') {
    const result = await tempWorkflow.handleTempReply({
      chatId, sender, senderName, text, timestamp, groupName: groupName || session.groupName || '',
    });

    if (result?.handled) {
      if (result.complete || !tempWorkflow.hasTempSession(chatId, sender)) {
        agentMgr.clearWorkflow(chatId);
        agentMgr.setState(chatId, STATES.WAITING_MORE);
        return {
          handled: true,
          result: result.result,
          reply: `${result.reply || ''}\n\nDo you need anything else?\nYES — continue\nNO — close session`.trim(),
        };
      }
      return { handled: true, reply: result.reply };
    }
    return { handled: true, reply: `⚠️ Not understood. Send STATUS to see your draft, or CANCEL to stop.` };
  }

  // Other workflows — delegate to command router
  const commandRouter = require('./command-router');
  const result = await commandRouter.handleCommand({
    chatId, isGroup, sender, senderName,
    text,
    groupName: groupName || session.groupName || '',
    timestamp,
    client,
  });

  if (!result.handled) {
    return { handled: true, reply: `⚠️ Not understood. Send STATUS to see your draft, or CANCEL to stop.` };
  }

  return { handled: true, reply: result.reply };
}

// ── Finalize guided daily entry → sheet write + manager alerts ────────────────
async function finalizeGuidedEntry({ chatId, sender, senderName, isGroup, groupName, timestamp, client, session, storeInfo, counts, lang }) {
  // Reuse broth-command's infrastructure for sheet writes and alerts
  // Start a temporary broth session with pre-filled counts, immediately confirm
  const brothLogWriter = require('../google/broth-log-writer');
  const managerAlerts  = require('../alerts/manager-alert-service');
  const { validateAll } = require('../templates/template-validator');
  const storage = (() => { try { return require('../storage/food-safety-storage'); } catch (_) { return null; } })();
  const auditTrail = (() => { try { return require('../workflows/audit-trail'); } catch (_) { return null; } })();

  if (!storeInfo) {
    return { reply: '⚠️ Store is missing. This entry was not written. Please ask admin to map this group.' };
  }

  const validationResult = validateAll(counts);
  const tmplStatus = templateCache.getStatus();
  const metadata = { chatId, sender, senderName, groupName: groupName || '', timestamp, sourceType: 'guided_workflow' };

  // Audit trail
  let auditLogId = null;
  if (auditTrail) {
    try {
      auditLogId = await auditTrail.createAuditLog({
        sessionId: `${chatId}:${sender}:${Date.now()}`,
        workflowType: 'daily_entry',
        storeId: storeInfo.store_id,
        storeName: storeInfo.store_name,
        groupChatId: chatId,
        groupName: groupName || '',
        employeeId: sender,
        employeeName: senderName,
        employeeLanguage: lang || 'en',
        originalInputs: counts,
        finalPayload: counts,
        sheetWriteStatus: 'PENDING',
        managerAlertStatus: 'NOT_SENT',
      });
    } catch (_) {}
  }

  // DB save
  let entryId = null;
  if (storage) {
    try {
      entryId = await storage.saveBrothLogEntry({
        chatId, senderId: sender, senderName: senderName || sender,
        groupName: groupName || '', storeId: storeInfo.store_id, store: storeInfo.store_name,
        payload: { counts, validation: validationResult },
        status: validationResult.overallStatus, sheetWriteStatus: 'PENDING',
      });
    } catch (err) { log.warn('Guided entry: DB save failed (non-fatal)', { error: err.message }); }
  }

  // Sheet write
  const sheetWrite = await brothLogWriter.appendBrothLog({
    entryId: entryId ? `GUIDED_${entryId}` : `GUIDED_${Date.now()}`,
    metadata, store: storeInfo.store_name, storeId: storeInfo.store_id, counts,
    templateVersion: tmplStatus.version || '',
    validationResult,
    notes: validationResult.failCount > 0 ? 'Manager review recommended.' : 'Recorded via guided workflow.',
  });

  await storeRegistry.markLastLogWrite(chatId).catch(() => {});

  if (storage && entryId) {
    try { await storage.updateBrothSheetStatus(entryId, sheetWrite.status); } catch (_) {}
  }

  // Update audit trail
  if (auditTrail && auditLogId) {
    try { await auditTrail.markConfirmed(auditLogId, { sheetWriteStatus: sheetWrite.status, managerAlertStatus: 'PENDING' }); } catch (_) {}
  }

  // Manager alerts
  const alertResult = await managerAlerts.handleConfirmedDailyEntry({
    client,
    session: { ...session, sender, chatId },
    store: storeInfo,
    validationResult,
    sheetWriteStatus: sheetWrite.status,
    timestamp,
    sessionId: `${chatId}:${sender}:${entryId || Date.now()}`,
  });

  if (auditTrail && auditLogId && alertResult.managerAlert) {
    try { await auditTrail.markConfirmed(auditLogId, { sheetWriteStatus: sheetWrite.status, managerAlertStatus: 'SENT' }); } catch (_) {}
  }

  const sheetLine = sheetWrite.status === 'SENT' ? '📊 Recorded to Google Sheet.' : '💾 Saved locally. Google Sheet write queued.';
  let reply;
  if (validationResult?.overallStatus === 'FAIL' && validationResult.failures?.length > 0) {
    const failLines = validationResult.failures.map(f => `  • ${f.name}: ${f.value}${f.target ? `, target ${f.target}` : ''}`);
    reply = ['⚠️ Daily Entry Logged with Warnings', '', `Store: ${storeInfo.store_name}`, '', 'Out of range:', ...failLines, '', sheetLine].join('\n');
  } else {
    reply = ['✅ Daily Entry Logged', '', `Store: ${storeInfo.store_name}`, 'Status: PASS', '', sheetLine].join('\n');
  }

  log.info('Guided daily entry confirmed', { chatId, sender, store: storeInfo.store_name, status: validationResult.overallStatus, sheetStatus: sheetWrite.status });

  return {
    result: { entryId, sheetWrite, validationResult, managerAlert: alertResult.managerAlert },
    reply: alertResult.storeWarning || reply,
  };
}

// ── Store detection ───────────────────────────────────────────────────────────
function detectStoreFromGroup(groupName) {
  return detectStoreFromText(groupName || '');
}

function detectStoreFromText(text) {
  return storeRegistry.detectStoreFromText(text)?.store_name || null;
}

function parseStoreSelection(text) {
  const t = String(text || '').trim();
  if (t === '1') return 'Rim';
  if (t === '2') return 'Stone Oak';
  if (t === '3') return 'Bandera';
  return null;
}

function normalizeSessionControl(text, intent) {
  if (intent === 'CANCEL') return 'CANCEL';
  if (intent === 'HELP') return 'HELP';
  if (intent === 'STATUS') return 'STATUS';
  if (intent === 'CONFIRM') return 'YES';
  const upper = String(text || '').trim().toUpperCase();
  if (upper === 'HUY' || upper === 'HỦY' || upper === 'CANCELAR' || upper === 'ANNULER') return 'CANCEL';
  return upper;
}

// ── Message builders ──────────────────────────────────────────────────────────
function readyHelp(lang = 'en') {
  if (lang === 'vi') return 'Tôi sẵn sàng hỗ trợ.';
  if (lang === 'es') return 'Estoy listo para ayudar.';
  if (lang === 'fr') return 'Je suis prêt à aider.';
  return "I'm ready to help.";
}

function storePrompt(lang = 'en') {
  if (lang === 'vi') return 'Chọn cửa hàng:\n\n1 Rim\n2 Stone Oak\n3 Bandera';
  if (lang === 'es') return 'Elige tienda:\n\n1 Rim\n2 Stone Oak\n3 Bandera';
  if (lang === 'fr') return 'Choisissez le magasin:\n\n1 Rim\n2 Stone Oak\n3 Bandera';
  return 'Which store?\n\n1 Rim\n2 Stone Oak\n3 Bandera';
}

function buildMenuMessage(ownerName, store, lang = 'en') {
  if (lang === 'vi') {
    return [
      `👋 Chào ${ownerName || 'bạn'},`,
      `Cửa hàng: *${store || 'Chưa chọn'}*`,
      '',
      'Chọn quy trình:',
      '1. Nhật ký Daily Entry',
      '2. Broth Count',
      '3. Kiểm tra nhiệt độ',
      '4. Kiểm tra an toàn thực phẩm',
      '5. Trạng thái hệ thống',
      '',
      'Trả lời bằng số hoặc lệnh.',
      'Gõ END để đóng.',
    ].join('\n');
  }
  return [
    `👋 Hi ${ownerName || 'there'},`,
    `Store: *${store || 'Not set'}*`,
    '',
    'Choose a workflow:',
    '1. Daily Entry Log',
    '2. Broth Count',
    '3. Temperature Check',
    '4. Food Safety Review',
    '5. System Status',
    '',
    'Reply with a number or command.',
    'Type END to close.',
  ].join('\n');
}

function buildSessionStatus(session) {
  const msLeft = Math.max(0, new Date(session.expiresAt).getTime() - Date.now());
  const minLeft = Math.ceil(msLeft / 60_000);
  return [
    '📊 *Session Status*',
    `Owner: ${session.ownerName}`,
    `Store: ${session.store || 'Not set'}`,
    `State: ${session.state}`,
    `Workflow: ${session.activeWorkflow || 'None'}`,
    `Expires in: ${minLeft} min`,
    '',
    'Type MENU to return to menu, END to close.',
  ].join('\n');
}

function sessionHelpMessage() {
  return [
    '📋 *Session Commands*',
    '',
    'YES / MENU — Return to workflow menu',
    'NO / END   — Close session',
    'STATUS     — Show current session status',
    'CANCEL     — Cancel current workflow (keep session)',
    'HELP       — Show this list',
    '',
    '*During a workflow:*',
    'CONFIRM    — Save to Google Sheet',
    'EDIT 6 42  — Edit item #6',
    'CANCEL     — Cancel workflow',
  ].join('\n');
}

module.exports = {
  isLdagentCommand,
  isWakeCommand,
  getNonOwnerReply,
  startLdagent,
  handleOwnerMessage,
  buildMenuMessage,
  sessionHelpMessage,
  detectStoreFromGroup,
  WAKE_COMMANDS,
};
