<?php
$pageTitle = 'Goals & OKRs';
$currentPage = 'admin-goals';
ob_start();
?>
<style>
.gl-toolbar{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.gl-toolbar select,.gl-toolbar input{background:#18181b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:8px;font-size:14px}
.gl-btn{padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;border:none;cursor:pointer;text-decoration:none;color:#fff;background:#3b82f6}
.gl-btn:hover{background:#2563eb}
.gl-list{display:flex;flex-direction:column;gap:12px}
.gl-item{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:18px}
.gl-item__header{display:flex;justify-content:space-between;align-items:start;margin-bottom:10px}
.gl-item__title{font-size:15px;color:#f4f4f5;font-weight:500}
.gl-item__meta{font-size:12px;color:#71717a}
.gl-item__bar{height:8px;background:#27272a;border-radius:4px;overflow:hidden;margin-bottom:6px}
.gl-item__fill{height:100%;border-radius:4px;transition:width .3s}
.gl-item__fill--active{background:#3b82f6}
.gl-item__fill--done{background:#10b981}
.gl-item__footer{display:flex;justify-content:space-between;font-size:12px;color:#71717a}
.gl-badge{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.gl-badge--active{background:#1e3a5f;color:#60a5fa}
.gl-badge--completed{background:#052e16;color:#4ade80}
.gl-badge--paused{background:#27272a;color:#71717a}
.gl-empty{text-align:center;padding:40px;color:#71717a}
.gl-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;align-items:center;justify-content:center}
.gl-modal.open{display:flex}
.gl-modal__box{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;width:100%;max-width:500px}
.gl-modal__box h3{color:#f4f4f5;margin:0 0 16px}
.gl-form-row{margin-bottom:12px}
.gl-form-row label{display:block;font-size:12px;color:#71717a;margin-bottom:4px}
.gl-form-row input,.gl-form-row select,.gl-form-row textarea{width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px;font-size:14px}
</style>

<div class="gl-toolbar">
    <form method="GET" action="<?= APP_URL ?>/admin/goals" style="display:flex;gap:8px;flex:1;flex-wrap:wrap">
        <select name="status"><option value="">All Status</option><option value="active" <?= ($_GET['status']??'')==='active'?'selected':'' ?>>Active</option><option value="completed" <?= ($_GET['status']??'')==='completed'?'selected':'' ?>>Completed</option><option value="paused" <?= ($_GET['status']??'')==='paused'?'selected':'' ?>>Paused</option></select>
        <select name="type"><option value="">All Types</option><option value="company" <?= ($_GET['type']??'')==='company'?'selected':'' ?>>Company</option><option value="region" <?= ($_GET['type']??'')==='region'?'selected':'' ?>>Region</option><option value="store" <?= ($_GET['type']??'')==='store'?'selected':'' ?>>Store</option></select>
        <button type="submit" class="gl-btn" style="background:#27272a">Filter</button>
    </form>
    <?php if (canAdmin()): ?>
    <button class="gl-btn" onclick="document.getElementById('goalModal').classList.add('open')">+ New Goal</button>
    <?php endif; ?>
</div>

<?php if (empty($goals)): ?>
<div class="gl-empty"><h3 style="color:#a1a1aa">No goals found</h3><p>Create your first goal to start tracking OKRs.</p></div>
<?php else: ?>
<div class="gl-list">
<?php foreach ($goals as $g): ?>
<div class="gl-item">
    <div class="gl-item__header">
        <div>
            <div class="gl-item__title"><?= e($g['title']) ?></div>
            <div class="gl-item__meta"><?= ucfirst($g['type']) ?> · <?= e($g['owner_name'] ?? '') ?> · <?= $g['quarter'] ?? '' ?></div>
        </div>
        <span class="gl-badge gl-badge--<?= $g['status'] ?>"><?= ucfirst($g['status']) ?></span>
    </div>
    <div class="gl-item__bar"><div class="gl-item__fill gl-item__fill--<?= $g['status'] ?>" style="width:<?= min(100,(float)$g['progress_pct']) ?>%"></div></div>
    <div class="gl-item__footer">
        <span><?= number_format((float)$g['progress_pct'],0) ?>% complete</span>
        <span><?= $g['current_value'] !== null ? number_format((float)$g['current_value'],1) : '—' ?> / <?= $g['target_value'] !== null ? number_format((float)$g['target_value'],1) : '—' ?></span>
    </div>
</div>
<?php endforeach; ?>
</div>
<?php endif; ?>

<!-- Create Goal Modal -->
<div class="gl-modal" id="goalModal">
<div class="gl-modal__box">
    <h3>Create Goal</h3>
    <form method="POST" action="<?= APP_URL ?>/admin/goals/create">
        <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
        <div class="gl-form-row"><label>Title</label><input type="text" name="title" required placeholder="e.g. Reduce overdue tasks by 50%"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="gl-form-row"><label>Type</label><select name="type"><option value="company">Company</option><option value="region">Region</option><option value="store">Store</option></select></div>
            <div class="gl-form-row"><label>Quarter</label><input type="text" name="quarter" placeholder="2026-Q2"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="gl-form-row"><label>Metric</label><select name="metric_key"><option value="">Manual</option><option value="task_completion_pct">Task Completion %</option><option value="overdue_pct">Overdue %</option><option value="store_health_score">Store Health</option><option value="audit_score">Audit Score</option></select></div>
            <div class="gl-form-row"><label>Target Value</label><input type="number" name="target_value" step="0.1" placeholder="e.g. 90"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="gl-form-row"><label>Start</label><input type="date" name="starts_at"></div>
            <div class="gl-form-row"><label>End</label><input type="date" name="ends_at"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button type="submit" class="gl-btn">Create</button>
            <button type="button" class="gl-btn" style="background:#27272a" onclick="document.getElementById('goalModal').classList.remove('open')">Cancel</button>
        </div>
    </form>
</div>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
