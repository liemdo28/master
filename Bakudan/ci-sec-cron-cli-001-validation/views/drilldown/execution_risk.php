<?php
// $overloadedUsers, $stuckTasks passed from controller
$ddTitle     = 'Execution Risk';
$ddCount     = count($overloadedUsers) + count($stuckTasks);
$ddRiskLevel = count($overloadedUsers) > 3 ? 'critical' : (count($overloadedUsers) > 0 ? 'high' : 'medium');

$pageTitle = 'Execution Risk';
ob_start();
?>

<!-- Section 1: Overloaded Users -->
<div class="dd-section-title">Overloaded Team Members (>5 open tasks)</div>
<?php if (empty($overloadedUsers)): ?>
<div class="dd-table-wrap" style="margin-bottom:20px"><div class="dd-empty" style="padding:24px">No overloaded team members found.</div></div>
<?php else: ?>
<div class="dd-table-wrap" style="margin-bottom:20px">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Team Member</th>
                <th>Open Tasks</th>
                <th>Overdue Tasks</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($overloadedUsers as $member):
            $loadColor = (int)$member['open_tasks'] > 10 ? '#dc2626' : '#f59e0b';
        ?>
        <tr>
            <td style="font-weight:600;color:#f1f5f9">
                <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:28px;height:28px;background:rgba(99,102,241,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#818cf8">
                        <?= strtoupper(mb_substr($member['name'] ?? '?', 0, 1)) ?>
                    </div>
                    <?= e($member['name'] ?? '—') ?>
                </div>
            </td>
            <td>
                <span class="dd-risk-pill" style="background:<?= $loadColor ?>18;color:<?= $loadColor ?>">
                    <?= (int)$member['open_tasks'] ?>
                </span>
            </td>
            <td>
                <?php if ((int)$member['overdue_tasks'] > 0): ?>
                <span class="dd-risk-pill" style="background:rgba(220,38,38,.12);color:#f87171">
                    <?= (int)$member['overdue_tasks'] ?> overdue
                </span>
                <?php else: ?>
                <span style="color:#22c55e">0</span>
                <?php endif; ?>
            </td>
            <td>
                <a href="<?= APP_URL ?>/overview/member/<?= (int)($member['user_id'] ?? 0) ?>" class="dd-action-link">View Workload</a>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>

<!-- Section 2: Stuck Tasks in Review -->
<div class="dd-section-title">Tasks Stuck in Review (&gt;3 days)</div>
<?php if (empty($stuckTasks)): ?>
<div class="dd-table-wrap"><div class="dd-empty" style="padding:24px">No tasks stuck in review.</div></div>
<?php else: ?>
<div class="dd-table-wrap">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Task</th>
                <th>Store</th>
                <th>Stuck Since</th>
                <th>Stuck Days</th>
                <th>Assignee</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($stuckTasks as $task):
            $stuckDays = (int)($task['stuck_days'] ?? 0);
            $stuckColor = $stuckDays > 7 ? '#dc2626' : '#f59e0b';
        ?>
        <tr>
            <td style="font-weight:600;color:#f1f5f9"><?= e($task['title'] ?? '—') ?></td>
            <td><?= e($task['store_name'] ?? '—') ?></td>
            <td style="white-space:nowrap"><?= e($task['updated_at'] ? date('d M Y', strtotime($task['updated_at'])) : '—') ?></td>
            <td>
                <span class="dd-risk-pill" style="background:<?= $stuckColor ?>18;color:<?= $stuckColor ?>">
                    <?= $stuckDays ?>d
                </span>
            </td>
            <td><?= e($task['assignee_name'] ?? '—') ?></td>
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
