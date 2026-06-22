const { makeLogger } = require('../logger');

const log = makeLogger('audit');

function recordAuditEvent(eventType, payload = {}) {
  const event = {
    eventType,
    payload,
    createdAt: new Date().toISOString(),
  };
  log.info('Audit event', event);
  return event;
}

module.exports = { recordAuditEvent };
