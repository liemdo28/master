<?php
// $tasks passed from controller
$ddTitle     = t('dashboard.kpi.critical_tasks');
$ddCount     = count($tasks);
$ddRiskLevel = $ddCount > 10 ? 'critical' : ($ddCount > 3 ? 'high' : 'medium');

$pageTitle = t('dashboard.kpi.critical_tasks');
ob_start();
if (empty($tasks)):
?>
<div class="dd-table-wrap"><div class="dd-empty"><?= e(t('overview.all_clear')) ?></div></div>
<?php else: ?>
<div class="dd-table-wrap">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Task</th>
                <th>Store</th>
                <th>Assignee</th>
                <th>Reviewer</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Overdue Days</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($tasks as $task):
            $days = max(0, (int)($task['overdue_days'] ?? 0));
            $priColor = match($task['priority'] ?? '') { 'critical'=>'#dc2626','high','urgent'=>'#f59e0b', default=>'#3b82f6' };
        ?>
        <tr>
            <td style="font-weight:600;color:#f1f5f9;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="<?= e($task['title'] ?? '') ?>">
                <?= e($task['title'] ?? '—') ?>
            </td>
            <td><?= e($task['store_name'] ?? '—') ?></td>
            <td><?= e($task['assignee_name'] ?? '—') ?></td>
            <td><?= e($task['reviewer_name'] ?? '—') ?></td>
            <td>
                <span class="dd-risk-pill" style="background:<?= $priColor ?>18;color:<?= $priColor ?>">
                    <?= strtoupper($task['priority'] ?? 'medium') ?>
                </span>
            </td>
            <td style="white-space:nowrap"><?= e($task['due_date'] ? date('d M Y', strtotime($task['due_date'])) : '—') ?></td>
            <td>
                <?php if ($days > 0): ?>
                <span class="dd-risk-pill" style="background:rgba(220,38,38,.12);color:#f87171"><?= $days ?>d</span>
                <?php else: ?>
                <span style="color:#64748b">—</span>
                <?php endif; ?>
            </td>
            <td>
                <span class="dd-risk-pill" style="background:rgba(100,116,139,.12);color:#94a3b8">
                    <?= strtoupper($task['status'] ?? '—') ?>
                </span>
            </td>
            <td>
                <a href="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>" class="dd-action-link">View Task</a>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>
<?php $ddContent = ob_get_clean(); ?>

<?php require __DIR__ . '/layout.php'; ?>
