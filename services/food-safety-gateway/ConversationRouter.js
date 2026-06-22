// Conversation Router for the Bakudan Food Safety WhatsApp flow.
//
// Fixes the core pilot bug: once a session is active, the router must NEVER
// fall through to the generic fallback. Active-session messages are always
// interpreted in the context of the current state.
//
// Flow:
//   /ldagent
//     -> WAITING_FOR_STORE_SELECTION
//     -> user selects 1 / 2 / 3
//     -> WAITING_FOR_FORM_PHOTO
//     -> user sends photo
//     -> OCR_PROCESSING -> OCR_REVIEW
//     -> user confirms (1) -> record saved -> COMPLETED
//        retake (2) -> back to WAITING_FOR_FORM_PHOTO
//        cancel (3) -> session cleared (IDLE)

import { SessionStore, STATES } from './session/SessionStore.js';
import { OcrService } from './ocr/OcrService.js';
import { RecordStore, SYNC_STATUS } from './db/RecordStore.js';
import { GoogleSheetSync } from './sync/GoogleSheetSync.js';
import { resolveStore, storeSelectionPrompt } from './config/stores.js';

const START_COMMAND = '/ldagent';

const PROMPTS = {
  formPhoto:
    'Please complete the Food Safety form, take a clear photo of the full page, and send it here.',
  cancelled: 'Submission cancelled. Send /ldagent to start again.',
  retake: 'No problem. Take a clear photo of the full page and send it here again.',
  notAPhoto: 'I am waiting for a photo of the Food Safety form. Please attach the photo.',
  invalidStore: 'Please reply with a valid store number: 1, 2, or 3.',
  invalidConfirm: 'Please reply 1 to confirm, 2 to retake the photo, or 3 to cancel.',
};

export class ConversationRouter {
  /**
   * @param {object} [deps]
   * @param {SessionStore} [deps.sessions]
   * @param {OcrService} [deps.ocr]
   * @param {RecordStore} [deps.records]
   * @param {GoogleSheetSync} [deps.sheetSync]
   * @param {(image: object, ctx: object) => Promise<string>} [deps.saveImage]
   *        Persists an inbound image and returns its stored path.
   */
  constructor(deps = {}) {
    this.sessions = deps.sessions || new SessionStore();
    this.ocr = deps.ocr || new OcrService();
    this.records = deps.records || new RecordStore();
    this.sheetSync = deps.sheetSync || new GoogleSheetSync();
    this.saveImage = deps.saveImage || (async (image) => image?.path || image?.id || 'image://unsaved');
  }

  /**
   * Handle one inbound WhatsApp message.
   *
   * @param {object} msg
   * @param {string} msg.chatId          - WhatsApp chat id (session key)
   * @param {string} [msg.text]          - text body, if any
   * @param {object} [msg.image]         - image payload, if the user sent a photo
   * @param {string} [msg.senderName]    - WhatsApp display name
   * @returns {Promise<{ reply: string, state: string, handled: boolean, record?: object }>}
   */
  async handle(msg) {
    const { chatId } = msg;
    if (!chatId) throw new Error('message.chatId is required');

    const text = (msg.text || '').trim();
    const hasImage = !!msg.image;

    // 1. Start command always (re)starts a session.
    if (text.toLowerCase() === START_COMMAND) {
      this.sessions.start(chatId);
      return this._reply(chatId, storeSelectionPrompt(), { handled: true });
    }

    // 2. If a session is active, the message MUST be handled in-context.
    //    This is the fallback fix: active sessions never reach generic fallback.
    if (this.sessions.isActive(chatId)) {
      // Reset the timeout window on every user message.
      this.sessions.touch(chatId);
      const session = this.sessions.get(chatId);

      switch (session.state) {
        case STATES.WAITING_FOR_STORE_SELECTION:
          return this._handleStoreSelection(chatId, text);
        case STATES.WAITING_FOR_FORM_PHOTO:
          return this._handleFormPhoto(chatId, msg, hasImage);
        case STATES.OCR_REVIEW:
          return this._handleReview(chatId, text);
        case STATES.OCR_PROCESSING:
          // OCR is synchronous in this implementation; this is a safety net.
          return this._reply(chatId, 'Still processing your photo, one moment...', {
            handled: true,
          });
        default:
          // Active but unhandled state — keep it owned by this router.
          return this._reply(chatId, PROMPTS.invalidConfirm, { handled: true });
      }
    }

    // 3. No active session and not a start command -> not ours. The caller's
    //    generic handler may take over.
    return { reply: null, state: STATES.IDLE, handled: false };
  }

  async _handleStoreSelection(chatId, text) {
    const store = resolveStore(text);
    if (!store) {
      return this._reply(chatId, PROMPTS.invalidStore, { handled: true });
    }
    this.sessions.transition(chatId, STATES.WAITING_FOR_FORM_PHOTO, { store });
    return this._reply(chatId, PROMPTS.formPhoto, { handled: true });
  }

  async _handleFormPhoto(chatId, msg, hasImage) {
    if (!hasImage) {
      return this._reply(chatId, PROMPTS.notAPhoto, { handled: true });
    }

    const session = this.sessions.get(chatId);
    const imagePath = await this.saveImage(msg.image, {
      chatId,
      store: session.store,
    });

    this.sessions.transition(chatId, STATES.OCR_PROCESSING, { imagePath });

    let ocr;
    try {
      ocr = await this.ocr.extract(imagePath, {
        employeeName: msg.senderName,
        store: session.store,
      });
    } catch (err) {
      this.sessions.transition(chatId, STATES.FAILED, {
        failureReason: `OCR_FAILED: ${err?.message || 'unknown'}`,
      });
      return this._reply(
        chatId,
        'I could not read that photo. Send /ldagent to try again.',
        { handled: true },
      );
    }

    this.sessions.transition(chatId, STATES.OCR_REVIEW, { ocr });
    return this._reply(chatId, OcrService.summarize(ocr), { handled: true });
  }

  async _handleReview(chatId, text) {
    const choice = text.trim();

    if (choice === '2') {
      this.sessions.transition(chatId, STATES.WAITING_FOR_FORM_PHOTO, { ocr: null });
      return this._reply(chatId, PROMPTS.retake, { handled: true });
    }

    if (choice === '3') {
      this.sessions.clear(chatId);
      return this._reply(chatId, PROMPTS.cancelled, { handled: true, state: STATES.IDLE });
    }

    if (choice === '1') {
      return this._confirmAndSave(chatId);
    }

    return this._reply(chatId, PROMPTS.invalidConfirm, { handled: true });
  }

  async _confirmAndSave(chatId) {
    const session = this.sessions.get(chatId);
    const { ocr, store, imagePath } = session;

    const record = this.records.insert({
      store: store.name,
      date: ocr.fields?.date || new Date().toISOString().slice(0, 10),
      employee_name: ocr.fields?.employee_name || 'Unknown',
      shift: ocr.fields?.shift || '',
      manager: ocr.fields?.manager || '',
      items: ocr.items,
      image_path: imagePath,
      ocr_confidence: ocr.confidence,
      status: 'COMPLETED',
      sync_status: SYNC_STATUS.PENDING,
    });

    // Attempt Google Sheet sync. Never blocks the flow.
    const syncResult = await this.sheetSync.push(record);
    this.records.setSyncStatus(record.id, syncResult.sync_status);
    record.sync_status = syncResult.sync_status;

    this.sessions.transition(chatId, STATES.COMPLETED, { record });

    const syncLine =
      syncResult.sync_status === SYNC_STATUS.SYNCED
        ? 'Synced to Google Sheet.'
        : 'Saved locally (Google Sheet sync pending).';

    return this._reply(
      chatId,
      `Thanks! Your ${store.name} Food Safety record is saved. ${syncLine}`,
      { handled: true, state: STATES.COMPLETED, record },
    );
  }

  _reply(chatId, reply, extra = {}) {
    const session = this.sessions.get(chatId);
    return {
      reply,
      state: extra.state || session?.state || STATES.IDLE,
      handled: extra.handled ?? true,
      ...(extra.record ? { record: extra.record } : {}),
    };
  }
}
