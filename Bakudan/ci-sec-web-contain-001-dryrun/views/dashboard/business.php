<?php
$pageTitle = e($store['name']) . ' — Business Overview';
$currentPage = 'overview';
$storeColor  = $store['color'] ?? '#3b82f6';

ob_start();
?>

<!-- Back nav -->
<div style="margin-bottom:16px">
    <a href="<?= APP_URL ?>/overview" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-muted);text-decoration:none">
        <?= tf_icon('arrow-left', 14) ?> Overview
    </a>
</div>

<!-- Business Hero -->
<div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;flex-wrap:wrap">
    <div style="width:48px;height:48px;border-radius:12px;background:<?= e($storeColor) ?>22;border:2px solid <?= e($storeColor) ?>;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px <?= e($storeColor) ?>44">
        <?= tf_icon('building-2', 24) ?>
    </div>
    <div style="flex:1;min-width:0">
        <h1 style="font-size:22px;font-weight:800;margin:0;line-height:1.2"><?= e($store['name']) ?></h1>
        <?php if (!empty($store['address'])): ?>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px"><?= e($store['address']) ?></div>
        <?php endif; ?>
    </div>
    <div style="display:flex;gap:10px;flex-shrink:0">
        <a href="<?= APP_URL ?>/bills/store/<?= $store['id'] ?>" class="btn btn-secondary btn-sm"><?= tf_icon('wallet', 14) ?> Bills</a>
        <?php if (isAdmin()): ?>
        <a href="<?= APP_URL ?>/admin/stores/<?= $store['id'] ?>" class="btn btn-secondary btn-sm"><?= tf_icon('settings', 14) ?> Settings</a>
        <?php endif; ?>
    </div>
</div>

<!-- KPI Row -->
<div class="ov-kpi-row" style="margin-bottom:28px">
    <div class="ov-kpi kpi-cyan" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-cyan"><?= tf_icon('check-square', 24) ?></div>
        <div class="ov-kpi-value"><?= $totalTasks ?></div>
        <div class="ov-kpi-label">Total Tasks</div>
    </div>
    <div class="ov-kpi kpi-lime" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-lime"><?= tf_icon('trending-up', 24) ?></div>
        <div class="ov-kpi-value"><?= $progress ?>%</div>
        <div class="ov-kpi-label">Completion</div>
    </div>
    <div class="ov-kpi kpi-pink" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-pink"><?= tf_icon('alert-triangle', 24) ?></div>
        <div class="ov-kpi-value"><?= $overdueTasks ?></div>
        <div class="ov-kpi-label">Overdue</div>
    </div>
    <div class="ov-kpi kpi-purple" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-purple"><?= tf_icon('users', 24) ?></div>
        <div class="ov-kpi-value"><?= count($teamStats) ?></div>
        <div class="ov-kpi-label">Team Members</div>
    </div>
</div>

<!-- Categories (Projects) -->
<div class="ov-section">
    <div class="ov-section-head">
        <div class="ov-section-title"><?= tf_icon('layout-grid', 20) ?> Categories</div>
        <span class="ov-section-badge"><?= count($categories) ?> categories</span>
    </div>
    <?php if (empty($categories)): ?>
    <div class="ov-card">
        <div class="ov-card-body" style="text-align:center;padding:40px;color:var(--text-muted)">
            No categories yet. <a href="<?= APP_URL ?>/projects">Create a project</a> and assign it to this store.
        </div>
    </div>
    <?php else: ?>
    <div class="ov-projects-grid">
        <?php foreach ($categories as $cat):
            $catColor  = $cat['color'] ?: '#3b82f6';
            $riskClass = $cat['risk'] === 'red' ? 'ov-status-danger' : ($cat['risk'] === 'yellow' ? 'ov-status-warn' : 'ov-status-ok');
            $riskText  = $cat['risk'] === 'red' ? 'Behind' : ($cat['risk'] === 'yellow' ? 'At risk' : 'On track');
        ?>
        <a href="<?= APP_URL ?>/projects/<?= (int)$cat['id'] ?>" class="ov-project-card" style="--proj-color:<?= e($catColor) ?>;text-decoration:none;color:inherit;display:block">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:<?= e($catColor) ?>"></div>
            <div class="ov-project-top">
                <div>
                    <span class="ov-project-name">
                        <span class="ov-project-dot" style="background:<?= e($catColor) ?>;box-shadow:0 0 8px <?= e($catColor) ?>44"></span>
                        <?= e($cat['name']) ?>
                    </span>
                    <span class="ov-status <?= $riskClass ?>" style="display:inline-block;margin-top:6px"><?= $riskText ?></span>
                </div>
                <div class="ov-donut" style="--donut-color:<?= e($catColor) ?>;--donut-pct:<?= $cat['progress'] ?>">
                    <div class="ov-donut-ring"></div>
                    <div class="ov-donut-hole"><?= $cat['progress'] ?>%</div>
                </div>
            </div>
            <div class="ov-progress">
                <div class="ov-progress-fill" style="width:<?= $cat['progress'] ?>%;background:<?= e($catColor) ?>"></div>
            </div>
            <div class="ov-project-stats">
                <div class="ov-project-stat">
                    <span class="ov-project-stat-val"><?= (int)$cat['completed_tasks'] ?>/<?= (int)$cat['total_tasks'] ?></span>
                    <span class="ov-project-stat-label">Tasks</span>
                </div>
                <?php if ((int)$cat['overdue_tasks'] > 0): ?>
                <div class="ov-project-stat">
                    <span class="ov-project-stat-val" style="color:var(--neon-pink)"><?= (int)$cat['overdue_tasks'] ?></span>
                    <span class="ov-project-stat-label">Overdue</span>
                </div>
                <?php endif; ?>
                <?php if ((int)$cat['due_soon'] > 0): ?>
                <div class="ov-project-stat">
                    <span class="ov-project-stat-val" style="color:var(--amber)"><?= (int)$cat['due_soon'] ?></span>
                    <span class="ov-project-stat-label">Due soon</span>
                </div>
                <?php endif; ?>
            </div>
        </a>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>

<div class="ov-two-col">
<!-- Outstanding Tasks -->
<div class="ov-section" style="margin:0">
    <div class="ov-section-head">
        <div class="ov-section-title"><?= tf_icon('alert-circle', 20) ?> Outstanding Tasks</div>
        <span class="ov-section-badge"><?= count($outstandingTasks) ?></span>
    </div>
    <div class="ov-card">
        <div class="ov-card-body" style="padding:0">
            <?php if (empty($outstandingTasks)): ?>
            <div style="text-align:center;padding:32px;color:var(--text-muted)"><?= tf_icon('check-circle', 32) ?><br>All clear!</div>
            <?php else: ?>
            <table class="ov-outstanding-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Task</th>
                        <th>Category</th>
                        <th>Assignee</th>
                        <th>Due</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($outstandingTasks as $t):
                        $isOv = !empty($t['due_date']) && $t['due_date'] < date('Y-m-d');
                        $priColors = ['urgent'=>'#dc2626','high'=>'#f59e0b','medium'=>'#3b82f6','low'=>'#71717a'];
                        $priColor  = $priColors[$t['priority']] ?? '#3b82f6';
                    ?>
                    <tr class="ov-outstanding-row <?= $isOv ? 'row-overdue' : '' ?>">
                        <td style="width:4px;padding:0"><div style="width:4px;height:100%;min-height:40px;background:<?= e($priColor) ?>"></div></td>
                        <td>
                            <?php if ($isOv): ?><span class="urgency-dot urgency-dot-overdue" style="margin-right:6px"></span><?php endif; ?>
                            <?php if (!empty($t['repeat_type']) && $t['repeat_type'] !== 'none'): ?>
                            <span style="font-size:11px;color:var(--neon-cyan);margin-right:4px"><?= tf_icon('refresh-cw', 11) ?></span>
                            <?php endif; ?>
                            <a href="<?= APP_URL ?>/tasks/<?= $t['id'] ?>" class="ov-task-link"><?= e($t['title']) ?></a>
                        </td>
                        <td class="text-sm text-muted">
                            <a href="<?= APP_URL ?>/projects/<?= (int)$t['project_id'] ?>" style="color:inherit;text-decoration:none">
                                <span style="width:8px;height:8px;background:<?= e($t['project_color'] ?? '#3b82f6') ?>;border-radius:50%;display:inline-block;margin-right:4px"></span>
                                <?= e($t['project_name']) ?>
                            </a>
                        </td>
                        <td class="text-sm text-muted"><?= e($t['assignee_name'] ?? 'Unassigned') ?></td>
                        <td class="text-sm <?= $isOv ? 'due-overdue' : '' ?>"><?= $t['due_date'] ? date('d/m', strtotime($t['due_date'])) : '—' ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Right column: Recurring + Team + Bills -->
<div style="display:flex;flex-direction:column;gap:20px">

<!-- Recurring Tasks -->
<?php if (!empty($recurringTasks)): ?>
<div class="ov-card">
    <div class="ov-card-head">
        <h3><?= tf_icon('refresh-cw', 18) ?> Recurring Tasks</h3>
        <span class="ov-section-badge"><?= count($recurringTasks) ?></span>
    </div>
    <div class="ov-card-body">
        <div class="ov-alert-list">
            <?php foreach ($recurringTasks as $rt):
                $isOv = !empty($rt['due_date']) && $rt['due_date'] < date('Y-m-d');
                $daysLeft = $rt['due_date'] ? (int)((strtotime($rt['due_date']) - time()) / 86400) : null;
            ?>
            <div class="ov-alert-item">
                <div style="min-width:0">
                    <a href="<?= APP_URL ?>/tasks/<?= $rt['id'] ?>" class="ov-alert-title"><?= e($rt['title']) ?></a>
                    <div class="ov-alert-sub"><?= e($rt['project_name']) ?> · <?= e($rt['assignee_name'] ?? 'Unassigned') ?></div>
                </div>
                <?php if ($isOv): ?>
                    <span class="ov-alert-chip ov-alert-chip-danger">Overdue</span>
                <?php elseif ($daysLeft !== null && $daysLeft <= 3): ?>
                    <span class="ov-alert-chip ov-alert-chip-warn"><?= $daysLeft === 0 ? 'Today' : "In {$daysLeft}d" ?></span>
                <?php elseif ($rt['due_date']): ?>
                    <span class="ov-alert-chip ov-alert-chip-info"><?= date('d/m', strtotime($rt['due_date'])) ?></span>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
</div>
<?php endif; ?>

<!-- Team -->
<?php if (!empty($teamStats)): ?>
<div class="ov-card">
    <div class="ov-card-head">
        <h3><?= tf_icon('users', 18) ?> Team</h3>
    </div>
    <div class="ov-card-body">
        <div class="ov-team-grid">
            <?php foreach ($teamStats as $m):
                $statusColor = (int)$m['overdue'] > 0 ? 'var(--neon-pink)' : 'var(--green)';
            ?>
            <?php if (isManager()): ?>
            <a href="<?= APP_URL ?>/my-tasks?user=<?= (int)$m['id'] ?>" class="ov-team-row" style="text-decoration:none;color:inherit">
            <?php else: ?>
            <div class="ov-team-row">
            <?php endif; ?>
                <div class="ov-team-avatar"><?= strtoupper(mb_substr($m['name'], 0, 1)) ?></div>
                <div class="ov-team-info">
                    <div class="ov-team-name"><?= e($m['name']) ?></div>
                    <div class="ov-team-meta">
                        <span><?= (int)$m['total'] ?> tasks</span>
                        <?php if ((int)$m['overdue'] > 0): ?>
                        <span style="color:var(--neon-pink)"><?= tf_icon('alert-triangle', 11) ?> <?= (int)$m['overdue'] ?> overdue</span>
                        <?php else: ?>
                        <span style="color:var(--green)"><?= tf_icon('check', 11) ?> On track</span>
                        <?php endif; ?>
                    </div>
                </div>
            <?php if (isManager()): ?>
            </a>
            <?php else: ?>
            </div>
            <?php endif; ?>
            <?php endforeach; ?>
        </div>
    </div>
</div>
<?php endif; ?>

<!-- Bills this month -->
<?php if (!empty($bills)): ?>
<div class="ov-card">
    <div class="ov-card-head">
        <h3><a href="<?= APP_URL ?>/bills/store/<?= $store['id'] ?>" style="text-decoration:none;color:inherit"><?= tf_icon('wallet', 18) ?> Bills — <?= date('M Y') ?></a></h3>
    </div>
    <div class="ov-card-body">
        <div class="ov-alert-list">
            <?php foreach (array_slice($bills, 0, 8) as $bill):
                $isPaid = $bill['status'] === 'paid';
                $isOv   = !$isPaid && $bill['due_date'] < date('Y-m-d');
            ?>
            <div class="ov-alert-item">
                <div style="min-width:0">
                    <div class="ov-alert-title" style="<?= $isPaid ? 'opacity:.5;text-decoration:line-through' : '' ?>"><?= e($bill['title']) ?></div>
                    <?php if (!empty($bill['vendor'])): ?>
                    <div class="ov-alert-sub"><?= e($bill['vendor']) ?></div>
                    <?php endif; ?>
                </div>
                <?php if ($isPaid): ?>
                    <span class="ov-alert-chip" style="background:rgba(22,163,74,.12);color:var(--green)"><?= tf_icon('check', 12) ?> Paid</span>
                <?php elseif ($isOv): ?>
                    <span class="ov-alert-chip ov-alert-chip-danger">Overdue</span>
                <?php else: ?>
                    <span class="ov-alert-chip ov-alert-chip-warn"><?= date('d/m', strtotime($bill['due_date'])) ?></span>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
</div>
<?php endif; ?>

</div><!-- end right col -->
</div><!-- end ov-two-col -->

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
