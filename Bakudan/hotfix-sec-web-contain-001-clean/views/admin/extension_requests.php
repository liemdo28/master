<?php
$pageTitle  = 'Deadline Extensions';
$currentPage = 'extensions';
ob_start();
?>
<style>
.ext-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.ext-badge.pending   {background:rgba(251,191,36,.15);color:#FBB724}
.ext-badge.approved  {background:rgba(34,197,94,.15);color:#22C55E}
.ext-badge.rejected  {background:rgba(239,68,68,.15);color:#EF4444}
.ext-badge.auto_approved{background:rgba(99,102,241,.15);color:#818CF8}
.ext-diff{font-size:11px;color:var(--text-muted)}
.ext-reason{font-size:12px;color:var(--text-muted);font-style:italic;margin-top:2px}
</style>

<?php if (!empty($pending)): ?>
<div class="card" style="margin-bottom:24px;border:1px solid rgba(251,191,36,.3)">
    <div class="card-header" style="display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">⏳</span>
        <h3 style="margin:0">Pending Approval
            <span style="font-size:12px;background:rgba(251,191,36,.2);color:#FBB724;padding:2px 8px;border-radius:999px;margin-left:6px"><?= count($pending) ?></span>
        </h3>
    </div>
    <div class="card-body" style="padding:0">
        <table class="table" style="margin:0">
            <thead><tr>
                <th>User</th><th>Task</th><th>Current deadline</th>
                <th>Requested</th><th>Days+</th><th>Reason</th><th>Requested at</th><th>Actions</th>
            </tr></thead>
            <tbody>
            <?php foreach ($pending as $ext): ?>
            <tr id="ext-row-<?= $ext['id'] ?>">
                <td><strong><?= e($ext['user_name']) ?></strong></td>
                <td>
                    <a href="<?= APP_URL ?>/tasks/<?= $ext['task_id'] ?>" target="_blank" style="font-weight:600"><?= e($ext['task_title']) ?></a>
                    <?php if ($ext['project_name']): ?><div class="ext-diff"><?= e($ext['project_name']) ?></div><?php endif; ?>
                </td>
                <td><?= $ext['old_deadline'] ? date('d/m/Y', strtotime($ext['old_deadline'])) : '—' ?></td>
                <td style="font-weight:600;color:var(--accent)"><?= date('d/m/Y', strtotime($ext['new_deadline'])) ?></td>
                <td class="ext-diff">
                    <?php
                    $days = round((strtotime($ext['new_deadline']) - strtotime($ext['old_deadline'])) / 86400);
                    echo "+{$days}d";
                    ?>
                </td>
                <td><div class="ext-reason"><?= e($ext['reason'] ?? '—') ?></div></td>
                <td class="ext-diff"><?= date('d/m H:i', strtotime($ext['created_at'])) ?></td>
                <td>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-primary btn-sm"
                                onclick="handleExtension(<?= $ext['id'] ?>,'approve')">
                            ✓ Approve
                        </button>
                        <button class="btn btn-ghost btn-sm"
                                style="color:#EF4444;border-color:rgba(239,68,68,.3)"
                                onclick="promptReject(<?= $ext['id'] ?>)">
                            ✕ Reject
                        </button>
                    </div>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php else: ?>
<div class="card" style="margin-bottom:24px">
    <div class="card-body" style="text-align:center;padding:32px;color:var(--text-muted)">
        No pending extension requests.
    </div>
</div>
<?php endif; ?>

<!-- All extensions history -->
<div class="card">
    <div class="card-header"><h3>All Extensions (last 200)</h3></div>
    <div class="card-body" style="padding:0">
        <table class="table" style="margin:0">
            <thead><tr>
                <th>User</th><th>Task</th><th>Old deadline</th><th>New deadline</th>
                <th>Type</th><th>Status</th><th>Approved/Rejected by</th><th>Date</th>
            </tr></thead>
            <tbody>
            <?php foreach ($all as $ext): ?>
            <tr>
                <td><?= e($ext['user_name']) ?></td>
                <td>
                    <a href="<?= APP_URL ?>/tasks/<?= $ext['task_id'] ?>" target="_blank"><?= e($ext['task_title']) ?></a>
                    <?php if ($ext['project_name']): ?><div class="ext-diff"><?= e($ext['project_name']) ?></div><?php endif; ?>
                </td>
                <td><?= $ext['old_deadline'] ? date('d/m/Y', strtotime($ext['old_deadline'])) : '—' ?></td>
                <td style="font-weight:600"><?= date('d/m/Y', strtotime($ext['new_deadline'])) ?></td>
                <td><span class="ext-badge <?= $ext['type'] ?>"><?= $ext['type'] === 'self' ? 'Self' : 'Request' ?></span></td>
                <td><span class="ext-badge <?= $ext['status'] ?>"><?= str_replace('_', ' ', $ext['status']) ?></span></td>
                <td><?= e($ext['approver_name'] ?? '—') ?></td>
                <td class="ext-diff"><?= date('d/m/Y H:i', strtotime($ext['created_at'])) ?></td>
            </tr>
            <?php endforeach; ?>
            <?php if (empty($all)): ?>
            <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">No extensions recorded yet.</td></tr>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<!-- Reject modal -->
<div id="rejectModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center">
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:14px;padding:28px;width:420px;max-width:90vw">
        <h4 style="margin:0 0 16px">Reject extension request</h4>
        <div class="form-group">
            <label>Reason (required)</label>
            <textarea id="rejectReasonInput" class="form-control" rows="3" placeholder="Explain why this request is rejected..."></textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-ghost" onclick="closeRejectModal()">Cancel</button>
            <button class="btn btn-danger" onclick="confirmReject()">Reject</button>
        </div>
    </div>
</div>

<script>
var CSRF = '<?= csrf_token() ?>';
var BASE = '<?= APP_URL ?>';
var _rejectExtId = null;

function handleExtension(extId, action) {
    var body = new URLSearchParams({ csrf_token: CSRF });
    fetch(BASE + '/api/extensions/' + extId + '/' + action, { method: 'POST', body: body })
    .then(function(r){ return r.json(); })
    .then(function(d) {
        if (d.ok) {
            var row = document.getElementById('ext-row-' + extId);
            if (row) row.style.opacity = '0.4';
            showToast(action === 'approve' ? '✅ Approved' : '✕ Rejected');
            setTimeout(function(){ location.reload(); }, 1200);
        } else {
            showToast('Error: ' + (d.error || 'Unknown'), true);
        }
    });
}

function promptReject(extId) {
    _rejectExtId = extId;
    document.getElementById('rejectReasonInput').value = '';
    var m = document.getElementById('rejectModal');
    m.style.display = 'flex';
}

function closeRejectModal() {
    document.getElementById('rejectModal').style.display = 'none';
    _rejectExtId = null;
}

function confirmReject() {
    var reason = document.getElementById('rejectReasonInput').value.trim();
    if (!reason) { alert('Please enter a reason.'); return; }
    var body = new URLSearchParams({ csrf_token: CSRF, reason: reason });
    fetch(BASE + '/api/extensions/' + _rejectExtId + '/reject', { method: 'POST', body: body })
    .then(function(r){ return r.json(); })
    .then(function(d) {
        closeRejectModal();
        if (d.ok) {
            showToast('✕ Rejected');
            setTimeout(function(){ location.reload(); }, 1200);
        } else {
            showToast('Error: ' + (d.error || 'Unknown'), true);
        }
    });
}

function showToast(msg, isErr) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;z-index:99999;'
        + (isErr ? 'background:#EF4444;color:#fff' : 'background:#22C55E;color:#fff');
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3000);
}
</script>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
