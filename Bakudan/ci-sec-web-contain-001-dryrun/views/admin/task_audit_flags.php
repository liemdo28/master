<?php
$pageTitle   = 'Task Audit';
$currentPage = 'task-audit-review';
ob_start();

function ta_fmt_date($d) { return $d ? date('d/m/Y', strtotime($d)) : '—'; }
?>
<style>
.ta-wrap { max-width: 1200px; margin: 0 auto; padding: 0 0 60px; }
.ta-header { display:flex;align-items:center;justify-content:space-between;padding:20px 0 24px;border-bottom:1px solid var(--border,rgba(255,255,255,.08));margin-bottom:28px;flex-wrap:wrap;gap:12px; }
.ta-header-left h1 { font-size:22px;font-weight:800;margin:0 0 4px; }
.ta-header-left p  { font-size:13px;color:var(--text-muted,#94A3B8);margin:0; }
.ta-btn { display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:.15s;text-decoration:none; }
.ta-btn-ghost { background:rgba(255,255,255,.06);color:var(--text,#F1F5F9);border:1px solid var(--border,rgba(255,255,255,.1)); }
.ta-btn-ghost:hover { background:rgba(255,255,255,.1); }
.ta-btn-primary { background:#2563EB;color:#fff; }
.ta-btn-primary:hover { background:#1D4ED8; }
.ta-btn-sm { padding:5px 10px;font-size:12px; }
.ta-kpi-row { display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px; }
@media(max-width:640px){ .ta-kpi-row{ grid-template-columns:1fr; } }
.ta-kpi { background:var(--surface,#1E293B);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:14px;padding:18px;border-left:3px solid transparent; }
.ta-kpi-amber { border-left-color:#F59E0B; }
.ta-kpi-red   { border-left-color:#EF4444; }
.ta-kpi-blue  { border-left-color:#3B82F6; }
.ta-kpi-label { font-size:11px;font-weight:700;color:var(--text-muted,#94A3B8);text-transform:uppercase;letter-spacing:.07em; }
.ta-kpi-value { font-size:28px;font-weight:800;line-height:1.1;margin:6px 0 2px; }
.ta-kpi-amber .ta-kpi-value { color:#F59E0B; }
.ta-kpi-red   .ta-kpi-value { color:#EF4444; }
.ta-kpi-blue  .ta-kpi-value { color:#3B82F6; }
.ta-section { background:var(--surface,#1E293B);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:16px;overflow:hidden;margin-bottom:24px; }
.ta-section-head { padding:16px 20px;border-bottom:1px solid var(--border,rgba(255,255,255,.08)); }
.ta-section-head h2 { font-size:14px;font-weight:700;margin:0; }
.ta-section-head p  { font-size:12px;color:var(--text-muted,#94A3B8);margin:4px 0 0; }
table.ta-table { width:100%;border-collapse:collapse; }
table.ta-table th { text-align:left;font-size:11px;font-weight:700;color:var(--text-muted,#94A3B8);text-transform:uppercase;letter-spacing:.06em;padding:10px 16px;background:rgba(255,255,255,.03);border-bottom:1px solid var(--border,rgba(255,255,255,.06)); }
table.ta-table td { padding:12px 16px;font-size:13px;border-bottom:1px solid var(--border,rgba(255,255,255,.04));vertical-align:middle; }
table.ta-table tr:last-child td { border-bottom:none; }
.ta-empty { padding:32px;text-align:center;color:var(--text-muted,#94A3B8);font-size:13px; }
.ta-badge { display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700; }
.ta-badge-open     { background:rgba(239,68,68,.12);color:#EF4444; }
.ta-badge-resolved { background:rgba(34,197,94,.15);color:#22C55E; }
.ta-modal-overlay { display:none;position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.65);backdrop-filter:blur(4px); }
.ta-modal { display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:480px;max-width:92vw;background:var(--bg,#0F172A);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:14px;z-index:901;padding:22px; }
.ta-modal h3 { margin:0 0 14px;font-size:15px;font-weight:800; }
.ta-modal label { display:block;font-size:11px;font-weight:700;color:var(--text-muted,#94A3B8);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px; }
.ta-modal textarea, .ta-modal input[type=file] { width:100%;background:rgba(255,255,255,.06);border:1px solid var(--border,rgba(255,255,255,.12));color:var(--text,#F1F5F9);border-radius:8px;padding:9px 12px;font-size:13px;margin-bottom:14px;box-sizing:border-box; }
.ta-modal textarea { min-height:80px;resize:vertical; }
.ta-modal-actions { display:flex;justify-content:flex-end;gap:8px; }
.ta-toast { position:fixed;bottom:24px;right:24px;z-index:1000;background:#1E293B;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:10px;padding:12px 18px;font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.4);display:none; }
</style>

<div class="ta-wrap">
    <div class="ta-header">
        <div class="ta-header-left">
            <h1><?= tf_icon('shield-alert') ?> Task Audit</h1>
            <p>Rà soát task hoàn thành không có bằng chứng, và task lặp lại bị đứt chuỗi follow-up.</p>
        </div>
        <a href="<?= APP_URL ?>/overview" class="ta-btn ta-btn-ghost"><?= tf_icon('arrow-left') ?> Overview</a>
    </div>

    <?php
    $openFlags = count(array_filter($flags, fn($f) => $f['status'] === 'open'));
    ?>
    <div class="ta-kpi-row">
        <div class="ta-kpi ta-kpi-amber">
            <div class="ta-kpi-label"><?= tf_icon('alert-triangle') ?> Hoàn thành không bằng chứng</div>
            <div class="ta-kpi-value"><?= count($suspicious) ?></div>
        </div>
        <div class="ta-kpi ta-kpi-red">
            <div class="ta-kpi-label"><?= tf_icon('shield-alert') ?> Đứt chuỗi follow-up</div>
            <div class="ta-kpi-value"><?= count($brokenChains) ?></div>
        </div>
        <div class="ta-kpi ta-kpi-blue">
            <div class="ta-kpi-label"><?= tf_icon('clipboard-list') ?> Flag đang mở</div>
            <div class="ta-kpi-value"><?= $openFlags ?></div>
        </div>
    </div>

    <!-- Suspicious completions -->
    <div class="ta-section">
        <div class="ta-section-head">
            <h2>Hoàn thành không có bằng chứng</h2>
            <p>Task đã mark complete nhưng không có file/ảnh đính kèm nào — cần xác minh có thật sự hoàn thành không.</p>
        </div>
        <?php if (empty($suspicious)): ?>
        <div class="ta-empty">Không có task nào cần rà soát.</div>
        <?php else: ?>
        <table class="ta-table">
            <thead><tr><th>Task</th><th>Người nhận</th><th>Hạn</th><th>Hoàn thành</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($suspicious as $t): ?>
                <tr>
                    <td><strong><?= e($t['title']) ?></strong><?php if ($t['project_name']): ?><div style="font-size:11px;color:var(--text-muted)">📁 <?= e($t['project_name']) ?><?php if ($t['store_name']): ?> · 🏢 <?= e($t['store_name']) ?><?php endif; ?></div><?php endif; ?></td>
                    <td><?= e($t['assignee_name'] ?? '—') ?></td>
                    <td><?= ta_fmt_date($t['due_date']) ?></td>
                    <td><?= ta_fmt_date($t['completed_at']) ?></td>
                    <td><button class="ta-btn ta-btn-primary ta-btn-sm" onclick="openFlagModal(<?= (int)$t['id'] ?>, 'no_evidence', <?= e(json_encode($t['title'])) ?>)">Flag</button></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Broken follow-up chains -->
    <div class="ta-section">
        <div class="ta-section-head">
            <h2>Task lặp lại bị đứt chuỗi</h2>
            <p>Task định kỳ đã hoàn thành nhưng không có task kế tiếp được tạo ra để follow công việc.</p>
        </div>
        <?php if (empty($brokenChains)): ?>
        <div class="ta-empty">Không có chuỗi nào bị đứt.</div>
        <?php else: ?>
        <table class="ta-table">
            <thead><tr><th>Task</th><th>Người nhận</th><th>Hạn</th><th>Hoàn thành</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($brokenChains as $t): ?>
                <tr>
                    <td><strong><?= e($t['title']) ?></strong><?php if ($t['project_name']): ?><div style="font-size:11px;color:var(--text-muted)">📁 <?= e($t['project_name']) ?><?php if ($t['store_name']): ?> · 🏢 <?= e($t['store_name']) ?><?php endif; ?></div><?php endif; ?></td>
                    <td><?= e($t['assignee_name'] ?? '—') ?></td>
                    <td><?= ta_fmt_date($t['due_date']) ?></td>
                    <td><?= ta_fmt_date($t['completed_at']) ?></td>
                    <td><button class="ta-btn ta-btn-primary ta-btn-sm" onclick="openFlagModal(<?= (int)$t['id'] ?>, 'broken_followup', <?= e(json_encode($t['title'])) ?>)">Flag</button></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Flags -->
    <div class="ta-section">
        <div class="ta-section-head">
            <h2>Flag đã tạo</h2>
        </div>
        <?php if (empty($flags)): ?>
        <div class="ta-empty">Chưa có flag nào.</div>
        <?php else: ?>
        <table class="ta-table">
            <thead><tr><th>Task</th><th>Loại</th><th>Ghi chú</th><th>Trạng thái</th><th>Bằng chứng</th><th>Người tạo</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($flags as $f): ?>
                <tr>
                    <td><strong><?= e($f['task_title']) ?></strong></td>
                    <td><?= e($f['flag_type'] === 'no_evidence' ? 'Không bằng chứng' : ($f['flag_type'] === 'broken_followup' ? 'Đứt chuỗi' : 'Khác')) ?></td>
                    <td style="max-width:220px"><?= e($f['note'] ?: '—') ?></td>
                    <td>
                        <?php if ($f['status'] === 'open'): ?>
                        <span class="ta-badge ta-badge-open"><?= tf_icon('alert-triangle', 12) ?> Đang mở</span>
                        <?php else: ?>
                        <span class="ta-badge ta-badge-resolved"><?= tf_icon('check-circle', 12) ?> Đã xử lý</span>
                        <?php endif; ?>
                    </td>
                    <td><?= (int)$f['evidence_count'] ?> file</td>
                    <td><?= e($f['flagged_by_name']) ?></td>
                    <td>
                        <div style="display:flex;gap:6px">
                            <button class="ta-btn ta-btn-ghost ta-btn-sm" onclick="openEvidenceModal(<?= (int)$f['id'] ?>)">Upload evidence</button>
                            <?php if ($f['status'] === 'open'): ?>
                            <button class="ta-btn ta-btn-ghost ta-btn-sm" onclick="resolveFlag(<?= (int)$f['id'] ?>)">Resolve</button>
                            <?php endif; ?>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>
</div>

<!-- Flag modal -->
<div class="ta-modal-overlay" id="flagOverlay" onclick="closeModals()"></div>
<div class="ta-modal" id="flagModal">
    <h3 id="flagModalTitle">Flag task</h3>
    <input type="hidden" id="flagTaskId">
    <input type="hidden" id="flagType">
    <label>Ghi chú</label>
    <textarea id="flagNote" placeholder="Mô tả vấn đề phát hiện được..."></textarea>
    <div class="ta-modal-actions">
        <button class="ta-btn ta-btn-ghost" onclick="closeModals()">Huỷ</button>
        <button class="ta-btn ta-btn-primary" onclick="submitFlag()">Tạo flag</button>
    </div>
</div>

<!-- Evidence upload modal -->
<div class="ta-modal" id="evidenceModal">
    <h3>Upload bằng chứng</h3>
    <input type="hidden" id="evidenceFlagId">
    <label>File (ảnh, PDF, doc, xls...)</label>
    <input type="file" id="evidenceFile">
    <div class="ta-modal-actions">
        <button class="ta-btn ta-btn-ghost" onclick="closeModals()">Huỷ</button>
        <button class="ta-btn ta-btn-primary" onclick="submitEvidence()">Upload</button>
    </div>
</div>

<div class="ta-toast" id="taToast"></div>

<script>
var TA_CSRF = '<?= csrf_token() ?>';
var TA_BASE = '<?= APP_URL ?>';

function taToast(msg, isError) {
    var t = document.getElementById('taToast');
    t.textContent = msg;
    t.style.display = 'block';
    t.style.borderColor = isError ? 'rgba(239,68,68,.4)' : 'rgba(34,197,94,.4)';
    t.style.color = isError ? '#EF4444' : '#22C55E';
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.style.display='none'; }, 3000);
}

function openFlagModal(taskId, type, title) {
    document.getElementById('flagTaskId').value = taskId;
    document.getElementById('flagType').value = type;
    document.getElementById('flagModalTitle').textContent = 'Flag: ' + title;
    document.getElementById('flagNote').value = '';
    document.getElementById('flagOverlay').style.display = 'block';
    document.getElementById('flagModal').style.display = 'block';
}

function openEvidenceModal(flagId) {
    document.getElementById('evidenceFlagId').value = flagId;
    document.getElementById('evidenceFile').value = '';
    document.getElementById('flagOverlay').style.display = 'block';
    document.getElementById('evidenceModal').style.display = 'block';
}

function closeModals() {
    document.getElementById('flagOverlay').style.display = 'none';
    document.getElementById('flagModal').style.display = 'none';
    document.getElementById('evidenceModal').style.display = 'none';
}

function submitFlag() {
    var taskId = document.getElementById('flagTaskId').value;
    var type   = document.getElementById('flagType').value;
    var note   = document.getElementById('flagNote').value;

    fetch(TA_BASE + '/admin/task-audit/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf_token: TA_CSRF, task_id: taskId, flag_type: type, note: note })
    })
    .then(r => r.json())
    .then(d => { if (d.ok) { taToast('Đã tạo flag.'); setTimeout(()=>location.reload(), 800); } else { taToast(d.error || 'Lỗi.', true); } })
    .catch(() => taToast('Lỗi kết nối.', true));
}

function submitEvidence() {
    var flagId = document.getElementById('evidenceFlagId').value;
    var fileEl = document.getElementById('evidenceFile');
    if (!fileEl.files.length) { taToast('Chọn file trước.', true); return; }

    var fd = new FormData();
    fd.append('csrf_token', TA_CSRF);
    fd.append('flag_id', flagId);
    fd.append('file', fileEl.files[0]);

    fetch(TA_BASE + '/admin/task-audit/evidence', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => { if (d.ok) { taToast('Đã upload.'); setTimeout(()=>location.reload(), 800); } else { taToast(d.error || 'Lỗi.', true); } })
    .catch(() => taToast('Lỗi kết nối.', true));
}

function resolveFlag(flagId) {
    var note = prompt('Ghi chú xử lý (tuỳ chọn):', '') || '';
    fetch(TA_BASE + '/admin/task-audit/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrf_token: TA_CSRF, flag_id: flagId, note: note })
    })
    .then(r => r.json())
    .then(d => { if (d.ok) { taToast('Đã xử lý.'); setTimeout(()=>location.reload(), 800); } else { taToast('Lỗi.', true); } })
    .catch(() => taToast('Lỗi kết nối.', true));
}

document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeModals(); });
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
