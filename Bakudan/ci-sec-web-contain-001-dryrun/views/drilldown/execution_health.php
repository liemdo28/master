<?php
// $onTrack, $atRisk, $critical passed from controller
$ddTitle     = 'Execution Health';
$ddCount     = count($onTrack) + count($atRisk) + count($critical);
$ddRiskLevel = count($critical) > 5 ? 'critical' : (count($atRisk) > 3 ? 'high' : 'low');

$pageTitle = 'Execution Health';
ob_start();
?>
<div class="dd-summary-bar">
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:#22c55e"><?= count($onTrack) ?></div>
        <div class="dd-summary-lbl">On Track</div>
    </div>
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:#f59e0b"><?= count($atRisk) ?></div>
        <div class="dd-summary-lbl">At Risk</div>
    </div>
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:#dc2626"><?= count($critical) ?></div>
        <div class="dd-summary-lbl">Critical / Overdue</div>
    </div>
</div>
<?php $ddSummaryHtml = ob_get_clean(); ?>

<?php
function renderTaskTable(array $tasks, string $color, string $emptyMsg): string {
    if (empty($tasks)) {
        return '<div class="dd-table-wrap" style="margin-bottom:16px"><div class="dd-empty" style="padding:20px">' . e($emptyMsg) . '</div></div>';
    }
    $html = '<div class="dd-table-wrap" style="margin-bottom:16px"><table class="dd-table"><thead><tr>';
    $html .= '<th>Task</th><th>Store</th><th>Assignee</th><th>Due Date</th><th>Priority</th><th>Actions</th>';
    $html .= '</tr></thead><tbody>';
    foreach ($tasks as $t) {
        $priColor = match($t['priority'] ?? '') { 'critical'=>'#dc2626','high','urgent'=>'#f59e0b', default=>'#3b82f6' };
        $html .= '<tr>';
        $html .= '<td style="font-weight:600;color:#f1f5f9;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' . e($t['title'] ?? '') . '">' . e($t['title'] ?? '—') . '</td>';
        $html .= '<td>' . e($t['store_name'] ?? '—') . '</td>';
        $html .= '<td>' . e($t['assignee_name'] ?? '—') . '</td>';
        $html .= '<td style="white-space:nowrap">' . e($t['due_date'] ? date('d M Y', strtotime($t['due_date'])) : '—') . '</td>';
        $html .= '<td><span class="dd-risk-pill" style="background:' . $priColor . '18;color:' . $priColor . '">' . strtoupper($t['priority'] ?? 'medium') . '</span></td>';
        $html .= '<td><a href="' . APP_URL . '/tasks/' . (int)($t['id'] ?? 0) . '" class="dd-action-link">View Task</a></td>';
        $html .= '</tr>';
    }
    $html .= '</tbody></table></div>';
    return $html;
}

$pageTitle = 'Execution Health';
ob_start();
?>

<div class="dd-section-title" style="color:#22c55e">On Track</div>
<?= renderTaskTable($onTrack, '#22c55e', 'No on-track tasks found.') ?>

<div class="dd-section-title" style="color:#f59e0b">At Risk (due within 3 days)</div>
<?= renderTaskTable($atRisk, '#f59e0b', 'No at-risk tasks found.') ?>

<div class="dd-section-title" style="color:#dc2626">Critical / Overdue</div>
<?= renderTaskTable($critical, '#dc2626', 'No critical or overdue tasks found.') ?>

<?php $ddContent = ob_get_clean(); ?>
<?php require __DIR__ . '/layout.php'; ?>
