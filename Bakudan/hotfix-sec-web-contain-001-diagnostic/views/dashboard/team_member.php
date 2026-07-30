<?php
$pageTitle   = 'Member Portfolio — ' . e($member['name']);
$currentPage = 'team';
ob_start();

$riskIp = IconPresenter::forUserRisk($risk);
$stateM  = StatePresenter::forMember(['risk' => $risk, 'overdue' => $stats['overdue'] ?? 0]);
$avatarColors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2'];
$avatarBg = $avatarColors[($member['id'] ?? 0) % count($avatarColors)];
?>
<style>
.mp-wrap { max-width: 1000px; margin: 0 auto; padding: 0 0 48px; }
.mp-header {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 24px 0 22px; border-bottom: 1px solid rgba(255,255,255,.08); margin-bottom: 24px;
    flex-wrap: wrap;
}
.mp-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 800; color: #fff; flex-shrink: 0;
}
.mp-name  { font-size: 22px; font-weight: 800; margin: 0; }
.mp-role  { font-size: 13px; color: #94A3B8; margin-top: 3px; }
.mp-kpi   { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
@media(max-width:640px) { .mp-kpi { grid-template-columns: repeat(2,1fr); } }
.mp-kpi-card {
    background: #1E293B; border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px; padding: 16px; text-align: center;
}
.mp-kpi-num { font-size: 28px; font-weight: 800; }
.mp-kpi-lbl { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin-top: 4px; }
.mp-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media(max-width:700px) { .mp-grid { grid-template-columns: 1fr; } }
.mp-card    { background: #1E293B; border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 20px; }
.mp-card-title { font-size: 13px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin: 0 0 14px; }
.mp-task-row {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 13px;
}
.mp-task-row:last-child { border-bottom: none; }
.mp-task-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mp-priority {
    font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 5px; white-space: nowrap;
}
.prio-urgent { background: rgba(239,68,68,.2);  color: #FCA5A5; }
.prio-high   { background: rgba(245,158,11,.2); color: #FCD34D; }
.prio-medium { background: rgba(59,130,246,.15);color: #93C5FD; }
.prio-low    { background: rgba(148,163,184,.1);color: #94A3B8; }
.mp-due      { font-size: 11px; color: #94A3B8; white-space: nowrap; }
.mp-biz-row  { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 13px; }
.mp-biz-row:last-child { border-bottom: none; }
.mp-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 9px; font-size: 13px; font-weight: 600;
    text-decoration: none; border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.06); color: #F1F5F9; transition: .15s; cursor: pointer;
}
.mp-btn:hover { background: rgba(255,255,255,.12); }
.mp-btn-primary { background: #7C3AED; border-color: #7C3AED; color: #fff; }
.mp-btn-primary:hover { background: #6D28D9; }
</style>

<div class="mp-wrap">
    <div class="mp-header">
        <div class="mp-avatar" style="background:<?= $avatarBg ?>">
            <?= strtoupper(mb_substr($member['name'], 0, 1)) ?>
        </div>
        <div style="flex:1">
            <h1 class="mp-name"><?= e($member['name']) ?></h1>
            <div class="mp-role"><?= ucfirst($member['role'] ?? 'member') ?></div>
            <div style="margin-top:8px">
                <?= IconPresenter::chip($riskIp) ?>
            </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <?php if (isAdmin() || isManager()): ?>
            <button onclick="location.href='<?= APP_URL ?>/team?reassign=<?= (int)$member['id'] ?>'" class="mp-btn mp-btn-primary">⇄ Reassign Tasks</button>
            <?php endif; ?>
            <a href="<?= APP_URL ?>/team" class="mp-btn">← Team</a>
        </div>
    </div>

    <!-- KPI strip -->
    <div class="mp-kpi">
        <div class="mp-kpi-card" style="<?= StatePresenter::cardStyle($stateM) ?>">
            <div class="mp-kpi-num" style="color:#F59E0B"><?= (int)($stats['open'] ?? 0) ?></div>
            <div class="mp-kpi-lbl">Open Tasks</div>
        </div>
        <div class="mp-kpi-card" style="border-left:3px solid #EF4444">
            <div class="mp-kpi-num" style="color:#EF4444"><?= (int)($stats['overdue'] ?? 0) ?></div>
            <div class="mp-kpi-lbl">Overdue</div>
        </div>
        <div class="mp-kpi-card">
            <div class="mp-kpi-num" style="color:#F59E0B"><?= (int)($stats['due_week'] ?? 0) ?></div>
            <div class="mp-kpi-lbl">Due This Week</div>
        </div>
        <div class="mp-kpi-card">
            <div class="mp-kpi-num" style="color:<?= $onTimePct >= 70 ? '#22C55E' : ($onTimePct >= 40 ? '#F59E0B' : '#EF4444') ?>"><?= $onTimePct ?>%</div>
            <div class="mp-kpi-lbl">On-time Rate</div>
        </div>
    </div>

    <?php
    $penCount  = (int)($penaltySummary['count']        ?? 0);
    $penAmount = (float)($penaltySummary['total_amount'] ?? 0);
    if ($penCount > 0 || $penAmount > 0):
    ?>
    <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
        <span style="font-size:20px">⚠️</span>
        <div>
            <span style="font-size:13px;font-weight:700;color:#FCA5A5">This month penalty: <?= number_format($penAmount, 0, '.', ',') ?> VND</span>
            <span style="font-size:12px;color:#94A3B8;margin-left:10px">Penalty count: <?= $penCount ?> late task<?= $penCount > 1 ? 's' : '' ?></span>
        </div>
    </div>
    <?php endif; ?>

    <div class="mp-grid">
        <!-- Urgent tasks -->
        <div class="mp-card">
            <div class="mp-card-title">⚠ Urgent / Overdue Tasks</div>
            <?php if (empty($urgentTasks)): ?>
            <div style="color:#94A3B8;font-size:13px;text-align:center;padding:20px 0">✅ No urgent tasks</div>
            <?php else: ?>
            <?php foreach ($urgentTasks as $t):
                $tip = IconPresenter::forTask($t);
                $months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                $dueTxt = '';
                if ($t['due_date']) { $d = new DateTime($t['due_date']); $dueTxt = $months[(int)$d->format('n')-1].' '.$d->format('j'); }
            ?>
            <div class="mp-task-row">
                <span style="font-size:16px"><?= $tip['icon'] ?></span>
                <a href="<?= APP_URL ?>/tasks/<?= (int)$t['id'] ?>" class="mp-task-name" style="color:<?= $tip['color'] ?>;text-decoration:none" title="<?= e($t['title']) ?>"><?= e(mb_strimwidth($t['title'], 0, 40, '…')) ?></a>
                <span class="mp-priority prio-<?= e($t['priority']) ?>"><?= e($t['priority']) ?></span>
                <?php if ($dueTxt): ?><span class="mp-due"><?= $dueTxt ?></span><?php endif; ?>
            </div>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Businesses impacted -->
        <div class="mp-card">
            <div class="mp-card-title">🏪 Businesses Impacted</div>
            <?php if (empty($businesses)): ?>
            <div style="color:#94A3B8;font-size:13px;text-align:center;padding:20px 0">No active assignments</div>
            <?php else: ?>
            <?php foreach ($businesses as $biz):
                $bhIp = IconPresenter::forBusinessHealth((int)($biz['overdue_count'] ?? 0));
            ?>
            <div class="mp-biz-row">
                <span style="font-size:15px"><?= $bhIp['icon'] ?></span>
                <span style="flex:1;font-size:13px;font-weight:600"><?= e($biz['name'] ?? 'Unknown') ?></span>
                <?php if ((int)($biz['overdue_count'] ?? 0) > 0): ?>
                <span style="font-size:11px;font-weight:700;color:#FCA5A5;background:rgba(239,68,68,.12);padding:2px 7px;border-radius:5px"><?= (int)$biz['overdue_count'] ?> OD</span>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Recent completions -->
        <div class="mp-card">
            <div class="mp-card-title">✅ Completed This Week</div>
            <?php if (empty($recentDone)): ?>
            <div style="color:#94A3B8;font-size:13px;text-align:center;padding:20px 0">No completions in last 7 days</div>
            <?php else: ?>
            <?php foreach ($recentDone as $t): ?>
            <div class="mp-task-row">
                <span style="font-size:16px">✅</span>
                <a href="<?= APP_URL ?>/tasks/<?= (int)$t['id'] ?>" class="mp-task-name" style="color:#86EFAC;text-decoration:none"><?= e(mb_strimwidth($t['title'], 0, 40, '…')) ?></a>
                <span class="mp-due"><?= date('M j', strtotime($t['updated_at'])) ?></span>
            </div>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Quick actions -->
        <div class="mp-card">
            <div class="mp-card-title">⚡ Quick Actions</div>
            <div style="display:flex;flex-direction:column;gap:8px">
                <a href="<?= APP_URL ?>/my-tasks?user=<?= (int)$member['id'] ?>" class="mp-btn">📋 View All Tasks</a>
                <?php if ((int)($stats['overdue'] ?? 0) > 0): ?>
                <a href="<?= APP_URL ?>/my-tasks?user=<?= (int)$member['id'] ?>&filter=overdue" class="mp-btn" style="border-color:rgba(239,68,68,.3);color:#FCA5A5">⚠ View Overdue Only</a>
                <?php endif; ?>
                <?php if (isAdmin() || isManager()): ?>
                <a href="<?= APP_URL ?>/team?reassign=<?= (int)$member['id'] ?>" class="mp-btn mp-btn-primary">⇄ Reassign Tasks</a>
                <?php endif; ?>
                <a href="<?= APP_URL ?>/overview/member/<?= (int)$member['id'] ?>" class="mp-btn">🏢 Full Portfolio</a>
                <a href="<?= APP_URL ?>/team" class="mp-btn" style="color:#94A3B8">← Back to Team</a>
            </div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
