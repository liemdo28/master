<?php
/**
 * views/telegram/connect.php — Telegram connection settings page.
 */
$pageTitle = 'Telegram Settings';
$currentPage = 'settings';
$csrfToken = csrf_token();
ob_start();
?>

<div style="max-width:780px;margin:0 auto;">

  <!-- Page header -->
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;">
    <div style="width:44px;height:44px;border-radius:12px;background:#229ED9;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.64 6.8-1.68 7.68c-.12.54-.44.68-.88.42l-2.5-1.84-1.21 1.17c-.13.13-.24.24-.48.24l.17-2.55 4.61-4.16c.19-.17-.04-.27-.29-.1L8.67 13.22l-2.47-.76c-.53-.16-.54-.52.12-.78l9.61-3.66c.44-.16.83.1.71.8z" fill="white"/></svg>
    </div>
    <div>
      <h1 style="margin:0;font-size:20px;font-weight:700;">Telegram Integration</h1>
      <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted);">Connect your Telegram to receive reminders and manage tasks via bot.</p>
    </div>
  </div>

  <?php if (!$botConfigured): ?>
  <div class="card" style="border-left:4px solid #ffc107;margin-bottom:20px;">
    <div class="card-body" style="display:flex;gap:12px;align-items:flex-start;">
      <span style="font-size:20px;">⚠️</span>
      <div>
        <strong>Bot not configured</strong>
        <p style="margin:4px 0 0;font-size:13px;color:var(--text-muted);">Set <code>TELEGRAM_BOT_TOKEN</code> in environment or <code>config/telegram.local.php</code>.</p>
      </div>
    </div>
  </div>
  <?php endif; ?>

  <!-- Connection status -->
  <div class="card" style="margin-bottom:20px;">
    <div class="card-header"><h3>Connection Status</h3></div>
    <div class="card-body">

      <?php if ($isConnected): ?>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(40,167,69,.15);color:#28a745;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;">
            <span style="width:8px;height:8px;border-radius:50%;background:#28a745;display:inline-block;"></span>Connected
          </span>
        </div>
        <div style="background:var(--bg-secondary);border-radius:8px;padding:14px 16px;margin-bottom:18px;">
          <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 0;font-size:13px;">
            <?php if (!empty($connection['first_name'])): ?>
            <span style="color:var(--text-muted);">Name</span>
            <span style="font-weight:600;"><?= e($connection['first_name']) ?><?= !empty($connection['last_name']) ? ' '.e($connection['last_name']) : '' ?></span>
            <?php endif; ?>
            <?php if (!empty($connection['telegram_username'])): ?>
            <span style="color:var(--text-muted);">Username</span>
            <span><a href="https://t.me/<?= e($connection['telegram_username']) ?>" target="_blank" style="color:#229ED9;">@<?= e($connection['telegram_username']) ?></a></span>
            <?php endif; ?>
            <?php if (!empty($connection['telegram_chat_id'])): ?>
            <span style="color:var(--text-muted);">Chat ID</span>
            <span style="font-family:monospace;font-size:12px;"><?= e($connection['telegram_chat_id']) ?></span>
            <?php endif; ?>
            <?php if (!empty($connection['updated_at'])): ?>
            <span style="color:var(--text-muted);">Connected</span>
            <span><?= e(date('M j, Y g:i A', strtotime($connection['updated_at']))) ?></span>
            <?php endif; ?>
          </div>
        </div>
        <button id="disconnectBtn" class="btn btn-danger" style="font-size:13px;">🔌 Disconnect</button>

      <?php else: ?>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
          <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(220,53,69,.12);color:#dc3545;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:600;">
            <span style="width:8px;height:8px;border-radius:50%;background:#dc3545;display:inline-block;"></span>Not Connected
          </span>
        </div>

        <div style="background:var(--bg-secondary);border-radius:8px;padding:14px 16px;margin-bottom:18px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;">How to connect:</p>
          <ol style="margin:0;padding-left:18px;font-size:13px;color:var(--text-muted);line-height:1.8;">
            <li>Click <strong>Generate Code</strong> below</li>
            <li>Open Telegram → find your TaskFlow bot</li>
            <li>Send the <code>/connect CODE</code> command shown</li>
            <li>Done — your account will be linked instantly</li>
          </ol>
        </div>

        <div id="connectCodeArea" style="display:none;background:rgba(34,158,217,.1);border:1px solid #229ED9;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#229ED9;">Send this to the bot:</p>
          <div style="display:flex;align-items:center;gap:8px;">
            <code id="connectCodeText" style="flex:1;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:16px;font-family:monospace;letter-spacing:2px;"></code>
            <button onclick="copyConnectCode(this)" style="padding:8px 14px;background:#229ED9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;">Copy</button>
          </div>
          <p id="connectCodeExpiry" style="margin:8px 0 0;font-size:12px;color:var(--text-muted);"></p>
        </div>

        <button id="generateCodeBtn" class="btn btn-primary" <?= !$botConfigured ? 'disabled title="Configure bot token first"' : '' ?>>
          🔑 Generate Connect Code
        </button>
      <?php endif; ?>
    </div>
  </div>

  <!-- Features -->
  <div class="card" style="margin-bottom:20px;">
    <div class="card-header"><h3>Bot Commands</h3></div>
    <div class="card-body">
      <div style="display:grid;gap:10px;">
        <?php
        $features = [
          ['/today',       'See all tasks due today'],
          ['/overdue',     'See overdue tasks that need attention'],
          ['Create task',  '"Pay tax for Raw on April 23" — adds task automatically'],
          ['Query task',   '"When is the tax payment for Raw?" — searches your tasks'],
          ['Daily 8 AM',   'Auto reminder: tasks due today sent each morning'],
        ];
        foreach ($features as [$cmd, $desc]):?>
        <div style="display:flex;align-items:baseline;gap:10px;font-size:13px;">
          <code style="background:var(--bg-secondary);border-radius:4px;padding:2px 8px;white-space:nowrap;flex-shrink:0;"><?= e($cmd) ?></code>
          <span style="color:var(--text-muted);"><?= e($desc) ?></span>
        </div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>

  <?php if (isAdmin()): ?>
  <!-- Admin tools -->
  <div class="card" style="margin-bottom:20px;">
    <div class="card-header"><h3>Admin Tools</h3></div>
    <div class="card-body">

      <div style="margin-bottom:22px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:600;">Register Webhook URL</p>
        <div style="display:flex;gap:8px;">
          <input type="text" id="webhookUrlInput" placeholder="Leave blank to use default (<?= e(defined('APP_URL') ? APP_URL : '') ?>/webhooks/telegram)"
                 style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);color:var(--text-primary);">
          <button id="setWebhookBtn" class="btn btn-secondary" style="white-space:nowrap;">Set Webhook</button>
        </div>
        <div id="webhookResult" style="margin-top:8px;font-size:12px;display:none;"></div>
      </div>

      <div>
        <p style="margin:0 0 10px;font-size:13px;font-weight:600;">Send Test Message</p>
        <div style="display:grid;gap:8px;">
          <input type="text" id="testChatId" placeholder="Telegram Chat ID"
                 style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);color:var(--text-primary);">
          <div style="display:flex;gap:8px;">
            <input type="text" id="testMessage" placeholder='Test message (optional)'
                   style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);color:var(--text-primary);">
            <button id="testSendBtn" class="btn btn-secondary" style="white-space:nowrap;">Send</button>
          </div>
        </div>
        <div id="testSendResult" style="margin-top:8px;font-size:12px;display:none;"></div>
      </div>

    </div>
  </div>
  <?php endif; ?>

</div>

<script>
const CSRF = <?= json_encode($csrfToken) ?>;
let codeExpireTimer = null;

<?php if (!$isConnected): ?>
document.getElementById('generateCodeBtn').addEventListener('click', async function () {
  this.disabled = true;
  this.textContent = 'Generating…';
  try {
    const res  = await fetch('/api/telegram/connect/init', {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: 'csrf_token=' + encodeURIComponent(CSRF),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('connectCodeText').textContent = '/connect ' + data.code;
      document.getElementById('connectCodeArea').style.display = 'block';
      if (codeExpireTimer) clearInterval(codeExpireTimer);
      let remaining = data.expires_in || 900;
      const expEl = document.getElementById('connectCodeExpiry');
      const tick = () => {
        const m = Math.floor(remaining/60), s = remaining%60;
        expEl.textContent = `Expires in ${m}:${String(s).padStart(2,'0')}`;
        if (remaining-- <= 0) { clearInterval(codeExpireTimer); expEl.textContent = 'Code expired — generate a new one.'; }
      };
      tick(); codeExpireTimer = setInterval(tick, 1000);
      this.textContent = '🔄 Regenerate';
    } else {
      alert('Error: ' + (data.error || 'Unknown'));
      this.textContent = '🔑 Generate Connect Code';
    }
  } catch(e) { alert('Network error'); this.textContent = '🔑 Generate Connect Code'; }
  this.disabled = false;
});

function copyConnectCode(btn) {
  navigator.clipboard.writeText(document.getElementById('connectCodeText').textContent)
    .then(() => { btn.textContent='Copied!'; setTimeout(()=>btn.textContent='Copy',2000); });
}
<?php endif; ?>

<?php if ($isConnected): ?>
document.getElementById('disconnectBtn').addEventListener('click', async function () {
  if (!confirm('Disconnect Telegram? You can reconnect anytime.')) return;
  this.disabled = true; this.textContent = 'Disconnecting…';
  const res  = await fetch('/api/telegram/disconnect', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'csrf_token='+encodeURIComponent(CSRF),
  });
  const data = await res.json();
  if (data.ok) location.reload();
  else { alert('Error: '+(data.error||'Unknown')); this.disabled=false; this.textContent='🔌 Disconnect'; }
});
<?php endif; ?>

<?php if (isAdmin()): ?>
document.getElementById('setWebhookBtn').addEventListener('click', async function () {
  const url = document.getElementById('webhookUrlInput').value.trim();
  const el  = document.getElementById('webhookResult');
  this.disabled = true; this.textContent = 'Setting…';
  const body = new URLSearchParams({csrf_token: CSRF});
  if (url) body.set('webhook_url', url);
  try {
    const res  = await fetch('/api/telegram/set-webhook', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
    const data = await res.json();
    el.style.display = 'block';
    el.style.color   = data.ok ? '#28a745' : '#dc3545';
    el.textContent   = data.ok ? '✅ Webhook registered: ' + (data.webhook_url||url) : '❌ ' + (data.error||'Failed');
  } catch(e) { el.style.display='block'; el.style.color='#dc3545'; el.textContent='❌ Network error'; }
  this.disabled=false; this.textContent='Set Webhook';
});

document.getElementById('testSendBtn').addEventListener('click', async function () {
  const chatId = document.getElementById('testChatId').value.trim();
  const msg    = document.getElementById('testMessage').value.trim();
  const el     = document.getElementById('testSendResult');
  if (!chatId) { alert('Enter a Chat ID'); return; }
  this.disabled=true; this.textContent='Sending…';
  const body = new URLSearchParams({csrf_token:CSRF, chat_id:chatId});
  if (msg) body.set('message', msg);
  try {
    const res  = await fetch('/api/telegram/test-send', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
    const data = await res.json();
    el.style.display='block';
    el.style.color  = data.ok ? '#28a745' : '#dc3545';
    el.textContent  = data.ok ? '✅ Message sent!' : '❌ Failed to send.';
  } catch(e) { el.style.display='block'; el.style.color='#dc3545'; el.textContent='❌ Network error'; }
  this.disabled=false; this.textContent='Send';
});
<?php endif; ?>
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
