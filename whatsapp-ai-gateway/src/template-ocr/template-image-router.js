const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const registry = require('./template-registry');
const { resolveCommand } = require('./dependency-check');

// Store-specific template IDs (Phase 1 — 3 pilot stores)
const STORE_TEMPLATE_MAP = {
  rim: 'FoodSafety-Rim-v2',
  stone_oak: 'FoodSafety-StoneOak-v2',
  bandera: 'FoodSafety-Bandera-v2',
  test: 'daily-entry-v1',
};

async function resolveStoreTemplateId(chatId) {
  try {
    const storeRegistry = require('../stores/store-registry');
    if (chatId) {
      const mapping = await storeRegistry.resolveGroup(chatId).catch(() => null);
      if (mapping?.store_id) {
        const templateId = STORE_TEMPLATE_MAP[mapping.store_id.toLowerCase()];
        if (templateId) return { templateId, storeId: mapping.store_id, storeName: mapping.store_name };
      }
    }
  } catch (_) {}
  return null;
}

async function looksLikeTemplate(imagePath, metadata = {}) {
  // Step 1: Try to resolve store-specific template from chatId
  const storeInfo = metadata.chatId ? await resolveStoreTemplateId(metadata.chatId) : null;
  if (storeInfo) {
    const storeTemplate = registry.getTemplate(storeInfo.templateId);
    if (storeTemplate) {
      return {
        isTemplate: true,
        templateId: storeInfo.templateId,
        reason: 'store_specific_mapped',
        storeId: storeInfo.storeId,
        storeName: storeInfo.storeName,
      };
    }
  }

  // Step 2: Fall back to default template
  const template = registry.getDefaultTemplate();
  if (!template) return { isTemplate: false, reason: 'no_template_registered' };

  const haystack = [
    imagePath,
    metadata.caption,
    metadata.body,
    metadata.filename,
    metadata.messageId,
  ].filter(Boolean).join(' ').toLowerCase();

  if (haystack.includes(template.template_id.toLowerCase()) || haystack.includes(String(template.form_id).toLowerCase())) {
    return { isTemplate: true, templateId: template.template_id, reason: 'form_id_text' };
  }

  if (process.env.TEMPLATE_OCR_ROUTE_ALL_IMAGES === 'true' && fs.existsSync(imagePath)) {
    return { isTemplate: true, templateId: template.template_id, reason: 'route_all_override' };
  }

  const localText = readTemplateTextWithTesseract(imagePath).toLowerCase();
  if (localText.includes('bakudan daily entry') || localText.includes(template.template_id.toLowerCase())) {
    return { isTemplate: true, templateId: template.template_id, reason: 'title_text_ocr' };
  }

  return { isTemplate: false, reason: 'no_form_id_or_title_detected' };
}

function readTemplateTextWithTesseract(imagePath) {
  if (!fs.existsSync(imagePath)) return '';
  const ext = path.extname(imagePath || '').toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif'].includes(ext)) return '';
  const result = spawnSync(resolveCommand('tesseract'), [imagePath, 'stdout', '--psm', '11'], {
    encoding: 'utf8',
    timeout: 8000,
    windowsHide: true,
  });
  if (result.status !== 0) return '';
  return result.stdout || '';
}

module.exports = { looksLikeTemplate, STORE_TEMPLATE_MAP };
