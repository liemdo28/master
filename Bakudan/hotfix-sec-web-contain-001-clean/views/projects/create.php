<?php
$pageTitle = t('project.create_title');
$currentPage = 'projects';
ob_start();
?>
<div class="card" style="max-width:600px">
    <div class="card-body">
        <form method="POST" action="<?= APP_URL ?>/projects">
            <div class="form-group"><label><?= e(t('project.name_label')) ?></label><input type="text" name="name" class="form-control" placeholder="<?= e(t('project.name_placeholder')) ?>" required></div>
            <div class="form-group"><label><?= e(t('project.description')) ?></label><textarea name="description" class="form-control" placeholder="<?= e(t('project.description_placeholder')) ?>"></textarea></div>
            <div class="form-group"><label><?= e(t('project.color')) ?></label>
                <div class="color-options">
                    <?php foreach (['#DC2626','#EA580C','#D97706','#16A34A','#2563EB','#7C3AED','#DB2777','#475569'] as $c): ?>
                    <label class="color-option <?= $c === '#DC2626' ? 'selected' : '' ?>" style="background:<?= $c ?>" onclick="this.querySelector('input').checked=true;document.querySelectorAll('.color-option').forEach(e=>e.classList.remove('selected'));this.classList.add('selected')">
                        <input type="radio" name="color" value="<?= $c ?>" <?= $c === '#DC2626' ? 'checked' : '' ?> style="display:none">
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php if (!empty($users) && count($users) > 1): ?>
            <div class="form-group"><label><?= e(t('project.add_members')) ?></label>
                <?php foreach ($users as $u): if ($u['id'] == $_SESSION['user_id']) continue; ?>
                <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:13px;color:var(--text-secondary)"><input type="checkbox" name="members[]" value="<?= $u['id'] ?>"><?= e($u['name']) ?> <span class="text-muted text-sm">(<?= e($u['email']) ?>)</span></label>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
            <?php if (!empty($users) && count($users) > 1): ?>
            <div class="form-group"><label><?= e(t('project.lead')) ?></label>
                <select name="lead_id" class="form-control">
                    <option value=""><?= e(t('project.select_lead')) ?></option>
                    <?php foreach ($users as $u): ?>
                    <option value="<?= $u['id'] ?>" <?= $u['id'] == $_SESSION['user_id'] ? 'selected' : '' ?>><?= e($u['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <?php endif; ?>
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div class="flex gap-2 mt-4"><button type="submit" class="btn btn-primary"><?= e(t('project.create_btn')) ?></button><a href="<?= APP_URL ?>/projects" class="btn btn-secondary"><?= e(t('common.cancel')) ?></a></div>
        </form>
    </div>
</div>
<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
