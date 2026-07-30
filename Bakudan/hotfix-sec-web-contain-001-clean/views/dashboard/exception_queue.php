<?php /* Exception Queue view — uses app CSS tokens, no Tailwind */ ?>
<style>
.eq-page { max-width: 1300px; margin: 0 auto; padding: 24px 20px; }
.eq-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; }
.eq-title { font-size: 22px; font-weight: 800; color: var(--text-primary, #f1f5f9); }
.eq-subtitle { font-size: 13px; color: var(--text-muted, #64748b); margin-top: 4px; }
.eq-back { font-size: 13px; color: var(--text-muted, #64748b); text-decoration: none; }
.eq-back:hover { color: var(--text-primary, #f1f5f9); }
.eq-empty { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.2); border-radius: 12px; padding: 40px; text-align: center; color: #4ade80; }
.eq-empty-icon { font-size: 36px; margin-bottom: 8px; }
.eq-empty-title { font-size: 16px; font-weight: 700; }
.eq-empty-body { font-size: 13px; color: var(--text-muted, #64748b); margin-top: 4px; }
.eq-section { margin-bottom: 28px; }
.eq-section-title { font-size: 13px; font-weight: 700; color: var(--text-secondary, #94a3b8); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.eq-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.eq-dot-red { background: #dc2626; }
.eq-dot-orange { background: #f59e0b; }
.eq-dot-yellow { background: #eab308; }
.eq-dot-blue { background: #3b82f6; }
.eq-dot-purple { background: #a855f7; }
.eq-table-wrap { background: var(--bg-card, #1a1a24); border: 1px solid var(--border-card, #2d2d3d); border-radius: 10px; overflow: auto; }
.eq-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.eq-table th { padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--border-card, #2d2d3d); white-space: nowrap; }
.eq-table td { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.04); color: var(--text-primary, #e2e8f0); vertical-align: middle; }
.eq-table tr:last-child td { border-bottom: none; }
.eq-table tr:hover td { background: rgba(255,255,255,.02); }
.eq-badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; letter-spacing: .05em; display: inline-block; }
.eq-badge-red { background: rgba(220,38,38,.15); color: #f87171; }
.eq-badge-orange { background: rgba(245,158,11,.15); color: #fbbf24; }
.eq-badge-yellow { background: rgba(234,179,8,.15); color: #fde047; }
.eq-badge-blue { background: rgba(59,130,246,.15); color: #60a5fa; }
.eq-badge-purple { background: rgba(168,85,247,.15); color: #c084fc; }
.eq-link { color: #60a5fa; text-decoration: none; font-size: 12px; font-weight: 600; }
.eq-link:hover { color: #93c5fd; }
.eq-status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
</style>

<div class="eq-page">
    <div class="eq-header">
        <div>
            <div class="eq-title">Exception Queue</div>
            <div class="eq-subtitle">Items requiring human attention — <?= (int)$totalExceptions ?> total</div>
        </div>
        <a href="<?= APP_URL ?>/overview" class="eq-back">← Overview</a>
    </div>

    <?php if ($totalExceptions === 0): ?>
    <div class="eq-empty">
        <div class="eq-empty-icon">✅</div>
        <div class="eq-empty-title">No exceptions — all clear</div>
        <div class="eq-empty-body">No overdue items, failed verifications, or pending reviews.</div>
    </div>
    <?php endif; ?>

    <?php if (!empty($overdueBills)): ?>
    <div class="eq-section">
        <div class="eq-section-title"><span class="eq-dot eq-dot-red"></span> Overdue Bills (<?= count($overdueBills) ?>)</div>
        <div class="eq-table-wrap">
            <table class="eq-table">
                <thead><tr>
                    <th>Bill</th><th>Store</th><th style="text-align:right">Amount</th><th>Due Date</th><th style="text-align:center">Days</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                <?php foreach ($overdueBills as $bill): ?>
                <tr>
                    <td style="font-weight:600"><?= e($bill['title']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($bill['store_name']) ?></td>
                    <td style="text-align:right">$<?= number_format((float)$bill['amount'], 2) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($bill['due_date']) ?></td>
                    <td style="text-align:center"><span class="eq-badge eq-badge-red"><?= (int)$bill['days_overdue'] ?>d</span></td>
                    <td><span class="eq-status" style="color:<?= $bill['status']==='overdue' ? '#f87171' : '#fbbf24' ?>"><?= e($bill['status']) ?></span></td>
                    <td><a href="<?= APP_URL ?>/bills/<?= (int)$bill['id'] ?>" class="eq-link">View</a></td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>

    <?php if (!empty($failedVerification)): ?>
    <div class="eq-section">
        <div class="eq-section-title"><span class="eq-dot eq-dot-orange"></span> Verification Failed / Exception (<?= count($failedVerification) ?>)</div>
        <div class="eq-table-wrap">
            <table class="eq-table">
                <thead><tr>
                    <th>Task</th><th>Store</th><th>Assignee</th><th>Due Date</th><th>Verification</th><th></th>
                </tr></thead>
                <tbody>
                <?php foreach ($failedVerification as $task): ?>
                <tr>
                    <td style="font-weight:600"><?= e($task['title']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($task['store_name']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($task['assignee_name']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($task['due_date']) ?></td>
                    <td><span class="eq-status" style="color:<?= $task['verification_status']==='failed' ? '#f87171' : '#fbbf24' ?>"><?= e($task['verification_status']) ?></span></td>
                    <td><a href="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>" class="eq-link">View</a></td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>

    <?php if (!empty($overdueTasks)): ?>
    <div class="eq-section">
        <div class="eq-section-title"><span class="eq-dot eq-dot-yellow"></span> Overdue Tasks (<?= count($overdueTasks) ?>)</div>
        <div class="eq-table-wrap">
            <table class="eq-table">
                <thead><tr>
                    <th>Task</th><th>Assignee</th><th>Due Date</th><th style="text-align:center">Days</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                <?php foreach ($overdueTasks as $task): ?>
                <tr>
                    <td style="font-weight:600"><?= e($task['title']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($task['assignee_name']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($task['due_date']) ?></td>
                    <td style="text-align:center"><span class="eq-badge eq-badge-yellow"><?= (int)$task['days_overdue'] ?>d</span></td>
                    <td><span class="eq-status" style="color:var(--text-muted,#64748b)"><?= e($task['status']) ?></span></td>
                    <td><a href="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>" class="eq-link">View</a></td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>

    <?php if (!empty($pendingVerification)): ?>
    <div class="eq-section">
        <div class="eq-section-title"><span class="eq-dot eq-dot-blue"></span> Submitted — Awaiting Verification (<?= count($pendingVerification) ?>)</div>
        <div class="eq-table-wrap">
            <table class="eq-table">
                <thead><tr>
                    <th>Task</th><th>Assignee</th><th>Due Date</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                <?php foreach ($pendingVerification as $task): ?>
                <tr>
                    <td style="font-weight:600"><?= e($task['title']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($task['assignee_name']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($task['due_date']) ?></td>
                    <td><span class="eq-badge eq-badge-blue">PENDING VERIFY</span></td>
                    <td><a href="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>" class="eq-link">Review</a></td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>

    <?php if (!empty($lowConfidence)): ?>
    <div class="eq-section">
        <div class="eq-section-title"><span class="eq-dot eq-dot-purple"></span> Low-Confidence Agent Results (<?= count($lowConfidence) ?>)</div>
        <div class="eq-table-wrap">
            <table class="eq-table">
                <thead><tr>
                    <th>Task</th><th>Assignee</th><th style="text-align:center">Confidence</th><th>Notes</th><th></th>
                </tr></thead>
                <tbody>
                <?php foreach ($lowConfidence as $vr): ?>
                <tr>
                    <td style="font-weight:600"><?= e($vr['title']) ?></td>
                    <td style="color:var(--text-secondary,#94a3b8)"><?= e($vr['assignee_name']) ?></td>
                    <td style="text-align:center"><span class="eq-badge eq-badge-purple"><?= round((float)$vr['confidence_score'] * 100) ?>%</span></td>
                    <td style="color:var(--text-muted,#64748b);font-size:12px"><?= e((string)($vr['notes'] ?? '')) ?></td>
                    <td><a href="<?= APP_URL ?>/tasks/<?= (int)$vr['task_id'] ?>" class="eq-link">Review</a></td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>
</div>
