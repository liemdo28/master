/**
 * Mi-Core HTTP Client
 *
 * Sends detected CEO conversation events to mi-core for workflow creation.
 * Uses the existing /api/whatsapp/mi ingest endpoint (Session B handles replies).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const logger = require('./logger');

const MI_CORE_URL = process.env.MI_CORE_URL || 'http://localhost:4001';
const MI_CORE_API_KEY = process.env.MI_CORE_API_KEY || '';

let sentCount = 0;
let errorCount = 0;

function post(path, body) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const parsed = new URL(MI_CORE_URL + path);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'x-api-key': MI_CORE_API_KEY,
        'x-source': 'ceo-observer-session-a',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: {} }); }
      });
    });

    req.setTimeout(12000, () => { req.destroy(); resolve({ ok: false, status: 0, body: {} }); });
    req.on('error', (e) => { resolve({ ok: false, status: 0, body: { error: e.message } }); });
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Forward a detected CEO conversation event to mi-core for processing.
 *
 * @param {{ text, sender, sender_name, chat_id, chat_name, is_group, message_id, timestamp, intents, workflow_request }} event
 */
async function forwardEvent(event) {
  if (!MI_CORE_API_KEY) {
    logger.warn('MI_CORE_API_KEY not set — cannot forward to mi-core', { chat: event.chat_name });
    return { ok: false, error: 'MI_CORE_API_KEY not configured' };
  }

  const payload = {
    client_id: 'ceo-observer',
    message_id: event.message_id || `obs-${Date.now()}`,
    sender: event.sender,
    sender_name: event.sender_name || 'CEO',
    chat_id: event.chat_id,
    chat_name: event.chat_name || '',
    is_group: event.is_group || false,
    timestamp: event.timestamp || new Date().toISOString(),
    text: event.workflow_request || event.text,
    raw_text: event.text,
    source: 'ceo-observer-session-a',
    detected_intents: event.intents || [],
    requested_by: 'ceo',
  };

  try {
    const result = await post('/api/whatsapp/mi', payload);
    if (result.ok) {
      sentCount++;
      logger.info('Forwarded CEO event to mi-core', {
        chat: event.chat_name,
        intents: event.intents?.join(','),
        status: result.status,
      });
    } else {
      errorCount++;
      logger.warn('mi-core rejected event', { status: result.status, error: result.body?.error });
    }
    return result;
  } catch (e) {
    errorCount++;
    logger.error('Failed to forward to mi-core', { error: e.message });
    return { ok: false, error: e.message };
  }
}

/**
 * Send a direct GStack request (for complex multi-step workflows).
 */
async function sendGStackRequest(rawRequest, requestedBy = 'ceo') {
  if (!MI_CORE_API_KEY) return { ok: false, error: 'MI_CORE_API_KEY not configured' };

  const result = await post('/api/gstack/process', {
    raw_request: rawRequest,
    requested_by: requestedBy,
    source: 'ceo-observer',
  });

  logger.info('GStack request sent', { request: rawRequest.slice(0, 80), status: result.status });
  return result;
}

function getStats() {
  return { sent: sentCount, errors: errorCount, mi_core_url: MI_CORE_URL };
}

module.exports = { forwardEvent, sendGStackRequest, getStats };
