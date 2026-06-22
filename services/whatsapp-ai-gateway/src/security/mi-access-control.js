/**
 * Mi access control.
 *
 * The WhatsApp account logged into this gateway can be a bot account. Mi-Core
 * must only be reachable from explicit CEO WhatsApp IDs; all other senders stay
 * in the normal chatbot / food-safety flows.
 */

function normalizeWaId(value) {
  return String(value || '')
    .replace(/@c\.us|@g\.us/g, '')
    .replace(/[\s\-().+]/g, '');
}

function configuredCeoIds() {
  const raw = [
    process.env.MI_CEO_WHATSAPP_IDS || '',
    process.env.CEO_WHATSAPP_IDS || '',
    process.env.CEO_WHATSAPP_NUMBER || '',
  ].join(',');

  return raw
    .split(',')
    .map(normalizeWaId)
    .filter(Boolean);
}

function isCeoSender(sender) {
  const senderId = normalizeWaId(sender);
  if (!senderId) return false;
  const allowed = configuredCeoIds();
  if (!allowed.length) return false;
  return allowed.includes(senderId);
}

function getMiAccessState(sender) {
  const allowed = configuredCeoIds();
  return {
    allowed: isCeoSender(sender),
    sender: normalizeWaId(sender),
    configured: allowed.length > 0,
    allowlist_count: allowed.length,
  };
}

module.exports = {
  normalizeWaId,
  configuredCeoIds,
  isCeoSender,
  getMiAccessState,
};
