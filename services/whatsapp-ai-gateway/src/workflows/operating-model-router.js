/**
 * Operating Model Router — central orchestrator for WhatsApp message routing
 *
 * Routing priority (strict):
 *
 * IMAGES:
 *   1. Check if chat/group is enabled for Food Safety Capture
 *   2. Classify image: line_check_form | evidence_photo | unknown
 *   3. line_check_form → Food Safety OCR workflow
 *   4. evidence_photo → save evidence
 *   5. unknown → ask for clearer form or manager review
 *   Do NOT route image messages to Mi unless caption starts with /mi
 *
 * TEXT:
 *   1. Active Food Safety confirmation session → CONFIRM / EDIT / RETAKE / MANAGER / CANCEL
 *   2. Starts with /mi → route to Mi-Core
 *   3. Starts with /agent → route to Agent-Coding
 *   4. Private admin chat → route to Mi-Core
 *   5. Otherwise → no automatic routing
 */

const { makeLogger } = require('../logger');
const storeRegistry = require('../stores/store-registry');
const groupWorkflowConfig = require('./group-workflow-config');
const imageClassifier = require('../vision/image-classifier');
const foodSafetyPipeline = require('../food-safety/food-safety-pipeline');
const evidenceHandler = require('../food-safety/evidence-handler');
const formPhotoWorkflow = require('./form-photo-workflow');
const formPhotoImageStorage = require('./form-photo-image-storage');
const templateOcrWorkflow = require('../template-ocr/template-ocr-workflow');
const agentMiRouter = require('../commands/agent-mi-router');
const agentMiForwarder = require('../forwarding/agent-mi-forwarder');
const miAccess = require('../security/mi-access-control');
const replyService = require('../whatsapp/reply-service');
const ceoAudit = require('./ceo-audit-log');

const log = makeLogger('operating-model');

function logSuppressedMiFallback(route, fwd, detail = {}) {
  if (!fwd?.reply || fwd.ok) return;
  log.warn('Suppressed Mi-Core failure fallback reply', {
    route,
    error: fwd.error || '',
    statusCode: fwd.statusCode || '',
    ...detail,
  });
}

/**
 * Route an incoming image message.
 */
async function routeImage(client, msg, media, metadata) {
  const { chatId, sender, senderName, timestamp, messageId, groupName, caption } = metadata;
  const isGroup = chatId.includes('@g.us');

  await ceoAudit.auditImageReceived({ chatId, sender, senderName, messageId });

  // Priority 1: /mi caption → route to Mi
  if (caption && caption.trim().toLowerCase().startsWith('/mi')) {
    log.info('Image has /mi caption — routing to Mi', { chatId, sender });
    await ceoAudit.auditMiCalled({ chatId, sender, senderName, messageId, metadata: { caption, type: 'image_with_mi' } });
    const result = await agentMiRouter.handleMiMessage({
      chatId, groupId: isGroup ? chatId : '', sender, senderName,
      text: caption, timestamp, attachments: [{ path: '', mimetype: media.mimetype }], client,
    });
    if (result.payload) {
      const fwd = await agentMiForwarder.forwardToMi(result.payload);
      if (fwd.ok && fwd.reply) await replyService.send(client, chatId, fwd.reply);
      else logSuppressedMiFallback('image_mi_caption', fwd, { chatId, sender });
    } else if (result.reply) {
      await replyService.send(client, chatId, result.reply);
    }
    return;
  }

  // Priority 2: Check Food Safety enabled
  const fsEnabled = await groupWorkflowConfig.isFoodSafetyEnabledForGroup(chatId);
  const fsEnvEnabled = process.env.FOOD_SAFETY_ENABLED === 'true';
  if (!fsEnabled || !fsEnvEnabled) {
    log.info('Food Safety not enabled for this group — ignoring image', { chatId });
    return;
  }

  // Check active session
  if (formPhotoWorkflow.hasActiveSession(chatId, sender)) {
    log.info('Active form photo session', { chatId, sender });
    try {
      const imagePath = formPhotoImageStorage
        ? formPhotoImageStorage.saveFormPhotoImage(media, metadata)
        : null;
      if (!imagePath) {
        await replyService.send(client, chatId, '⚠️ Image save failed.');
        return;
      }
      const result = await formPhotoWorkflow.handleFormPhotoUpload({
        chatId, sender, senderName, imagePath, metadata, client,
      });
      if (result.handled && result.reply) await replyService.send(client, chatId, result.reply);
    } catch (err) {
      log.error('Form photo session processing error', { error: err.message });
      await replyService.send(client, chatId, '⚠️ Form processing error.');
    }
    return;
  }

  // Priority 3: Classify image
  let imagePath;
  try { imagePath = foodSafetyPipeline.saveImage(media, metadata); } catch (err) {
    log.error('Failed to save image', { error: err.message });
    return;
  }

  const classification = await imageClassifier.classifyImage(imagePath);
  await ceoAudit.auditImageClassified({
    chatId, sender, senderName, messageId,
    metadata: { type: classification.type, subtype: classification.subtype, confidence: classification.confidence },
  });
  log.info('Image classified', { type: classification.type, subtype: classification.subtype });

  // Priority 4: Route by classification
  if (classification.type === 'line_check_form') {
    await ceoAudit.auditFormOcrStarted({ chatId, sender, senderName, messageId });
    try {
      if (templateOcrWorkflow) {
        const ocrResult = await templateOcrWorkflow.processImage(imagePath, metadata);
        if (ocrResult.handled) {
          await replyService.send(client, chatId, ocrResult.reply);
          await ceoAudit.auditFormOcrCompleted({ chatId, sender, senderName, messageId, metadata: { result: ocrResult.result } });
          return;
        }
      }
      await formPhotoWorkflow.startFormPhotoWorkflow({
        chatId, isGroup, sender, senderName: senderName || sender, groupName, client,
      });
      const result = await formPhotoWorkflow.handleFormPhotoUpload({
        chatId, sender, senderName, imagePath, metadata, client,
      });
      if (result.handled && result.reply) await replyService.send(client, chatId, result.reply);
      await ceoAudit.auditFormOcrCompleted({ chatId, sender, senderName, messageId, metadata: { result: result.result || 'processing' } });
    } catch (err) {
      log.error('Form processing error', { error: err.message });
      await replyService.send(client, chatId, '⚠️ Could not read this form. Try again or reply MANAGER.');
    }
    return;
  }

  if (classification.type === 'evidence_photo') {
    const subtype = classification.subtype || 'other';
    const evPath = evidenceHandler.saveEvidencePhoto(media, { ...metadata, subtype });
    if (evPath) {
      await evidenceHandler.recordEvidence(evPath, { ...metadata, subtype });
      await ceoAudit.auditEvidenceSaved({ chatId, sender, senderName, messageId, metadata: { subtype } });
    }
    await replyService.send(client, chatId, evidenceHandler.buildEvidenceReply(subtype));
    return;
  }

  // Unknown image
  await replyService.send(client, chatId,
    'I received the image, but I could not identify it as a Food Safety form.\nPlease upload a clear photo of the completed line check form, or reply MANAGER for review.');
}

/**
 * Route an incoming text message.
 */
async function routeText(client, msg, metadata) {
  const { chatId, sender, senderName, text, timestamp, messageId } = metadata;
  const isGroup = chatId.includes('@g.us');
  const trimmed = String(text || '').trim();
  const upper = trimmed.toUpperCase();

  // Priority 1: Active Food Safety session
  if (formPhotoWorkflow.hasActiveSession(chatId, sender)) {
    const routed = await formPhotoWorkflow.handleFormPhotoReply({
      chatId, sender, senderName, text: trimmed, client,
    });
    if (routed.handled) {
      if (upper === 'CONFIRM' || upper === 'YES' || upper === 'Y' || upper === '1') {
        await ceoAudit.auditEmployeeConfirmed({ chatId, sender, senderName, messageId });
      }
      if (trimmed.toUpperCase().startsWith('EDIT')) {
        await ceoAudit.auditEmployeeEdited({ chatId, sender, senderName, messageId, metadata: { edit: trimmed } });
      }
      if (routed.reply) await replyService.send(client, chatId, routed.reply);
      return;
    }
  }

  if (templateOcrWorkflow && templateOcrWorkflow.hasActiveSession(chatId, sender)) {
    const routed = await templateOcrWorkflow.handleReply({ chatId, sender, senderName, text: trimmed, client });
    if (routed.handled) {
      if (routed.reply) await replyService.send(client, chatId, routed.reply);
      return;
    }
  }

  // Priority 2: /mi → Mi-Core
  if (agentMiRouter.isMiCommand(trimmed)) {
    if (!miAccess.isCeoSender(sender)) {
      log.info('/mi command blocked for non-CEO sender', { chatId, sender });
      return false;
    }
    log.info('/mi command detected', { chatId, sender });
    await ceoAudit.auditMiCalled({ chatId, sender, senderName, messageId, metadata: { text: trimmed.slice(0, 100) } });
    const result = await agentMiRouter.handleMiMessage({
      chatId, groupId: isGroup ? chatId : '', sender, senderName,
      text: trimmed, timestamp, attachments: [], client,
    });
    if (result.payload) {
      const fwd = await agentMiForwarder.forwardToMi(result.payload);
      if (fwd.ok && fwd.reply) {
        await replyService.send(client, chatId, fwd.reply);
        if (fwd.approval_required) await ceoAudit.auditApprovalRequired({ chatId, sender, senderName, messageId, metadata: { approval_id: fwd.approval_id } });
      } else {
        logSuppressedMiFallback('mi_command', fwd, { chatId, sender });
      }
    } else if (result.reply) {
      await replyService.send(client, chatId, result.reply);
    }
    return;
  }

  // Priority 3: /agent → Agent-Coding
  if (agentMiRouter.isAgentCommand(trimmed)) {
    log.info('/agent command detected', { chatId, sender });
    await ceoAudit.auditAgentCalled({ chatId, sender, senderName, messageId, metadata: { text: trimmed.slice(0, 100) } });
    const result = await agentMiRouter.handleAgentMessage({
      chatId, groupId: isGroup ? chatId : '', sender, senderName,
      text: trimmed, timestamp, attachments: [], client,
    });
    if (result.payload) {
      const fwd = await agentMiForwarder.forwardToAgent(result.payload);
      if (fwd.ok && fwd.reply) await replyService.send(client, chatId, fwd.reply);
      else if (fwd.reply) await replyService.send(client, chatId, fwd.reply);
    } else if (result.reply) {
      await replyService.send(client, chatId, result.reply);
    }
    return;
  }

  // Priority 4: Private admin chat → Mi (no prefix)
  if (!isGroup) {
    const isAdmin = await groupWorkflowConfig.isMiAdminPrivateChat(chatId, sender);
    if (isAdmin) {
      log.info('Admin private chat — routing to Mi', { chatId, sender });
      await ceoAudit.auditMiCalled({ chatId, sender, senderName, messageId, metadata: { type: 'admin_private_chat', text: trimmed.slice(0, 100) } });
      const result = await agentMiRouter.handleMiMessage({
        chatId, groupId: '', sender, senderName,
        text: '/mi ' + trimmed, timestamp, attachments: [], client,
      });
      if (result.payload) {
        const fwd = await agentMiForwarder.forwardToMi(result.payload);
        if (fwd.ok && fwd.reply) await replyService.send(client, chatId, fwd.reply);
        else logSuppressedMiFallback('admin_private_chat', fwd, { chatId, sender });
      } else if (result.reply) {
        await replyService.send(client, chatId, result.reply);
      }
      return;
    }
  }

  // Priority 5: No automatic routing
  if (isGroup) {
    log.info('Group message with no prefix — silent drop', { chatId, sender });
    return;
  }

  const helpReply = [
    "I'm the Bakudan AI Gateway.",
    '',
    'Available commands:',
    '/mi — Ask Mi executive assistant',
    '/agent — Agent-Coding tasks',
    '/help — Show commands',
    '',
    'Food Safety images are processed automatically in store groups.',
  ].join('\n');
  await replyService.send(client, chatId, helpReply);
}

module.exports = { routeImage, routeText };
