<?php
$pageTitle = 'Duplicate Task Audit';
$currentPage = 'admin';
ob_start();
?>
<style>
.dup-summary{display:flex;gap:16px;margin-bottom:24px}
.dup-stat{background:var(--card-bg,#1e1e2e);border:1px solid var(--border-color,rgba(255,255,255,.08));border-radius:10px;padding:16px 24px;flex:1;text-align:center}
.dup-stat .num{font-size:28px;font-weight:800;color:var(--accent,#818CF8)}
.dup-stat .label{font-size:12px;color:var(--text-muted);margin-top:4px;text-transform:uppercase;letter-spacing:.04em}
.dup-group{margin-bottom:24px}
.dup-group .group-title{font-size:15px;font-weight:700;margin:0 0 2px}
.dup-group .group-meta{font-size:12px;color:var(--text-muted);margin-bottom:10px}
.dup-task-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border-color,rgba(255,255,255,.06));font-size:13px}
.dup-task-row:last-child{border-bottom:none}
.dup-task-row .task-id{color:var(--text-muted);min-width:50px}
.dup-task-row .task-assignee{min-width:100px;font-weight:600}
.dup-task-row .task-due{min-width:90px}
.dup-task-row .task-project{min-width:120px;color:var(--text-muted)}
.dup-task-row .task-status{min-width:80px}
.dup-task-row .task-created{min-width:100px;color:var(--text-muted);font-size:11px}
.dup-task-row .task-actions{margin-left:auto;display:flex;gap:6px}
.status-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.status-badge.open{background:rgba(59,130,246,.15);color:#3B82F6}
.status-badge.in_progress{background:rgba(251,191,36,.15);color:#FBB724}
.status-badge.completed{background:rgba(34,197,94,.15);color:#22C55E}
.status-badge.archived{background:rgba(107,114,128,.15);color:#6B7280}
.merge-bar{display:flex;align-items:center;justify-content:flex-end;padding:10px 16px;border-top:1px solid var(--border-color,rgba(255,255,255,.08));gap:10px}
</style>

<div style="max-width:960px;margin:0 auto">
<h1 style="font-size:22px;font-weight:800;margin-bottom:6px">Duplicate Task Audit</h1>
<p class="text-sm text-muted" style="margin-bottom:24px">
    Identify and resolve duplicate tasks across projects. Select a canonical task to keep and archive the rest.
</p>

<!-- Summary Stats -->
<div class="dup-summary">
    <div class="dup-stat">
        <div class="num"><?= (int)$totalDupGroups ?></div>
        <div class="label">Duplicate Groups</div>
    </div>
    <div class="dup-stat">
        <div class="num"><?= (int)$totalDupTasks ?></div>
        <div class="label">Duplicate Tasks</div>
    </div>
</div>

<!-- Duplicate Groups -->
<?php if (empty($duplicates)): ?>
<div class="card">
    <div class="card-body" style="text-align:center;padding:40px;color:var(--text-muted)">
        No duplicate tasks found. Everything looks clean!
    </div>
</div>
<?php else: ?>
<?php foreach ($duplicates as $groupIndex => $group): ?>
<div class="card dup-group">
    <div class="card-header" style="border-left:4px solid var(--accent,#818CF8)">
        <div>
            <h3 class="group-title"><?= e($group['title']) ?></h3>
            <div class="group-meta"><?= count($group['tasks']) ?> tasks with this title</div>
        </div>
    </div>
    <div class="card-body" style="padding:0">
        <form method="POST" action="<?= APP_URL ?>/admin/task-audit/duplicates/merge" class="dup-merge-form">
            <input type="hidden" name="csrf_token" value="<?= e($csrfToken ?? '') ?>">
            <input type="hidden" name="group_index" value="<?= $groupIndex ?>">

            <?php foreach ($group['tasks'] as $task): ?>
            <div class="dup-task-row">
                <span class="task-id">#<?= (int)$task['id'] ?></span>
                <span class="task-assignee"><?= e($task['assignee'] ?? 'Unassigned') ?></span>
                <span class="task-due"><?= $task['due_date'] ? date('d/m/Y', strtotime($task['due_date'])) : '&#x2014;' ?></span>
                <span class="task-project"><?= e($task['project'] ?? '') ?></span>
                <span class="task-status">
                    <span class="status-badge <?= e($task['status'] ?? 'open') ?>"><?= e(ucfirst(str_replace('_', ' ', $task['status'] ?? 'open'))) ?></span>
                </span>
                <span class="task-created"><?= $task['created_at'] ? date('d/m H:i', strtotime($task['created_at'])) : '&#x2014;' ?></span>
                <span class="task-actions">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;font-weight:600;color:var(--accent)">
                        <input type="radio" name="canonical_id" value="<?= (int)$task['id'] ?>">
                        Keep
                    </label>
                    <button type="button"
                            class="btn btn-ghost btn-sm"
                            style="color:#EF4444;border-color:rgba(239,68,68,.3);font-size:11px"
                            onclick="archiveSingle(<?= (int)$task['id'] ?>, this)">
                        Archive
                    </button>
                </span>
            </div>
            <?php endforeach; ?>

            <div class="merge-bar">
                <span class="text-sm text-muted">Keep selected, archive the rest</span>
                <button type="submit" class="btn btn-primary btn-sm">Merge</button>
            </div>
        </form>
    </div>
</div>
<?php endforeach; ?>
<?php endif; ?>

<!-- Recent Audit Log -->
<?php if (!empty($recentAudits)): ?>
<div class="card" style="margin-top:32px">
    <div class="card-header"><h3 style="margin:0">Recent Audit Actions</h3></div>
    <div class="card-body" style="padding:0">
        <table class="table" style="margin:0">
            <thead><tr>
                <th>Action</th><th>Task</th><th>By</th><th>Date</th>
            </tr></thead>
            <tbody>
            <?php foreach ($recentAudits as $audit): ?>
            <tr>
                <td><span class="status-badge <?= e($audit['action'] ?? '') ?>"><?= e(ucfirst($audit['action'] ?? '')) ?></span></td>
                <td><?= e($audit['task_title'] ?? '') ?> <span style="color:var(--text-muted);font-size:11px">#<?= (int)($audit['task_id'] ?? 0) ?></span></td>
                <td><?= e($audit['performed_by'] ?? '') ?></td>
                <td class="text-sm text-muted"><?= isset($audit['created_at']) ? date('d/m/Y H:i', strtotime($audit['created_at'])) : '' ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php endif; ?>

</div><!-- max-width wrapper -->

<script>
var APP_URL_JS = '<?= APP_URL ?>';

function archiveSingle(taskId, btn) {
    if (!confirm('Archive task #' + taskId + '?')) return;
    btn.disabled = true;
    btn.textContent = '...';
    fetch(APP_URL_JS + '/admin/task-audit/duplicates/archive', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},
        body: JSON.stringify({task_id: taskId})
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
        if (data.success) {
            var row = btn.closest('.dup-task-row');
            row.style.opacity = '0.4';
            var badge = row.querySelector('.status-badge');
            badge.className = 'status-badge archived';
            badge.textContent = 'Archived';
            btn.remove();
        } else {
            alert(data.error || 'Failed to archive');
            btn.disabled = false;
            btn.textContent = 'Archive';
        }
    })
    .catch(function(){ btn.disabled = false; btn.textContent = 'Archive'; });
}

document.querySelectorAll('.dup-merge-form').forEach(function(form){
    form.addEventListener('submit', function(e){
        var checked = form.querySelector('input[name=canonical_id]:checked');
        if (!checked) { e.preventDefault(); alert('Select a task to keep.'); return; }
        if (!confirm('Merge this group? All tasks except #' + checked.value + ' will be archived.')) {
            e.preventDefault();
        }
    });
});
</script>

<?php $content = ob_get_clean(); require __DIR__ . '/../../layouts/main.php'; ?>
