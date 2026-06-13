/**
 * Agent/MI HTTP Forwarder
 *
 * Forwards WhatsApp messages to Agent-Coding or Mi-Core endpoints.
 * Includes timeout protection, retry policy, response validation,
 * and audit logging. Never leaks API keys in logs.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const { makeLogger } = require('../logger');
const projectClientRegistry = require('../security/project-client-registry');
const auditLog = require('../security/api-key-audit-log');
const { run } = require('../storage/sqlite');

const log = makeLogger('agent-mi-forwarder');

const TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 1;

/**
 * Redact sensitive fields from a payload for safe logging.
 */
function sanitizeForLog(payload) {
  if (!payload) return payload;
  const sanitized = { ...payload };
  if (sanitized.api_key) sanitized.api_key = '***REDACTED***';
  return sanitized;
}

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine the target URL for forwarding.
 * Uses process.env for callback URLs with sensible defaults.
 * @param {string} clientId - 'agent-coding' or 'mi-core'
 * @returns {Promise<string>}
 */
async function getTargetUrl(clientId) {
  if (clientId === 'agent-coding') {
    const base = process.env.AGENT_CODING_URL || 'http://localhost:3100';
    return base.replace(/\/+$/, '') + '/api/whatsapp/agent';
  }
  if (clientId === 'mi-core') {
    const base = process.env.MI_CORE_URL || 'http://localhost:4001';
    return base.replace(/\/+$/, '') + '/api/whatsapp/mi';
  }
  throw new Error('Unknown client_id: ' + clientId);
}

/**
 * Resolve the API key for a client from the database.
 * @param {string} clientId
 * @returns {Promise<string>}
 */
async function resolveApiKey(clientId) {
  // The raw key is NOT stored. For forwarding, we use a config-based approach:
  // the calling service embeds its key in the environment, or the forwarder
  // looks up a shared secret from env. This avoids storing raw keys.
  if (clientId === 'agent-coding') {
    return process.env.AGENT_CODING_API_KEY || '';
  }
  if (clientId === 'mi-core') {
    return process.env.MI_CORE_API_KEY || '';
  }
  return '';
}

/**
 * Make an HTTP POST request.
 * @param {string} targetUrl
 * @param {Object} payload
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: boolean, statusCode: number, body: Object }>}
 */
function httpPost(targetUrl, payload, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const body = JSON.stringify(payload);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'whatsapp-ai-gateway/1.0',
      },
      timeout: timeoutMs,
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ ok: false, statusCode: res.statusCode, body: { error: 'Invalid JSON response', raw: data.slice(0, 200) } });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout after ' + timeoutMs + 'ms'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Validate the response from the target service.
 * Expected format: { ok: true, reply: string, actions?: [], approval_required?: bool, approval_id?: string, metadata?: {} }
 */
function validateResponse(responseBody) {
  if (!responseBody) return { valid: false, reason: 'Empty response' };
  if (responseBody.ok !== true) return { valid: false, reason: 'Service returned error', detail: responseBody.error || 'unknown' };
  if (typeof responseBody.reply !== 'string' || !responseBody.reply) return { valid: false, reason: 'Missing or empty reply field' };
  return { valid: true };
}

/**
 * Record a routed message in the database.
 */
async function recordRoutedMessage({ sourceChat, commandPrefix, targetProject, requestBody, responseBody, actionTaken, approvalStatus, clientId, durationMs, success }) {
  try {
    await run(
      `INSERT INTO routed_messages (source_chat, command_prefix, target_project, request_body, response_body, action_taken, approval_status, timestamp, client_id, duration_ms, success)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sourceChat || '', commandPrefix || '', targetProject || '', JSON.stringify(requestBody || {}), JSON.stringify(responseBody || {}), actionTaken || '', approvalStatus || 'none', new Date().toISOString(), clientId || '', durationMs || 0, success ? 1 : 0]
    );
  } catch (err) {
    log.warn('Failed to record routed message', { error: err.message });
  }
}

/**
 * Build a safe error reply.
 */
function safeErrorReply(clientId) {
  if (clientId === 'agent-coding') {
    return 'Em chưa kết nối được Agent-Coding lúc này. Anh thử lại sau nhé.';
  }
  // Mi-Core — executive-style graceful degradation
  const replies = [
    'Em đang bị chậm lúc này — có thể do AI engine đang tải. Anh thử lại sau vài giây nhé. Em vẫn đang hoạt động.',
    'Em chưa truy cập được Knowledge Universe lúc này. Anh thử lại giúp em trong ít phút nhé — các tính năng khác vẫn hoạt động bình thường.',
    'Em đang gặp lỗi khi truy cập dữ liệu. Em vẫn đang hoạt động nhưng chưa lấy được thông tin mới nhất. Anh thử lại nhé.',
  ];
  return replies[Math.floor(Date.now() / 10000) % replies.length];
}

/**
 * Forward a payload to the target service with retry.
 * @param {Object} payload - The message payload
 * @param {string} clientId - 'agent-coding' or 'mi-core'
 * @param {string} commandPrefix - '/agent' or '/mi'
 * @returns {Promise<{ ok: boolean, reply: string|null, error: string|null }>}
 */
async function forward(payload, clientId, commandPrefix) {
  const startTime = Date.now();
  const targetUrl = await getTargetUrl(clientId);
  const apiKey = await resolveApiKey(clientId);

  // Inject API key into payload
  const enrichedPayload = { ...payload, api_key: apiKey };

  let lastError = null;
  let response = null;
  let lastResponseBody = null;
  let lastStatusCode = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      log.info('Retrying forward', { clientId, attempt, targetUrl });
      await sleep(RETRY_DELAY_MS);
    }

    try {
      log.info('Forwarding message', {
        clientId,
        targetUrl,
        text: (payload.text || '').slice(0, 60),
        attempt: attempt + 1,
        body: sanitizeForLog(enrichedPayload),
      });

      response = await httpPost(targetUrl, enrichedPayload, TIMEOUT_MS);
      lastStatusCode = response.statusCode;
      lastResponseBody = response.body;

      if (!response.ok) {
        lastError = 'HTTP ' + response.statusCode;
        log.warn('Forward returned non-OK status', { clientId, statusCode: response.statusCode, body: response.body });
        continue;
      }

      const validation = validateResponse(response.body);
      if (!validation.valid) {
        lastError = validation.detail ? validation.reason + ': ' + validation.detail : validation.reason;
        log.warn('Forward response validation failed', { clientId, reason: validation.reason });
        continue;
      }

      // Success
      const durationMs = Date.now() - startTime;
      const approvalStatus = response.body.approval_required ? 'pending_approval' : 'none';

      await recordRoutedMessage({
        sourceChat: payload.chat_id,
        commandPrefix,
        targetProject: clientId,
        requestBody: sanitizeForLog(enrichedPayload),
        responseBody: response.body,
        actionTaken: response.body.actions ? response.body.actions.join(',') : '',
        approvalStatus,
        clientId,
        durationMs,
        success: true,
      });

      await auditLog.record({
        clientId,
        action: auditLog.ACTIONS.ROUTE_SENT,
        detail: 'Message forwarded to ' + targetUrl,
        success: true,
      });

      log.info('Forward success', { clientId, durationMs, hasReply: !!response.body.reply });

      return {
        ok: true,
        reply: response.body.reply,
        actions: response.body.actions || [],
        approval_required: !!response.body.approval_required,
        approval_id: response.body.approval_id || null,
        metadata: response.body.metadata || {},
      };
    } catch (err) {
      lastError = err.message;
      log.warn('Forward attempt failed', { clientId, attempt: attempt + 1, error: err.message });
    }
  }

  // All attempts failed
  const durationMs = Date.now() - startTime;

  await recordRoutedMessage({
    sourceChat: payload.chat_id,
    commandPrefix,
    targetProject: clientId,
    requestBody: sanitizeForLog(enrichedPayload),
    responseBody: lastResponseBody || { error: lastError },
    actionTaken: '',
    approvalStatus: 'none',
    clientId,
    durationMs,
    success: false,
  });

  await auditLog.record({
    clientId,
    action: auditLog.ACTIONS.ROUTE_FAILED,
    detail: 'Forward failed after ' + (MAX_RETRIES + 1) + ' attempts: ' + lastError,
    success: false,
  });

  return {
    ok: false,
    reply: safeErrorReply(clientId),
    error: lastError,
    statusCode: lastStatusCode,
    response_body: lastResponseBody,
  };
}

/**
 * Forward to Agent-Coding endpoint.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function forwardToAgent(payload) {
  return forward(payload, 'agent-coding', '/agent');
}

/**
 * Forward to Mi-Core endpoint.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function forwardToMi(payload) {
  return forward(payload, 'mi-core', '/mi');
}

module.exports = {
  forwardToAgent,
  forwardToMi,
  forward,
  getTargetUrl,
};
