<?php
$pageTitle   = 'Cấu hình Phạt Deadline';
$currentPage = 'penalty-config';
ob_start();

function fmt_vnd(float $amount): string {
    return number_format($amount, 0, ',', '.') . 'đ';
}
?>
<style>
/* ═══════════════════════════════════════════════════════
   ADMIN — Penalty Config Page
   ═══════════════════════════════════════════════════════ */
.pc-wrap { max-width: 1100px; margin: 0 auto; padding: 0 0 60px; }

.pc-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 0 24px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
    margin-bottom: 28px;
    flex-wrap: wrap; gap: 12px;
}
.pc-header-left h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.pc-header-left p  { font-size: 13px; color: var(--text-muted,#94A3B8); margin: 0; }

.pc-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
    border: none; cursor: pointer; transition: .15s; text-decoration: none;
}
.pc-btn-primary { background: #2563EB; color: #fff; }
.pc-btn-primary:hover { background: #1D4ED8; }
.pc-btn-danger  { background: rgba(239,68,68,.12); color: #EF4444; border: 1px solid rgba(239,68,68,.25); }
.pc-btn-danger:hover  { background: rgba(239,68,68,.22); }
.pc-btn-ghost   { background: rgba(255,255,255,.06); color: var(--text,#F1F5F9); border: 1px solid var(--border,rgba(255,255,255,.1)); }
.pc-btn-ghost:hover   { background: rgba(255,255,255,.1); }
.pc-btn-sm { padding: 5px 10px; font-size: 12px; }

/* Summary KPI strip */
.pc-kpi-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    margin-bottom: 28px;
}
@media(max-width:640px) { .pc-kpi-row { grid-template-columns: 1fr 1fr; } }

.pc-kpi {
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 14px; padding: 18px; border-left: 3px solid transparent;
}
.pc-kpi-red    { border-left-color: #EF4444; }
.pc-kpi-amber  { border-left-color: #F59E0B; }
.pc-kpi-blue   { border-left-color: #3B82F6; }
.pc-kpi-label  { font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .07em; }
.pc-kpi-value  { font-size: 28px; font-weight: 800; line-height: 1.1; margin: 6px 0 2px; }
.pc-kpi-sub    { font-size: 11px; color: var(--text-muted,#94A3B8); }
.pc-kpi-red   .pc-kpi-value { color: #EF4444; }
.pc-kpi-amber .pc-kpi-value { color: #F59E0B; }
.pc-kpi-blue  .pc-kpi-value { color: #3B82F6; }

/* Members table */
.pc-table-wrap {
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 16px; overflow: hidden; margin-bottom: 28px;
}
.pc-table-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
}
.pc-table-head h2 { font-size: 14px; font-weight: 700; margin: 0; }

table.pc-table { width: 100%; border-collapse: collapse; }
table.pc-table th {
    text-align: left; font-size: 11px; font-weight: 700;
    color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em;
    padding: 10px 16px; background: rgba(255,255,255,.03);
    border-bottom: 1px solid var(--border,rgba(255,255,255,.06));
}
table.pc-table td {
    padding: 13px 16px; font-size: 13px;
    border-bottom: 1px solid var(--border,rgba(255,255,255,.04));
    vertical-align: middle;
}
table.pc-table tr:last-child td { border-bottom: none; }
table.pc-table tr:hover td { background: rgba(255,255,255,.025); }

.pc-member-cell { display: flex; align-items: center; gap: 10px; }
.pc-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.pc-member-name  { font-weight: 600; font-size: 14px; }
.pc-member-email { font-size: 11px; color: var(--text-muted,#94A3B8); }

.pc-badge-active   { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(34,197,94,.15); color: #22C55E; }
.pc-badge-inactive { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(148,163,184,.12); color: #94A3B8; }

.pc-amount-cell { display: flex; align-items: center; gap: 8px; }
.pc-amount-input {
    background: rgba(255,255,255,.06); border: 1px solid var(--border,rgba(255,255,255,.12));
    color: var(--text,#F1F5F9); border-radius: 6px; padding: 5px 10px;
    font-size: 13px; font-weight: 600; width: 120px;
}
.pc-amount-input:focus { outline: none; border-color: #2563EB; }

.pc-total-chip {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 12px; font-weight: 700;
}
.pc-total-chip.has-penalty { background: rgba(239,68,68,.12); color: #EF4444; }
.pc-total-chip.no-penalty  { background: rgba(148,163,184,.10); color: #94A3B8; }

/* Add member form */
.pc-add-card {
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 16px; padding: 22px 24px;
}
.pc-add-card h2 { font-size: 14px; font-weight: 700; margin: 0 0 16px; }
.pc-form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.pc-form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 160px; }
.pc-form-group label { font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em; }
.pc-form-select, .pc-form-input {
    background: rgba(255,255,255,.06); border: 1px solid var(--border,rgba(255,255,255,.12));
    color: var(--text,#F1F5F9); border-radius: 8px; padding: 9px 12px;
    font-size: 13px; font-weight: 500;
}
.pc-form-select:focus, .pc-form-input:focus { outline: none; border-color: #2563EB; }
.pc-form-select option { background: #1E293B; }

/* Detail drawer */
.pc-detail-overlay {
    display: none; position: fixed; inset: 0; z-index: 900;
    background: rgba(0,0,0,.65); backdrop-filter: blur(4px);
}
.pc-detail-drawer {
    position: fixed; top: 0; right: -520px; width: 500px; max-width: 95vw;
    height: 100vh; background: var(--bg,#0F172A);
    border-left: 1px solid var(--border,rgba(255,255,255,.1));
    z-index: 901; transition: right .25s ease; overflow-y: auto;
    padding: 24px;
}
.pc-detail-drawer.open { right: 0; }
.pc-drawer-close {
    position: absolute; top: 16px; right: 16px;
    background: rgba(255,255,255,.08); border: none; color: var(--text,#F1F5F9);
    width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
}
.pc-drawer-title { font-size: 16px; font-weight: 800; margin: 0 0 4px; }
.pc-drawer-sub   { font-size: 12px; color: var(--text-muted,#94A3B8); margin-bottom: 20px; }

.pc-late-task-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 0; border-bottom: 1px solid var(--border,rgba(255,255,255,.05));
    font-size: 13px;
}
.pc-late-task-row:last-child { border-bottom: none; }
.pc-late-task-title { font-weight: 600; margin-bottom: 2px; }
.pc-late-task-meta  { font-size: 11px; color: var(--text-muted,#94A3B8); }
.pc-late-amount     { font-weight: 700; color: #EF4444; white-space: nowrap; margin-left: 12px; }

.pc-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 1000;
    background: #1E293B; border: 1px solid var(--border,rgba(255,255,255,.15));
    border-radius: 10px; padding: 12px 18px; font-size: 13px; font-weight: 600;
    box-shadow: 0 8px 32px rgba(0,0,0,.4); display: none;
    animation: toastIn .2s ease;
}
@keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
</style>

<div class="pc-wrap">

    <!-- Header -->
    <div class="pc-header">
        <div class="pc-header-left">
            <h1><?= tf_icon('alert-octagon') ?> Cấu hình Phạt Deadline</h1>
            <p>Quản lý danh sách thành viên bị áp dụng phạt tiền khi thực hiện task trễ deadline.</p>
        </div>
        <div style="display:flex;gap:8px">
            <a href="<?= APP_URL ?>/overview" class="pc-btn pc-btn-ghost"><?= tf_icon('arrow-left') ?> Overview</a>
        </div>
    </div>

    <?php
    $totalPenalized  = count(array_filter($summaries, fn($s) => (int)$s['is_active'] === 1));
    $totalLateTasks  = array_sum(array_column($summaries, 'late_count'));
    $totalPenaltyAll = array_sum(array_column($summaries, 'total_amount'));
    ?>

    <!-- KPI Strip -->
    <div class="pc-kpi-row">
        <div class="pc-kpi pc-kpi-blue">
            <div class="pc-kpi-label"><?= tf_icon('users') ?> Thành viên áp dụng</div>
            <div class="pc-kpi-value"><?= $totalPenalized ?></div>
            <div class="pc-kpi-sub">đang được theo dõi</div>
        </div>
        <div class="pc-kpi pc-kpi-amber">
            <div class="pc-kpi-label"><?= tf_icon('clock') ?> Task trễ (tổng)</div>
            <div class="pc-kpi-value"><?= $totalLateTasks ?></div>
            <div class="pc-kpi-sub">qua tất cả thành viên</div>
        </div>
        <div class="pc-kpi pc-kpi-red">
            <div class="pc-kpi-label"><?= tf_icon('dollar-sign') ?> Tổng tiền phạt</div>
            <div class="pc-kpi-value"><?= fmt_vnd($totalPenaltyAll) ?></div>
            <div class="pc-kpi-sub">luỹ kế hiện tại</div>
        </div>
    </div>

    <!-- Members table -->
    <div class="pc-table-wrap">
        <div class="pc-table-head">
            <h2><?= tf_icon('list') ?> Danh sách thành viên áp dụng phạt</h2>
        </div>
        <?php if (empty($summaries)): ?>
        <div style="padding:40px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:10px"><?= tf_icon('inbox', 32) ?></div>
            <div style="font-size:14px;font-weight:600">Chưa có thành viên nào được cấu hình phạt.</div>
            <div style="font-size:12px;margin-top:4px">Dùng form bên dưới để thêm.</div>
        </div>
        <?php else: ?>
        <table class="pc-table">
            <thead>
                <tr>
                    <th>Thành viên</th>
                    <th>Trạng thái</th>
                    <th>Mức phạt / task trễ</th>
                    <th>Task trễ</th>
                    <th>Tổng phạt</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
            <?php
            $avatarColors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2'];
            foreach ($summaries as $s):
                $uid        = (int)$s['user_id'];
                $isActive   = (bool)(int)$s['is_active'];
                $avatarCol  = $avatarColors[crc32($s['user_name']) % count($avatarColors)];
                $initials   = strtoupper(mb_substr($s['user_name'] ?? 'U', 0, 1));
            ?>
            <tr data-uid="<?= $uid ?>">
                <td>
                    <div class="pc-member-cell">
                        <div class="pc-avatar" style="background:<?= e($avatarCol) ?>"><?= $initials ?></div>
                        <div>
                            <div class="pc-member-name"><?= e($s['user_name']) ?></div>
                            <div class="pc-member-email"><?= e($s['user_email']) ?></div>
                        </div>
                    </div>
                </td>
                <td>
                    <?php if ($isActive): ?>
                    <span class="pc-badge-active"><?= tf_icon('check-circle') ?> Đang áp dụng</span>
                    <?php else: ?>
                    <span class="pc-badge-inactive"><?= tf_icon('pause-circle') ?> Tạm dừng</span>
                    <?php endif; ?>
                </td>
                <td>
                    <div class="pc-amount-cell">
                        <input type="number" min="0" step="1000" class="pc-amount-input"
                               value="<?= (int)$s['amount_per_late_task'] ?>"
                               data-uid="<?= $uid ?>"
                               onchange="updateAmount(<?= $uid ?>, this.value)">
                        <span style="font-size:11px;color:var(--text-muted)">đ</span>
                    </div>
                </td>
                <td>
                    <button onclick="showDetail(<?= $uid ?>, <?= e(json_encode($s['user_name'])) ?>)"
                            style="background:none;border:none;cursor:pointer;color:#3B82F6;font-weight:700;font-size:13px;padding:0">
                        <?= $s['late_count'] ?> task
                    </button>
                </td>
                <td>
                    <span class="pc-total-chip <?= $s['total_amount'] > 0 ? 'has-penalty' : 'no-penalty' ?>">
                        <?= fmt_vnd((float)$s['total_amount']) ?>
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:6px">
                        <?php if ($isActive): ?>
                        <button class="pc-btn pc-btn-ghost pc-btn-sm"
                                onclick="togglePenalty(<?= $uid ?>, 0, this)">Tạm dừng</button>
                        <?php else: ?>
                        <button class="pc-btn pc-btn-primary pc-btn-sm"
                                onclick="togglePenalty(<?= $uid ?>, 1, this)">Kích hoạt</button>
                        <?php endif; ?>
                        <button class="pc-btn pc-btn-danger pc-btn-sm"
                                onclick="removeMember(<?= $uid ?>, <?= e(json_encode($s['user_name'])) ?>)">Xoá</button>
                    </div>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Add member form -->
    <div class="pc-add-card">
        <h2><?= tf_icon('user-plus') ?> Thêm thành viên mới</h2>
        <div class="pc-form-row">
            <div class="pc-form-group">
                <label>Thành viên</label>
                <select id="add-user-select" class="pc-form-select">
                    <option value="">— Chọn thành viên —</option>
                    <?php
                    $penalizedIds = array_column($summaries, 'user_id');
                    foreach ($allMembers as $m):
                        if ((int)$m['id'] === (int)$_SESSION['user_id']) continue;
                    ?>
                    <option value="<?= (int)$m['id'] ?>"
                        <?= in_array($m['id'], $penalizedIds) ? 'data-existing="1"' : '' ?>>
                        <?= e($m['name']) ?> (<?= e($m['email']) ?>)
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="pc-form-group" style="max-width:180px">
                <label>Mức phạt (đ/task trễ)</label>
                <input type="number" id="add-amount-input" class="pc-form-input"
                       min="0" step="10000" placeholder="50000">
            </div>
            <div class="pc-form-group" style="max-width:240px">
                <label>Ghi chú (tuỳ chọn)</label>
                <input type="text" id="add-note-input" class="pc-form-input"
                       placeholder="VD: Theo quyết định tháng 4">
            </div>
            <div style="padding-bottom:1px">
                <button class="pc-btn pc-btn-primary" onclick="addMember()">
                    <?= tf_icon('plus') ?> Thêm
                </button>
            </div>
        </div>
        <p style="margin:10px 0 0;font-size:11px;color:var(--text-muted)">
            Nếu thành viên đã có trong danh sách (đang tạm dừng), thao tác này sẽ kích hoạt lại và cập nhật mức phạt.
        </p>
    </div>

</div><!-- /.pc-wrap -->

<!-- Detail Drawer -->
<div class="pc-detail-overlay" id="detail-overlay" onclick="closeDetail()"></div>
<div class="pc-detail-drawer" id="detail-drawer">
    <button class="pc-drawer-close" onclick="closeDetail()">✕</button>
    <div id="drawer-content">
        <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <?= tf_icon('loader', 24) ?> Đang tải…
        </div>
    </div>
</div>

<!-- Toast -->
<div class="pc-toast" id="toast"></div>

<script>
var CSRF = '<?= csrf_token() ?>';
var BASE = '<?= APP_URL ?>';

function toast(msg, isError) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    t.style.borderColor = isError ? 'rgba(239,68,68,.4)' : 'rgba(34,197,94,.4)';
    t.style.color = isError ? '#EF4444' : '#22C55E';
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.style.display='none'; }, 3000);
}

function addMember() {
    var uid    = document.getElementById('add-user-select').value;
    var amount = document.getElementById('add-amount-input').value;
    var note   = document.getElementById('add-note-input').value;
    if (!uid)    { toast('Vui lòng chọn thành viên.', true); return; }
    if (amount === '' || isNaN(+amount) || +amount < 0) { toast('Vui lòng nhập mức phạt hợp lệ.', true); return; }

    fetch(BASE + '/admin/penalty/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf_token: CSRF, user_id: uid, amount: amount, note: note })
    })
    .then(r => r.json())
    .then(d => { if (d.ok) { toast(d.message || 'Đã lưu.'); setTimeout(()=>location.reload(), 900); } else { toast(d.error || 'Lỗi.', true); } })
    .catch(() => toast('Lỗi kết nối.', true));
}

function updateAmount(uid, amount) {
    fetch(BASE + '/admin/penalty/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf_token: CSRF, user_id: uid, amount: amount })
    })
    .then(r => r.json())
    .then(d => { if (d.ok) toast('Đã cập nhật mức phạt.'); else toast(d.error || 'Lỗi.', true); })
    .catch(() => toast('Lỗi kết nối.', true));
}

function togglePenalty(uid, active, btn) {
    fetch(BASE + '/admin/penalty/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf_token: CSRF, user_id: uid, active: active })
    })
    .then(r => r.json())
    .then(d => { if (d.ok) { toast(active ? 'Đã kích hoạt.' : 'Đã tạm dừng.'); setTimeout(()=>location.reload(), 800); } else { toast('Lỗi.', true); } })
    .catch(() => toast('Lỗi kết nối.', true));
}

function removeMember(uid, name) {
    if (!confirm('Tắt phạt cho ' + name + '? Lịch sử sẽ được giữ lại.')) return;
    fetch(BASE + '/admin/penalty/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf_token: CSRF, user_id: uid })
    })
    .then(r => r.json())
    .then(d => { if (d.ok) { toast(d.message || 'Đã xoá.'); setTimeout(()=>location.reload(), 900); } else { toast('Lỗi.', true); } })
    .catch(() => toast('Lỗi kết nối.', true));
}

function showDetail(uid, name) {
    document.getElementById('detail-overlay').style.display = 'block';
    document.getElementById('detail-drawer').classList.add('open');
    document.getElementById('drawer-content').innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-muted)">Đang tải…</div>';

    fetch(BASE + '/api/admin/penalty/detail/' + uid)
    .then(r => r.json())
    .then(function(d) {
        if (!d.ok || !d.data) { document.getElementById('drawer-content').innerHTML = '<p style="color:#EF4444">Không tải được dữ liệu.</p>'; return; }
        var data = d.data;
        var cfg  = data.config;
        var tasks = data.late_tasks || [];
        var html  = '<div class="pc-drawer-title">' + escHtml(name) + '</div>';
        html += '<div class="pc-drawer-sub">Mức phạt: <strong>' + fmtVnd(cfg.amount_per_late_task) + '</strong>/task trễ · ' + tasks.length + ' task trễ · Tổng: <strong style="color:#EF4444">' + fmtVnd(data.total_amount) + '</strong></div>';

        if (tasks.length === 0) {
            html += '<div style="text-align:center;padding:32px 0;color:var(--text-muted)">Không có task nào trễ.</div>';
        } else {
            tasks.forEach(function(t) {
                var late = t.late_days > 0 ? (t.late_days + ' ngày') : 'trễ';
                var completed = t.is_completed == 1 ? ' ✅' : '';
                html += '<div class="pc-late-task-row">';
                html += '<div><div class="pc-late-task-title">' + escHtml(t.title) + completed + '</div>';
                html += '<div class="pc-late-task-meta">';
                if (t.project_name) html += '📁 ' + escHtml(t.project_name);
                if (t.store_name)   html += ' · 🏢 ' + escHtml(t.store_name);
                html += ' · Hạn: ' + (t.due_date || '?') + ' · Trễ: ' + late;
                html += '</div></div>';
                html += '<div class="pc-late-amount">-' + fmtVnd(t.penalty_amount) + '</div>';
                html += '</div>';
            });
        }

        html += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;font-size:13px">';
        html += '<span style="font-weight:700">Tổng cộng</span>';
        html += '<span style="font-weight:800;color:#EF4444;font-size:16px">-' + fmtVnd(data.total_amount) + '</span>';
        html += '</div>';

        document.getElementById('drawer-content').innerHTML = html;
    })
    .catch(function() {
        document.getElementById('drawer-content').innerHTML = '<p style="color:#EF4444">Lỗi kết nối.</p>';
    });
}

function closeDetail() {
    document.getElementById('detail-overlay').style.display = 'none';
    document.getElementById('detail-drawer').classList.remove('open');
}

function fmtVnd(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
function escHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s || ''));
    return d.innerHTML;
}

document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeDetail(); });
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
