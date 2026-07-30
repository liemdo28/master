<?php
$pageTitle = t('page.settings');
$currentPage = 'settings';
ob_start();
$timezoneOptions = [
    'America/Chicago' => 'America/Chicago (Central)',
    'America/Los_Angeles' => 'America/Los_Angeles (Pacific)',
    'America/New_York' => 'America/New_York (Eastern)',
    'Asia/Ho_Chi_Minh' => 'Asia/Ho_Chi_Minh',
    'UTC' => 'UTC',
];
?>

<div class="grid grid-2">
    <!-- Profile -->
    <div class="card">
        <div class="card-header"><h3><?= e(t('settings.profile')) ?></h3></div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/settings">
                <div class="form-group">
                    <label><?= e(t('settings.name')) ?></label>
                    <input type="text" name="name" class="form-control" value="<?= e($user['name']) ?>" required>
                </div>
                <div class="form-group">
                    <label><?= e(t('settings.email')) ?></label>
                    <input type="email" name="email" class="form-control" value="<?= e($user['email']) ?>" required>
                </div>
                <div class="form-group">
                    <label>Timezone</label>
                    <select name="timezone" class="form-control">
                        <option value="">Default (<?= e(APP_DEFAULT_TIMEZONE) ?>)</option>
                        <?php foreach ($timezoneOptions as $tzValue => $tzLabel): ?>
                        <option value="<?= e($tzValue) ?>" <?= ($user['timezone'] ?? '') === $tzValue ? 'selected' : '' ?>><?= e($tzLabel) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <div class="text-sm text-muted" style="margin-top:6px">Calendar highlights and overdue logic use this timezone.</div>
                </div>

                <div style="border-top:1px solid var(--border);margin:20px 0;padding-top:20px">
                    <h4 style="font-size:14px;margin-bottom:14px"><?= e(t('settings.change_password')) ?></h4>
                    <p class="text-sm text-muted mb-3"><?= e(t('settings.password_leave_blank')) ?></p>
                    <div class="form-group">
                        <label><?= e(t('settings.current_password')) ?></label>
                        <input type="password" name="current_password" class="form-control" autocomplete="current-password">
                    </div>
                    <div class="form-group">
                        <label><?= e(t('settings.new_password')) ?></label>
                        <input type="password" name="new_password" class="form-control" minlength="6" autocomplete="new-password">
                    </div>
                    <div class="form-group">
                        <label><?= e(t('settings.confirm_password')) ?></label>
                        <input type="password" name="confirm_password" class="form-control" minlength="6" autocomplete="new-password">
                    </div>
                </div>

                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <button type="submit" class="btn btn-primary"><?= e(t('settings.save')) ?></button>
            </form>
        </div>
    </div>

    <!-- Notifications -->
    <div class="card">
        <div class="card-header"><h3><?= e(t('settings.notifications')) ?></h3></div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/settings">
                <input type="hidden" name="name" value="<?= e($user['name']) ?>">
                <input type="hidden" name="email" value="<?= e($user['email']) ?>">
                <input type="hidden" name="timezone" value="<?= e($user['timezone'] ?? '') ?>">

                <div class="flex-between" style="padding:16px 0;border-bottom:1px solid var(--border)">
                    <div>
                        <div style="font-weight:600;font-size:14px"><?= e(t('settings.email_notifications')) ?></div>
                        <div class="text-sm text-muted" style="margin-top:4px"><?= e(t('settings.email_notifications_desc')) ?></div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" name="email_notifications" value="1" <?= !empty($user['email_notifications']) ? 'checked' : '' ?>>
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="flex-between" style="padding:16px 0">
                    <div>
                        <div style="font-weight:600;font-size:14px"><?= e(t('settings.weekly_report')) ?></div>
                        <div class="text-sm text-muted" style="margin-top:4px"><?= e(t('settings.weekly_report_desc')) ?></div>
                    </div>
                    <span class="text-sm text-muted"><?= e(t('settings.auto_with_email')) ?></span>
                </div>

                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <button type="submit" class="btn btn-primary mt-3"><?= e(t('settings.save')) ?></button>
            </form>
        </div>
    </div>
</div>

<!-- ── Telegram Integration ─────────────────────────────────────────────── -->
<div class="card" style="margin-top:24px">
    <div class="card-header" style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">✈️</span>
        <h3 style="margin:0">Telegram Bot</h3>
        <?php if (!empty($telegramLink)): ?>
        <span style="margin-left:auto;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(34,197,94,.15);color:#22C55E">● Đã kết nối</span>
        <?php else: ?>
        <span style="margin-left:auto;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(148,163,184,.12);color:#94A3B8">Chưa kết nối</span>
        <?php endif; ?>
    </div>
    <div class="card-body">

    <?php if (!empty($telegramLink)): ?>
        <!-- Connected state -->
        <div style="display:flex;align-items:center;gap:12px;padding:14px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:10px;margin-bottom:20px">
            <div style="font-size:28px">✅</div>
            <div>
                <div style="font-weight:700;font-size:14px">Tài khoản Telegram đã được liên kết</div>
                <div style="font-size:12px;color:var(--text-muted)">
                    @<?= e($telegramLink['telegram_username'] ?? 'unknown') ?>
                    · Kết nối lúc <?= date('d/m/Y H:i', strtotime($telegramLink['linked_at'])) ?>
                </div>
            </div>
        </div>

        <!-- Preferences form -->
        <form id="tg-prefs-form">
            <div style="font-weight:700;font-size:13px;margin-bottom:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Cài đặt thông báo</div>

            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div>
                    <div style="font-weight:600;font-size:14px">Tóm tắt task hàng sáng</div>
                    <div class="text-sm text-muted">Bot gửi danh sách task due trong ngày</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                    <input type="time" name="daily_summary_time" value="<?= e($telegramPrefs['daily_summary_time'] ?? '08:00') ?>"
                           style="background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;font-size:13px">
                    <label class="toggle-switch">
                        <input type="checkbox" name="daily_summary_enabled" value="1" <?= !empty($telegramPrefs['daily_summary_enabled']) ? 'checked' : '' ?>>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div>
                    <div style="font-weight:600;font-size:14px">Khi được assign task</div>
                    <div class="text-sm text-muted">Thông báo ngay khi có task mới được giao</div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" name="notify_on_assign" value="1" <?= !empty($telegramPrefs['notify_on_assign']) ? 'checked' : '' ?>>
                    <span class="toggle-slider"></span>
                </label>
            </div>

            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div>
                    <div style="font-weight:600;font-size:14px">Khi được @mention</div>
                    <div class="text-sm text-muted">Thông báo khi ai đó mention bạn trong comment</div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" name="notify_on_mention" value="1" <?= !empty($telegramPrefs['notify_on_mention']) ? 'checked' : '' ?>>
                    <span class="toggle-slider"></span>
                </label>
            </div>

            <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div>
                    <div style="font-weight:600;font-size:14px">Deadline gần (2h)</div>
                    <div class="text-sm text-muted">Nhắc trước 2 tiếng khi task sắp due</div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" name="notify_on_deadline" value="1" <?= !empty($telegramPrefs['notify_on_deadline']) ? 'checked' : '' ?>>
                    <span class="toggle-slider"></span>
                </label>
            </div>

            <div class="flex-between" style="padding:10px 0">
                <div>
                    <div style="font-weight:600;font-size:14px">Cập nhật task</div>
                    <div class="text-sm text-muted">Khi task bạn theo dõi có thay đổi</div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" name="notify_on_task_update" value="1" <?= !empty($telegramPrefs['notify_on_task_update']) ? 'checked' : '' ?>>
                    <span class="toggle-slider"></span>
                </label>
            </div>

            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
                <button type="button" onclick="saveTgPrefs()" class="btn btn-primary">Lưu cài đặt</button>
                <button type="button" onclick="unlinkTelegram()" class="btn btn-ghost" style="color:#EF4444;border-color:rgba(239,68,68,.3)">Huỷ kết nối</button>
            </div>
        </form>

    <?php else: ?>
        <!-- Not connected state -->
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px">
            Kết nối Telegram để nhận thông báo task và tương tác với AI ngay trong chat.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px">
            <?php foreach ([
                ['☀️','Daily summary','Danh sách task mỗi sáng'],
                ['🔔','Thông báo realtime','Assign, mention, deadline'],
                ['🤖','Tạo task bằng AI','Gõ tự do, AI parse ra task'],
                ['💬','Hỏi đáp','Hỏi tình trạng task bằng tiếng Việt'],
            ] as [$icon,$title,$desc]): ?>
            <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:14px">
                <div style="font-size:22px;margin-bottom:6px"><?= $icon ?></div>
                <div style="font-weight:700;font-size:13px"><?= $title ?></div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:3px"><?= $desc ?></div>
            </div>
            <?php endforeach; ?>
        </div>
        <button onclick="initTelegramLink()" class="btn btn-primary" style="gap:8px">
            ✈️ Kết nối Telegram
        </button>
    <?php endif; ?>

    </div>
</div>

<script>
var CSRF = '<?= csrf_token() ?>';
var BASE = '<?= APP_URL ?>';

function initTelegramLink() {
    var btn = event.target;
    btn.textContent = '⏳ Đang tạo link…';
    btn.disabled = true;

    fetch(BASE + '/telegram/link/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf_token: CSRF })
    })
    .then(r => r.json())
    .then(d => {
        if (d.ok && d.url) {
            window.open(d.url, '_blank');
            btn.textContent = '✅ Link đã mở — bấm Start trong Telegram';
            btn.disabled = false;
        } else {
            alert(d.error || 'Lỗi tạo link');
            btn.textContent = '✈️ Kết nối Telegram';
            btn.disabled = false;
        }
    })
    .catch(() => { alert('Lỗi kết nối'); btn.disabled = false; });
}

function saveTgPrefs() {
    var form = document.getElementById('tg-prefs-form');
    var data = new URLSearchParams({ csrf_token: CSRF });
    var checks = ['daily_summary_enabled','notify_on_assign','notify_on_mention','notify_on_deadline','notify_on_task_update'];
    checks.forEach(function(k) {
        var el = form.querySelector('[name="' + k + '"]');
        if (el && el.checked) data.append(k, '1');
    });
    var timeEl = form.querySelector('[name="daily_summary_time"]');
    if (timeEl) data.append('daily_summary_time', timeEl.value);

    fetch(BASE + '/telegram/preferences', { method: 'POST', body: data })
    .then(r => r.json())
    .then(d => { if (d.ok) alert('Đã lưu cài đặt Telegram.'); else alert('Lỗi lưu.'); });
}

function unlinkTelegram() {
    if (!confirm('Huỷ kết nối Telegram? Bạn sẽ không nhận thông báo nữa.')) return;
    fetch(BASE + '/telegram/link/unlink', {
        method: 'POST',
        body: new URLSearchParams({ csrf_token: CSRF })
    })
    .then(r => r.json())
    .then(d => { if (d.ok) location.reload(); });
}
</script>

<style>
.toggle-switch{position:relative;display:inline-block;width:48px;height:26px}
.toggle-switch input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:var(--bg-tertiary);border:1px solid var(--border);transition:.3s;border-radius:26px}
.toggle-slider:before{content:'';position:absolute;height:20px;width:20px;left:2px;bottom:2px;background:var(--text-muted);transition:.3s;border-radius:50%}
.toggle-switch input:checked+.toggle-slider{background:var(--accent);border-color:var(--accent)}
.toggle-switch input:checked+.toggle-slider:before{transform:translateX(22px);background:#fff}
</style>

<?php if (isAdmin()): ?>
<!-- ── Admin: Quick links ───────────────────────────────────────────────── -->
<div style="margin-top:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">
  <a href="<?= APP_URL ?>/settings/telegram" style="text-decoration:none;">
    <div class="card" style="display:flex;align-items:center;gap:14px;padding:16px 20px;transition:background .15s;cursor:pointer;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
      <div style="width:38px;height:38px;border-radius:10px;background:#229ED9;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.64 6.8-1.68 7.68c-.12.54-.44.68-.88.42l-2.5-1.84-1.21 1.17c-.13.13-.24.24-.48.24l.17-2.55 4.61-4.16c.19-.17-.04-.27-.29-.1L8.67 13.22l-2.47-.76c-.53-.16-.54-.52.12-.78l9.61-3.66c.44-.16.83.1.71.8z" fill="white"/></svg>
      </div>
      <div>
        <div style="font-weight:600;font-size:14px;">Telegram Settings</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Connect · Webhook · Test send</div>
      </div>
    </div>
  </a>
  <a href="<?= APP_URL ?>/admin/users" style="text-decoration:none;">
    <div class="card" style="display:flex;align-items:center;gap:14px;padding:16px 20px;transition:background .15s;cursor:pointer;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
      <div style="width:38px;height:38px;border-radius:10px;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <div>
        <div style="font-weight:600;font-size:14px;">User Detail View</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Full admin panel · Task history</div>
      </div>
    </div>
  </a>
  <a href="<?= APP_URL ?>/admin/deadline-extensions" style="text-decoration:none;">
    <div class="card" style="display:flex;align-items:center;gap:14px;padding:16px 20px;transition:background .15s;cursor:pointer;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
      <div style="width:38px;height:38px;border-radius:10px;background:#f59e0b;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div>
        <div style="font-weight:600;font-size:14px;">Deadline Extensions</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Approve · Reject · Pending queue</div>
      </div>
    </div>
  </a>
</div>
<?php endif; ?>

<?php if (false && isAdmin() && !empty($allUsers)): ?>
<!-- ── Admin: User Management ────────────────────────────────────────────── -->
<div style="margin-top:28px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <div>
      <h2 style="margin:0;font-size:16px;font-weight:700;">User Management</h2>
      <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);"><?= count($allUsers) ?> accounts — click a row to edit</p>
    </div>
    <button onclick="document.getElementById('createUserPanel').style.display=document.getElementById('createUserPanel').style.display==='none'?'block':'none'"
            class="btn btn-primary" style="font-size:13px;">+ New User</button>
  </div>

  <!-- Create user panel (hidden by default) -->
  <div id="createUserPanel" style="display:none;margin-bottom:16px;">
    <div class="card">
      <div class="card-header"><h3>Create New User</h3></div>
      <div class="card-body">
        <form method="POST" action="<?= APP_URL ?>/admin/users" style="display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:10px;align-items:end;">
          <div class="form-group" style="margin:0;">
            <label style="font-size:12px;">Full Name</label>
            <input type="text" name="name" class="form-control" required placeholder="Name">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:12px;">Email</label>
            <input type="email" name="email" class="form-control" required placeholder="email@example.com">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:12px;">Password</label>
            <input type="password" name="password" class="form-control" required minlength="6" placeholder="Min 6 chars">
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-size:12px;">Role</label>
            <select name="role" class="form-control">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="white-space:nowrap;">Create</button>
        </form>
      </div>
    </div>
  </div>

  <!-- User table -->
  <div class="card">
    <div class="card-body" style="padding:0;">
      <table class="data-table" style="font-size:13px;">
        <thead>
          <tr>
            <th style="width:32px;"></th>
            <th>Name</th>
            <th>Email</th>
            <th style="width:100px;">Role</th>
            <th style="width:80px;">Status</th>
            <th style="width:90px;"></th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($allUsers as $u): ?>
          <tr style="cursor:pointer;" onclick="openEditUser(<?= $u['id'] ?>, <?= json_encode($u) ?>)">
            <td>
              <div class="user-avatar" style="width:28px;height:28px;font-size:11px;margin:0 auto;">
                <?= strtoupper(substr($u['name'],0,1)) ?>
              </div>
            </td>
            <td style="font-weight:600;"><?= e($u['name']) ?><?= $u['id']==$_SESSION['user_id'] ? ' <span style="font-size:11px;color:var(--text-muted);">(you)</span>' : '' ?></td>
            <td style="color:var(--text-muted);"><?= e($u['email']) ?></td>
            <td>
              <span class="badge badge-<?= e($u['role']) ?>"><?= e(ucfirst($u['role'])) ?></span>
            </td>
            <td>
              <span class="badge badge-<?= $u['is_active'] ? 'active' : 'inactive' ?>">
                <?= $u['is_active'] ? 'Active' : 'Inactive' ?>
              </span>
            </td>
            <td onclick="event.stopPropagation();" style="white-space:nowrap;">
              <?php if ($u['id'] != $_SESSION['user_id']): ?>
              <a href="<?= APP_URL ?>/admin/users/<?= $u['id'] ?>/toggle" class="btn-ghost" title="Toggle active" style="font-size:16px;"><?= $u['is_active'] ? '🔒' : '🔓' ?></a>
              <a href="<?= APP_URL ?>/admin/users/<?= $u['id'] ?>/delete" class="btn-ghost" onclick="return confirm('Delete <?= e(addslashes($u['name'])) ?>?')" title="Delete" style="font-size:16px;">🗑</a>
              <?php endif; ?>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Edit user modal -->
<div id="editUserModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center;">
  <div style="background:var(--bg-primary);border-radius:14px;padding:28px 32px;width:100%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="margin:0;font-size:16px;">Edit User</h3>
      <button onclick="document.getElementById('editUserModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">×</button>
    </div>
    <div class="form-group">
      <label style="font-size:12px;">Full Name</label>
      <input type="text" id="editName" class="form-control">
    </div>
    <div class="form-group">
      <label style="font-size:12px;">Email</label>
      <input type="email" id="editEmail" class="form-control">
    </div>
    <div class="form-group">
      <label style="font-size:12px;">Role</label>
      <select id="editRole" class="form-control">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
        <option value="manager">Manager</option>
      </select>
    </div>
    <div class="form-group">
      <label style="font-size:12px;">New Password <span style="color:var(--text-muted);font-weight:400;">(leave blank to keep current)</span></label>
      <input type="password" id="editPassword" class="form-control" minlength="6" placeholder="Leave blank to keep">
    </div>
    <div style="display:flex;gap:10px;margin-top:20px;">
      <button id="saveUserBtn" class="btn btn-primary" style="flex:1;">Save Changes</button>
      <button onclick="document.getElementById('editUserModal').style.display='none'" class="btn btn-secondary">Cancel</button>
    </div>
    <div id="editUserMsg" style="margin-top:10px;font-size:13px;display:none;"></div>
  </div>
</div>

<script>
const ADMIN_CSRF = <?= json_encode(csrf_token()) ?>;
let _editingUserId = null;

function openEditUser(id, u) {
  _editingUserId = id;
  document.getElementById('editName').value    = u.name  || '';
  document.getElementById('editEmail').value   = u.email || '';
  document.getElementById('editRole').value    = u.role  || 'member';
  document.getElementById('editPassword').value = '';
  document.getElementById('editUserMsg').style.display = 'none';
  document.getElementById('editUserModal').style.display = 'flex';
}

document.getElementById('saveUserBtn').addEventListener('click', async function () {
  if (!_editingUserId) return;
  this.disabled = true; this.textContent = 'Saving…';
  const body = new URLSearchParams({
    csrf_token:   ADMIN_CSRF,
    name:         document.getElementById('editName').value.trim(),
    email:        document.getElementById('editEmail').value.trim(),
    role:         document.getElementById('editRole').value,
    new_password: document.getElementById('editPassword').value,
  });
  try {
    const res  = await fetch(`/api/admin/users/${_editingUserId}/update`, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: body.toString(),
    });
    const data = await res.json();
    const msgEl = document.getElementById('editUserMsg');
    msgEl.style.display = 'block';
    if (data.ok) {
      msgEl.style.color = '#28a745';
      msgEl.textContent = '✅ Saved! Refreshing…';
      setTimeout(() => location.reload(), 900);
    } else {
      msgEl.style.color = '#dc3545';
      msgEl.textContent = '❌ ' + (data.error || 'Failed');
    }
  } catch(e) {
    const msgEl = document.getElementById('editUserMsg');
    msgEl.style.display='block'; msgEl.style.color='#dc3545'; msgEl.textContent='❌ Network error';
  }
  this.disabled=false; this.textContent='Save Changes';
});
</script>
<?php endif; ?>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
