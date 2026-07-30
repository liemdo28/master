<?php
$pageTitle = t('project.settings_title') . ': ' . e($project['name']);
$currentPage = 'projects';
ob_start();
?>
<div class="grid grid-2">
    <div class="card">
        <div class="card-header"><h3><?= e(t('project.info')) ?></h3></div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/projects/<?= $project['id'] ?>/edit">
                <div class="form-group"><label><?= e(t('common.name')) ?></label><input type="text" name="name" class="form-control" value="<?= e($project['name']) ?>" required></div>
                <div class="form-group"><label><?= e(t('common.description')) ?></label><textarea name="description" class="form-control"><?= e($project['description']) ?></textarea></div>
                <div class="form-group"><label><?= e(t('common.color')) ?></label>
                    <div class="color-options">
                        <?php foreach (['#DC2626','#EA580C','#D97706','#16A34A','#2563EB','#7C3AED','#DB2777','#475569'] as $c): ?>
                        <label class="color-option <?= $c === $project['color'] ? 'selected' : '' ?>" style="background:<?= $c ?>" onclick="this.querySelector('input').checked=true;document.querySelectorAll('.color-option').forEach(e=>e.classList.remove('selected'));this.classList.add('selected')">
                            <input type="radio" name="color" value="<?= $c ?>" <?= $c === $project['color'] ? 'checked' : '' ?> style="display:none">
                        </label>
                        <?php endforeach; ?>
                    </div>
                </div>
                <div class="form-group"><label><?= e(t('common.status')) ?></label>
                    <select name="status" class="form-control">
                        <option value="active" <?= $project['status']==='active'?'selected':'' ?>><?= e(t('project.status_active')) ?></option>
                        <option value="completed" <?= $project['status']==='completed'?'selected':'' ?>><?= e(t('project.status_completed')) ?></option>
                        <option value="archived" <?= $project['status']==='archived'?'selected':'' ?>><?= e(t('project.status_archived')) ?></option>
                    </select>
                </div>
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <div class="flex gap-2"><button type="submit" class="btn btn-primary"><?= e(t('common.save')) ?></button><a href="<?= APP_URL ?>/projects/<?= $project['id'] ?>" class="btn btn-secondary"><?= e(t('common.back')) ?></a></div>
            </form>
        </div>
    </div>
    <div>
        <div class="card mb-4">
            <div class="card-header"><h3><?= e(t('project.members')) ?></h3></div>
            <div class="card-body">
                <?php foreach ($members as $m): ?>
                <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
                    <div class="flex-center gap-2">
                        <div class="user-avatar" style="width:30px;height:30px;font-size:11px"><?= strtoupper(substr($m['name'],0,1)) ?></div>
                        <div><div style="font-size:13px;font-weight:600"><?= e($m['name']) ?></div><div class="text-sm text-muted"><?= e($m['email']) ?></div></div>
                    </div>
                    <div class="flex-center gap-2">
                        <span class="badge badge-<?= $m['role']==='owner'?'admin':'member' ?>"><?php $rMap=['member'=>t('admin.role_member'),'admin'=>t('admin.role_admin'),'owner'=>t('admin.role_owner')]; echo e($rMap[$m['role']] ?? ucfirst($m['role'])); ?></span>
                        <?php if ($m['role'] !== 'owner'): ?>
                        <a href="<?= APP_URL ?>/projects/<?= $project['id'] ?>/members/<?= $m['id'] ?>/remove" class="btn-ghost" onclick="return confirm('<?= e(t('common.confirm_delete')) ?>')">✕</a>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
                <form method="POST" action="<?= APP_URL ?>/projects/<?= $project['id'] ?>/members" class="mt-3 flex gap-2">
                    <select name="user_id" class="form-control" style="flex:1">
                        <option value=""><?= e(t('project.add_member')) ?></option>
                        <?php foreach ($users as $u):
                            if (in_array($u['id'], array_column($members, 'id'))) continue;
                        ?>
                        <option value="<?= $u['id'] ?>"><?= e($u['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                    <button type="submit" class="btn btn-primary btn-sm"><?= e(t('common.add')) ?></button>
                </form>
            </div>
        </div>
        <div class="card mb-4">
            <div class="card-header"><h3>Columns (Sections)</h3></div>
            <div class="card-body">
                <p class="text-sm text-muted mb-3">Drag to reorder, rename or delete columns. Tasks inside deleted columns will not be affected.</p>
                <div id="sectionList">
                    <?php foreach ($sections as $sec): ?>
                    <div class="section-row" data-id="<?= $sec['id'] ?>">
                        <span class="section-drag"><?= tf_icon('menu', 13) ?></span>
                        <input type="text" class="form-control form-control-sm section-name-input" value="<?= e($sec['name']) ?>" style="flex:1">
                        <button class="btn btn-outline btn-sm section-save-btn" onclick="saveSectionName(this,<?= $sec['id'] ?>)"><?= tf_icon('check-square', 13) ?> Save</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSectionEdit(<?= $sec['id'] ?>,this)" style="padding:4px 8px"><?= tf_icon('trash-2', 13) ?></button>
                    </div>
                    <?php endforeach; ?>
                </div>
                <div class="flex gap-2 mt-3">
                    <input type="text" id="newSectionName" class="form-control form-control-sm" placeholder="New column name" style="flex:1">
                    <button class="btn btn-primary btn-sm" onclick="addSectionEdit(<?= $project['id'] ?>)">+ Add Column</button>
                </div>
            </div>
        </div>
        <div class="card" style="border-color:var(--accent-border)">
            <div class="card-header" style="background:var(--accent-bg)"><h3 style="color:var(--accent)"><?= e(t('project.danger_zone')) ?></h3></div>
            <div class="card-body">
                <p class="text-sm text-muted mb-3"><?= e(t('project.delete_warning')) ?></p>
                <a href="<?= APP_URL ?>/projects/<?= $project['id'] ?>/delete" class="btn btn-danger" onclick="return confirm('<?= e(t('project.delete_confirm')) ?>')"><?= e(t('project.delete_btn')) ?></a>
            </div>
        </div>
<script>
function saveSectionName(btn, id) {
    const input = btn.closest('.section-row').querySelector('.section-name-input');
    const name = input.value.trim();
    if (!name) return;
    fetch(APP_URL + '/sections/' + id + '/rename', {
        method: 'POST',
        headers: {'X-Requested-With':'XMLHttpRequest'},
        body: new URLSearchParams({name})
    }).then(() => {
        btn.textContent = '✓ Saved';
        setTimeout(() => { btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Save'; }, 1500);
    });
}
function deleteSectionEdit(id, btn) {
    if (!confirm('Delete this column? Tasks inside will not be deleted.')) return;
    fetch(APP_URL + '/sections/' + id + '/delete', {
        method: 'POST',
        headers: {'X-Requested-With':'XMLHttpRequest'}
    }).then(() => btn.closest('.section-row').remove());
}
function addSectionEdit(pid) {
    const inp = document.getElementById('newSectionName');
    const name = inp.value.trim();
    if (!name) return;
    const f = new FormData();
    f.append('name', name);
    fetch(APP_URL + '/projects/' + pid + '/sections', {method:'POST', body:f})
        .then(() => location.reload());
}
</script>
<style>
.section-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)}
.section-drag{cursor:grab;color:var(--text-muted);flex-shrink:0}
.form-control-sm{padding:5px 8px;font-size:12px}
.section-save-btn{display:flex;align-items:center;gap:4px;white-space:nowrap}
</style>
    </div>
</div>
<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
