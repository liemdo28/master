/**
 * CEO Observer API Server — port 3212
 *
 * GET /        — QR scan page (HTML with auto-refresh)
 * GET /qr      — QR code as PNG image
 * GET /health  — health check
 * GET /status  — full status JSON
 * GET /chats   — CEO chat list
 * GET /policy  — whitelist policy
 * POST /policy — update whitelist policy
 */

const http = require('http');
const { getStatus, getChats, getQrData } = require('./ceo-session');
const { getStats } = require('./mi-core-client');
const { loadPolicy, savePolicy } = require('./whitelist');
const logger = require('./logger');

const PORT = parseInt(process.env.OBSERVER_PORT || '3212', 10);

function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data, null, 2));
}

function html(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function router(req, res) {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const path = urlObj.pathname;

  // Root — QR scan page
  if (path === '/' || path === '/qr-page') {
    const status = getStatus();
    const hasQr = !!getQrData();

    if (status.state === 'READY') {
      return html(res, `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>Mi CEO Observer</title>
        <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#fff;}
        .ok{color:#22c55e;font-size:2em;} h1{color:#22c55e;}</style></head><body>
        <h1>✅ CEO Observer — Connected</h1>
        <p class="ok">Session A READY</p>
        <p>Phone: ${status.phone_number} | ${status.account_name}</p>
        <p>Messages observed: ${status.messages_observed} | Tasks detected: ${status.tasks_detected}</p>
        <p style="color:#888;font-size:0.8em">Mi-Core forwarding: ${getStats().sent} sent, ${getStats().errors} errors</p>
        </body></html>`);
    }

    if (!hasQr) {
      return html(res, `<!DOCTYPE html><html><head><meta charset="utf-8">
        <meta http-equiv="refresh" content="3">
        <title>Mi CEO Observer — Waiting for QR</title>
        <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0a;color:#fff;}
        .spin{font-size:2em;animation:spin 1s linear infinite;}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        h1{color:#f59e0b;}</style></head><body>
        <h1>⏳ Mi CEO Observer</h1>
        <div class="spin">⚙️</div>
        <p>Đang khởi động WhatsApp session... (tự refresh sau 3s)</p>
        <p style="color:#888">State: ${status.state}</p>
        </body></html>`);
    }

    // Has QR — show scan page
    return html(res, `<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta http-equiv="refresh" content="30">
      <title>Mi CEO Observer — Scan QR</title>
      <style>
        body{font-family:sans-serif;text-align:center;padding:30px;background:#0a0a0a;color:#fff;}
        h1{color:#f59e0b;margin-bottom:8px;}
        .subtitle{color:#888;margin-bottom:24px;font-size:0.95em;}
        .qr-wrap{display:inline-block;background:#fff;padding:16px;border-radius:12px;margin:16px 0;}
        .qr-wrap img{display:block;width:280px;height:280px;}
        .step{background:#1a1a1a;border-radius:8px;padding:12px 20px;margin:8px auto;max-width:420px;text-align:left;}
        .step span{color:#f59e0b;font-weight:bold;}
        .warn{color:#ef4444;font-size:0.85em;margin-top:16px;}
        .refresh{color:#888;font-size:0.8em;margin-top:24px;}
      </style></head><body>
      <h1>📱 Quét QR — CEO Account (Session A)</h1>
      <p class="subtitle">Dùng điện thoại CEO (account chính) để quét</p>

      <div class="qr-wrap">
        <img src="/qr" alt="WhatsApp QR Code">
      </div>

      <div class="step"><span>1.</span> Mở WhatsApp trên điện thoại CEO</div>
      <div class="step"><span>2.</span> Vào Settings → Linked Devices → Link a Device</div>
      <div class="step"><span>3.</span> Quét QR code bên trên</div>
      <div class="step"><span>4.</span> Trang này tự reload khi kết nối thành công</div>

      <p class="warn">⚠️ Đây là SESSION A — account chính của CEO, KHÔNG phải account Mi Assistant</p>
      <p class="refresh">Auto-refresh mỗi 30s • QR hết hạn sau ~60s</p>
      </body></html>`);
  }

  // /qr — QR code as PNG
  if (path === '/qr') {
    const qrData = getQrData();
    if (!qrData) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('No QR available yet');
    }
    try {
      const QRCode = require('qrcode');
      const img = await QRCode.toBuffer(qrData, { width: 280, margin: 2 });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
      return res.end(img);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('QR generation failed: ' + e.message);
    }
  }

  if (path === '/health') {
    const status = getStatus();
    return json(res, 200, { ok: true, state: status.state, phone: status.phone_number });
  }

  if (path === '/status') {
    return json(res, 200, {
      session_a: getStatus(),
      mi_core_forwarding: getStats(),
      timestamp: new Date().toISOString(),
    });
  }

  if (path === '/policy' && req.method === 'GET') {
    return json(res, 200, loadPolicy());
  }

  if (path === '/policy' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        savePolicy({ ...loadPolicy(), ...update });
        json(res, 200, { ok: true, policy: loadPolicy() });
      } catch (e) {
        json(res, 400, { ok: false, error: e.message });
      }
    });
    return;
  }

  if (path === '/chats') {
    const chats = await getChats();
    return json(res, 200, {
      count: chats.length,
      chats: chats.slice(0, 50).map(c => ({
        id: c.id?._serialized,
        name: c.name,
        is_group: c.isGroup,
        unread_count: c.unreadCount,
        last_message: c.lastMessage?.body?.slice(0, 60),
      })),
    });
  }

  json(res, 404, { error: 'Not found' });
}

function start() {
  const server = http.createServer((req, res) => {
    router(req, res).catch(e => {
      logger.error('API error', { error: e.message });
      json(res, 500, { error: e.message });
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`CEO Observer web UI: http://localhost:${PORT}/`);
  });

  return server;
}

module.exports = { start };
