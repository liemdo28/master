<?php
$pageTitle   = $pageTitle   ?? 'Password Rotation Dashboard';
$currentPage = $currentPage ?? 'credentials-rotation';

ob_start();
?>
<style>
.rot-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.rot-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}
@media(max-width:800px){.rot-stats{grid-template-columns:repeat(2,1fr)}}
.stat-card{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;text-align:center}
.stat-card__val{font-size:32px;font-weight:700;margin-bottom:2px}
.stat-card__lbl{font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.05em}
.s-overdue .stat-card__val{color:#f87171}
.s-warning .stat-card__val{color:#fbbf24}
.s-info .stat-card__val{color:#fb923c}
.s-healthy .stat-card__val{color:#4ade80}
.s-neutral .stat-card__val{color:#a1a1aa}

.rot-section{margin-bottom:24px}
.rot-section-header{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #27272a}
.rot-section-title{font-size:15px;font-weight:700;color:#f4f4f5}
.rot-section-count{background:#27272a;color:#a1a1aa;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}

.cred-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.cred-card{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:14px 16px;transition:border-color .15s}
.cred-card:hover{border-color:#3f3f46}
.cred-card-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px}
.cred-card-name{font-size:14px;font-weight:600;color:#f4f4f5}
.cred-card-name a{color:#f4f4f5;text-decoration:none}
.cred-card-name a:hover{color:#60a5fa}
.cred-card-badge{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;white-space:nowrap}
.badge-overdue{background:rgba(248,113,113,.2);color:#f87171;border:1px solid rgba(248,113,113,.4)}
.badge-due7{background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.35)}
.badge-due30{background:rgba(251,146,60,.15);color:#fb923c;border:1px solid rgba(251,146,60,.35)}
.badge-healthy{background:rgba(74,222,128,.12);color:#4ade80;border:1px solid rgba(74,222,128,.3)}
.cred-card-meta{font-size:12px;color:#71717a;margin-bottom:10px;display:flex;flex-direction:column;gap:3px}
.cred-card-actions{display:flex;gap:8px}
.btn-xs{padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.btn-xs-primary{background:#1d4ed8;border-color:#2563eb;color:#fff}
.btn-xs-primary:hover{background:#2563eb}
.btn-xs-ghost{background:transparent;border-color:#27272a;color:#a1a1aa}
.btn-xs-ghost:hover{background:#27272a;color:#f4f4f5}

.empty-section{padding:30px;text-align:center;background:#18181b;border:1px solid #27272a;border-radius:10px;color:#52525b;font-size:13px}
</style>

<div class="rot-header">
    <div>
        <h2 style="font-size:20px;font-weight:700;color:#f4f4f5;margin-bottom:4px">🔄 Password Rotation Dashboard</h2>
        <div style="font-size:13px;color:#71717a">Track upcoming and overdue password changes</div>
    </div>
    <a href="<?= APP_URL ?>/security/credentials" style="font-size:13px;color:#60a5fa;text-decoration:none">← Back to Vault</a>
</div>

<!-- Stats -->
<div class="rot-stats">
    <div class="stat-card s-overdue">
        <div class="stat-card__val"><?= $stats['overdue'] ?></div>
        <div class="stat-card__lbl">Overdue</div>
    </div>
    <div class="stat-card s-warning">
        <div class="stat-card__val"><?= $stats['due_7_days'] ?></div>
        <div class="stat-card__lbl">Due ≤ 7d</div>
    </div>
    <div class="stat-card s-info">
        <div class="stat-card__val"><?= $stats['due_30_days'] ?></div>
        <div class="stat-card__lbl">Due ≤ 30d</div>
    </div>
    <div class="stat-card s-healthy">
        <div class="stat-card__val"><?= $stats['healthy'] ?></div>
        <div class="stat-card__lbl">Healthy</div>
    </div>
    <div class="stat-card s-neutral">
        <div class="stat-card__val"><?= $stats['no_policy'] ?></div>
        <div class="stat-card__lbl">No Policy</div>
    </div>
</div>

<?php
function rotCardForm($cred, $badgeClass, $badgeLabel) {
    $nextDue = $cred['next_rotation_due_at'];
    $daysNum = $nextDue ? (int)floor((strtotime($nextDue) - time()) / 86400) : null;
    $dueStr  = $nextDue ? date('M j, Y', strtotime($nextDue)) : 'Unknown';
    ?>
    <div class="cred-card">
        <div class="cred-card-header">
            <div class="cred-card-name"><a href="<?= APP_URL ?>/security/credentials/<?= $cred['id'] ?>"><?= e($cred['service_name']) ?></a></div>
            <span class="cred-card-badge <?= $badgeClass ?>"><?= $badgeLabel ?></span>
        </div>
        <div class="cred-card-meta">
            <?php if ($cred['username']): ?><span>👤 <?= e($cred['username']) ?></span><?php endif; ?>
            <?php if ($cred['owner_name']): ?><span>🏷 <?= e($cred['owner_name']) ?></span><?php endif; ?>
            <?php if ($cred['store_name']): ?><span>🏪 <?= e($cred['store_name']) ?></span><?php endif; ?>
            <span>🗓 Due: <strong style="color:<?= ($daysNum !== null && $daysNum < 0) ? '#f87171' : '#e4e4e7' ?>"><?= $dueStr ?></strong></span>
            <?php if ($cred['rotation_frequency_days']): ?><span>🔁 Every <?= $cred['rotation_frequency_days'] ?> days</span><?php endif; ?>
        </div>
        <div class="cred-card-actions">
            <form method="POST" action="<?= APP_URL ?>/security/credentials/<?= $cred['id'] ?>/create-rotation-task" style="display:inline">
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <button type="submit" class="btn-xs btn-xs-primary" onclick="return confirm('Create rotation task for <?= e($cred['service_name']) ?>?')">🔄 Create Task</button>
            </form>
            <a href="<?= APP_URL ?>/security/credentials/<?= $cred['id'] ?>" class="btn-xs btn-xs-ghost">View →</a>
        </div>
    </div>
    <?php
}
?>

<!-- OVERDUE -->
<div class="rot-section">
    <div class="rot-section-header">
        <div class="rot-section-title" style="color:#f87171">🔴 Overdue</div>
        <span class="rot-section-count"><?= count($overdue) ?></span>
    </div>
    <?php if (empty($overdue)): ?>
    <div class="empty-section">✅ No overdue credentials — great job!</div>
    <?php else: ?>
    <div class="cred-cards">
        <?php foreach ($overdue as $c) rotCardForm($c, 'badge-overdue', abs((int)$c['days_overdue']).'d overdue'); ?>
    </div>
    <?php endif; ?>
</div>

<!-- DUE IN 7 DAYS -->
<div class="rot-section">
    <div class="rot-section-header">
        <div class="rot-section-title" style="color:#fbbf24">⚠️ Due Within 7 Days</div>
        <span class="rot-section-count"><?= count($due7) ?></span>
    </div>
    <?php if (empty($due7)): ?>
    <div class="empty-section">No credentials due in the next 7 days</div>
    <?php else: ?>
    <div class="cred-cards">
        <?php foreach ($due7 as $c) rotCardForm($c, 'badge-due7', 'Due in '.(int)$c['days_until_due'].'d'); ?>
    </div>
    <?php endif; ?>
</div>

<!-- DUE IN 30 DAYS -->
<div class="rot-section">
    <div class="rot-section-header">
        <div class="rot-section-title" style="color:#fb923c">🟠 Due Within 30 Days</div>
        <span class="rot-section-count"><?= count($due30) ?></span>
    </div>
    <?php if (empty($due30)): ?>
    <div class="empty-section">No credentials due in the next 30 days</div>
    <?php else: ?>
    <div class="cred-cards">
        <?php foreach ($due30 as $c) rotCardForm($c, 'badge-due30', 'Due in '.(int)$c['days_until_due'].'d'); ?>
    </div>
    <?php endif; ?>
</div>

<!-- HEALTHY -->
<?php if (!empty($healthy)): ?>
<div class="rot-section">
    <div class="rot-section-header">
        <div class="rot-section-title" style="color:#4ade80">🟢 Healthy</div>
        <span class="rot-section-count"><?= count($healthy) ?></span>
    </div>
    <div class="cred-cards">
        <?php foreach ($healthy as $c) rotCardForm($c, 'badge-healthy', 'Healthy'); ?>
    </div>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
