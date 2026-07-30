<?php
$notifications = $notifications ?? [];
?>
<div class="page-container">
    <div class="page-content">
        <div class="flex-between mb-6">
            <div>
                <h1 class="text-2xl font-bold">Task Workflow Queue</h1>
                <p class="text-muted text-sm mt-1">Step-by-step verification for Tax, Payroll, Bill tasks</p>
            </div>
            <a href="<?= APP_URL ?>/admin/tasks" class="btn btn-outline btn-sm">
                ← Back to Admin
            </a>
        </div>

        <?php if (isset($_SESSION['flash'])): ?>
            <?php $flash = $_SESSION['flash']; unset($_SESSION['flash']); ?>
            <div class="alert alert-<?= $flash['type'] === 'error' ? 'danger' : 'success' ?> mb-4">
                <?= e($flash['message']) ?>
            </div>
        <?php endif; ?>

        <!-- Stage Tabs -->
        <div class="tabs mb-6">
            <?php
            $stages = ['submitted' => 'Submitted', 'checking' => 'Checking', 'accepted' => 'Accepted', 'rejected' => 'Rejected'];
            foreach ($stages as $s => $label):
                $count = 0;
                foreach ($tasks as $t) $count++;
                $isActive = ($stage ?? 'submitted') === $s;
            ?>
                <a href="<?= APP_URL ?>/admin/tasks/workflow?stage=<?= $s ?><?= $storeId ? '&store=' . $storeId : '' ?>"
                   class="tab <?= $isActive ? 'active' : '' ?>">
                    <?= e($label) ?>
                    <?php if ($count > 0): ?>
                        <span class="badge badge-sm ml-1"><?= $count ?></span>
                    <?php endif; ?>
                </a>
            <?php endforeach; ?>
        </div>

        <!-- Store Filter -->
        <div class="flex gap-2 mb-4" style="align-items:center">
            <span class="text-sm text-muted">Filter by store:</span>
            <a href="<?= APP_URL ?>/admin/tasks/workflow?stage=<?= urlencode($stage ?? 'submitted') ?>"
               class="btn btn-sm <?= !$storeId ? 'btn-primary' : 'btn-outline' ?>">All</a>
            <?php foreach ($stores as $st): ?>
                <a href="<?= APP_URL ?>/admin/tasks/workflow?stage=<?= urlencode($stage ?? 'submitted') ?>&store=<?= $st['id'] ?>"
                   class="btn btn-sm <?= $storeId == $st['id'] ? 'btn-primary' : 'btn-outline' ?>"
                   style="<?= $storeId == $st['id'] ? '' : "border-color:{$st['color']};color:{$st['color']}" ?>">
                    <?= e($st['name']) ?>
                </a>
            <?php endforeach; ?>
        </div>

        <?php if (empty($tasks)): ?>
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>No tasks in "<?= ucfirst($stage ?? 'submitted') ?>" stage</h3>
                <p class="text-muted text-sm mt-2">
                    <?php if ($stage === 'submitted'): ?>
                        No tasks have been submitted for verification yet.
                    <?php elseif ($stage === 'checking'): ?>
                        No tasks are currently being checked.
                    <?php elseif ($stage === 'accepted'): ?>
                        No tasks have been accepted yet.
                    <?php else: ?>
                        No rejected tasks.
                    <?php endif; ?>
                </p>
            </div>
        <?php else: ?>
            <div class="task-list">
                <?php foreach ($tasks as $task): ?>
                    <div class="task-card" style="margin-bottom:12px">
                        <div class="flex-between">
                            <div style="flex:1">
                                <div class="flex gap-2" style="align-items:center;margin-bottom:6px">
                                    <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>" class="font-bold text-sm" style="color:var(--primary)">
                                        <?= e($task['title']) ?>
                                    </a>
                                    <span class="badge badge-sm badge-<?= $task['task_category'] ?? 'store_operation' ?>">
                                        <?= e($task['task_category'] ?? 'store_operation') ?>
                                    </span>
                                    <?php if (!empty($task['priority']) && $task['priority'] === 'urgent'): ?>
                                        <span class="badge badge-sm badge-danger">Urgent</span>
                                    <?php endif; ?>
                                </div>
                                <div class="text-sm text-muted flex gap-4" style="flex-wrap:wrap">
                                    <?php if (!empty($task['assignee_name'])): ?>
                                        <span><?= tf_icon('user', 12) ?> <?= e($task['assignee_name']) ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($task['store_name'])): ?>
                                        <span style="color:<?= e($task['store_color'] ?? '#6B7280') ?>">● <?= e($task['store_name']) ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($task['due_date'])): ?>
                                        <span><?= tf_icon('calendar', 12) ?> <?= date('d/m/Y', strtotime($task['due_date'])) ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($task['submitted_at'])): ?>
                                        <span><?= tf_icon('send', 12) ?> Submitted <?= time_ago($task['submitted_at']) ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($task['checked_at'])): ?>
                                        <span><?= tf_icon('check-circle', 12) ?> Checked <?= time_ago($task['checked_at']) ?></span>
                                    <?php endif; ?>
                                </div>
                                <?php if (!empty($task['rejection_reason'])): ?>
                                    <div class="text-sm mt-2" style="color:var(--danger);background:rgba(239,68,68,.06);padding:8px;border-radius:6px">
                                        <strong>Rejection reason:</strong> <?= e($task['rejection_reason']) ?>
                                    </div>
                                <?php endif; ?>
                            </div>

                            <!-- Actions per stage -->
                            <div class="flex gap-2 ml-4">
                                <?php if (($stage ?? 'submitted') === 'submitted'): ?>
                                    <form method="POST" action="<?= APP_URL ?>/admin/tasks/workflow/check" style="display:inline">
                                        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                                        <input type="hidden" name="task_id" value="<?= $task['id'] ?>">
                                        <input type="text" name="note" placeholder="Checker's note (optional)" class="form-control" style="width:180px;display:inline;margin-right:6px">
                                        <button type="submit" class="btn btn-primary btn-sm">✓ Mark Checked</button>
                                    </form>
                                <?php elseif (($stage ?? '') === 'checking'): ?>
                                    <form method="POST" action="<?= APP_URL ?>/admin/tasks/workflow/accept" style="display:inline">
                                        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                                        <input type="hidden" name="task_id" value="<?= $task['id'] ?>">
                                        <input type="text" name="note" placeholder="Acceptance note" class="form-control" style="width:160px;display:inline;margin-right:6px">
                                        <button type="submit" class="btn btn-success btn-sm">✓ Accept</button>
                                    </form>
                                    <form method="POST" action="<?= APP_URL ?>/admin/tasks/workflow/reject" style="display:inline">
                                        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                                        <input type="hidden" name="task_id" value="<?= $task['id'] ?>">
                                        <input type="text" name="reason" placeholder="Rejection reason" required class="form-control" style="width:160px;display:inline;margin-right:6px">
                                        <button type="submit" class="btn btn-danger btn-sm">✗ Reject</button>
                                    </form>
                                <?php elseif (($stage ?? '') === 'rejected'): ?>
                                    <form method="POST" action="<?= APP_URL ?>/admin/tasks/workflow/reopen" style="display:inline">
                                        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                                        <input type="hidden" name="task_id" value="<?= $task['id'] ?>">
                                        <button type="submit" class="btn btn-outline btn-sm">↩ Reopen Task</button>
                                    </form>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</div>

<style>
.badge-payroll { background: #dbeafe; color: #1d4ed8; }
.badge-tax { background: #fef9c3; color: #a16207; }
.badge-sale_receipt { background: #d1fae5; color: #065f46; }
.badge-bill { background: #ede9fe; color: #6d28d9; }
.badge-payment { background: #e0e7ff; color: #3730a3; }
.badge-store_operation { background: #f3f4f6; color: #374151; }
.badge-admin { background: #fee2e2; color: #991b1b; }
.badge-other { background: #f9fafb; color: #6b7280; }
</style>
