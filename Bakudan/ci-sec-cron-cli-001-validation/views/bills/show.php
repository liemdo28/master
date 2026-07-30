<?php
$pageTitle = ($bill['title'] ?? 'Bill') . ' — Bill Detail';
ob_start();

$amount = (float)($bill['amount'] ?? 0);
$status = $bill['status'] ?? 'pending';
$statusColor = $status === 'paid' ? '#22C55E' : ($isOverdue ? '#EF4444' : '#F59E0B');
$statusLabel = $status === 'paid' ? 'Paid' : ($isOverdue ? 'Overdue' : ucfirst($status));
$repeatType = $bill['repeat_type'] ?? 'none';
$billCategories = $billCategories ?? (!empty($bill['category']) ? [$bill['category']] : ['general']);
$categoryOptions = $categoryOptions ?? ['general'];
$linkedTasks = $linkedTasks ?? [];
$canEditBillDetail = $canEditBillDetail ?? false;

if (!function_exists('billDetailCategoryLabel')) {
    function billDetailCategoryLabel($category) {
        return ucwords(str_replace('_', ' ', (string)$category));
    }
}

if (!function_exists('billDetailDateLabel')) {
    function billDetailDateLabel($date): string {
        if (empty($date)) return '-';
        return date('M j, Y', strtotime((string)$date));
    }
}
?>

<style>
.bill-detail-wrap { max-width: 920px; margin: 0 auto; }
.bill-detail-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
.bill-detail-title { margin:0; font-size:24px; font-weight:800; color:var(--text,#f1f5f9); }
.bill-detail-sub { margin-top:5px; color:var(--text-muted,#94a3b8); font-size:13px; }
.bill-detail-status { padding:7px 12px; border-radius:999px; font-size:12px; font-weight:800; border:1px solid currentColor; }
.bill-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
.bill-detail-card { background:var(--bg-secondary,#111827); border:1px solid var(--border,rgba(255,255,255,.08)); border-radius:10px; padding:14px 16px; }
.bill-detail-label { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted,#94a3b8); font-weight:800; margin-bottom:5px; }
.bill-detail-value { font-size:15px; font-weight:700; color:var(--text,#f1f5f9); overflow-wrap:anywhere; }
.bill-detail-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:18px; }
.bill-detail-chip-row { display:flex; gap:6px; flex-wrap:wrap; }
.bill-detail-chip { display:inline-flex; align-items:center; padding:3px 8px; border-radius:7px; background:#2563eb26; color:#93c5fd; border:1px solid #2563eb66; font-size:12px; font-weight:800; }
.bill-detail-form { margin-top:16px; padding:16px; border:1px solid var(--border,rgba(255,255,255,.08)); border-radius:10px; background:rgba(15,23,42,.55); }
.bill-detail-form h2, .bill-linked-tasks h2 { margin:0 0 12px; font-size:14px; color:var(--text,#f1f5f9); }
.bill-detail-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.bill-linked-tasks { margin-top:16px; padding:16px; border:1px solid var(--border,rgba(255,255,255,.08)); border-radius:10px; background:rgba(15,23,42,.42); }
.bill-linked-row { display:flex; justify-content:space-between; gap:12px; align-items:center; padding:10px 0; border-top:1px solid rgba(255,255,255,.07); }
.bill-linked-row:first-of-type { border-top:0; padding-top:0; }
@media(max-width:640px) { .bill-detail-grid { grid-template-columns:1fr; } .bill-detail-title { font-size:20px; } }
@media(max-width:640px) { .bill-detail-form-grid { grid-template-columns:1fr; } }
</style>

<div class="bill-detail-wrap">
    <div class="bill-detail-head">
        <div>
            <h1 class="bill-detail-title"><?= e($bill['title'] ?? 'Bill') ?></h1>
            <div class="bill-detail-sub">
                <?= e($bill['store_name'] ?? 'Store') ?>
                <?php if (!empty($bill['vendor_name'])): ?>
                    · <?= e($bill['vendor_name']) ?>
                <?php endif; ?>
            </div>
        </div>
        <div class="bill-detail-status" style="color:<?= e($statusColor) ?>"><?= e($statusLabel) ?></div>
    </div>

    <div class="bill-detail-grid">
        <div class="bill-detail-card">
            <div class="bill-detail-label">Amount</div>
            <div class="bill-detail-value"><?= $amount > 0 ? '$' . number_format($amount, 2) : '-' ?></div>
        </div>
        <div class="bill-detail-card">
            <div class="bill-detail-label">Due Date</div>
            <div class="bill-detail-value"><?= e(billDetailDateLabel($dueDate)) ?></div>
        </div>
        <div class="bill-detail-card">
            <div class="bill-detail-label">Category</div>
            <div class="bill-detail-value bill-detail-chip-row">
                <?php foreach ($billCategories as $cat): ?>
                    <span class="bill-detail-chip"><?= e(billDetailCategoryLabel($cat)) ?></span>
                <?php endforeach; ?>
            </div>
        </div>
        <div class="bill-detail-card">
            <div class="bill-detail-label">Repeat</div>
            <div class="bill-detail-value"><?= e($repeatType === 'none' ? 'One-time' : ucfirst($repeatType)) ?></div>
        </div>
        <div class="bill-detail-card">
            <div class="bill-detail-label">Store</div>
            <div class="bill-detail-value"><?= e($bill['store_name'] ?? '-') ?></div>
        </div>
        <div class="bill-detail-card">
            <div class="bill-detail-label">Vendor</div>
            <div class="bill-detail-value"><?= e($bill['vendor_name'] ?? $bill['vendor'] ?? '-') ?></div>
        </div>
    </div>

    <?php if (!empty($bill['note'])): ?>
    <div class="bill-detail-card">
        <div class="bill-detail-label">Notes</div>
        <div style="font-size:13px;line-height:1.55;color:var(--text,#f1f5f9);white-space:pre-wrap"><?= e($bill['note']) ?></div>
    </div>
    <?php endif; ?>

    <?php if ($canEditBillDetail): ?>
    <form class="bill-detail-form" method="POST" action="<?= APP_URL ?>/bills/<?= (int)$bill['id'] ?>/update">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
        <input type="hidden" name="repeat_type" value="<?= e($bill['repeat_type'] ?? 'none') ?>">
        <input type="hidden" name="repeat_interval" value="<?= e($bill['repeat_interval'] ?? 1) ?>">
        <input type="hidden" name="repeat_anchor" value="<?= e($bill['repeat_day'] ?? '') ?>">
        <h2>Edit Bill Details</h2>
        <div class="bill-detail-form-grid">
            <div class="form-group">
                <label>Title</label>
                <input class="form-control" name="title" required value="<?= e($bill['title'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input class="form-control" type="date" name="due_date" required value="<?= e($dueDate ?? '') ?>">
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input class="form-control" type="number" step="0.01" name="amount" value="<?= e($bill['amount'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" name="status">
                    <?php foreach (['pending' => 'Pending', 'paid' => 'Paid', 'overdue' => 'Overdue'] as $value => $label): ?>
                        <option value="<?= e($value) ?>" <?= $status === $value ? 'selected' : '' ?>><?= e($label) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select class="form-control" name="bill_categories[]" multiple size="6">
                    <?php foreach ($categoryOptions as $cat): ?>
                        <option value="<?= e($cat) ?>" <?= in_array($cat, $billCategories, true) ? 'selected' : '' ?>><?= e(billDetailCategoryLabel($cat)) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label>Vendor</label>
                <select class="form-control" name="vendor_id">
                    <option value="">--</option>
                    <?php foreach ($vendors as $v): ?>
                        <option value="<?= (int)$v['id'] ?>" <?= (int)($bill['vendor_id'] ?? 0) === (int)$v['id'] ? 'selected' : '' ?>><?= e($v['name']) ?></option>
                    <?php endforeach; ?>
                    <option value="new" <?= empty($bill['vendor_id']) && !empty($bill['vendor']) ? 'selected' : '' ?>>New / typed vendor</option>
                </select>
                <input class="form-control" style="margin-top:8px" name="vendor_new" value="<?= e(empty($bill['vendor_id']) ? ($bill['vendor'] ?? $bill['vendor_name'] ?? '') : '') ?>" placeholder="Typed vendor name">
            </div>
        </div>
        <div class="form-group" style="margin-top:12px">
            <label>Notes</label>
            <textarea class="form-control" name="note" rows="3"><?= e($bill['note'] ?? '') ?></textarea>
        </div>
        <button class="btn btn-primary btn-sm" type="submit">Save Bill</button>
    </form>
    <?php endif; ?>

    <section class="bill-linked-tasks">
        <h2>Linked Tasks</h2>
        <?php if (!empty($linkedTasks)): ?>
            <?php foreach ($linkedTasks as $task): ?>
                <div class="bill-linked-row">
                    <div>
                        <div style="font-weight:800;color:var(--text,#f1f5f9)"><?= e($task['title']) ?></div>
                        <div class="text-muted text-sm">
                            <?= e($task['status'] ?? 'todo') ?>
                            <?php if (!empty($task['assignee_name'])): ?> · <?= e($task['assignee_name']) ?><?php endif; ?>
                            <?php if (!empty($task['due_date'])): ?> · Task due <?= e(billDetailDateLabel($task['due_date'])) ?><?php endif; ?>
                        </div>
                    </div>
                    <a class="btn btn-secondary btn-sm" href="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>" data-detail-drawer>Open / Edit Task</a>
                </div>
            <?php endforeach; ?>
        <?php elseif ($canEditBillDetail): ?>
            <form method="POST" action="<?= APP_URL ?>/bills/<?= (int)$bill['id'] ?>/create-task">
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <?php if ($dueDate): ?>
                    <div class="text-muted text-sm" style="margin-bottom:10px">
                        New task due date will match this bill: <strong style="color:var(--text,#f1f5f9)"><?= e(billDetailDateLabel($dueDate)) ?></strong>
                    </div>
                <?php endif; ?>
                <button class="btn btn-secondary btn-sm" type="submit">Create Task From Bill</button>
            </form>
        <?php else: ?>
            <div class="text-muted text-sm">No linked task yet.</div>
        <?php endif; ?>
    </section>

    <div class="bill-detail-actions">
        <?php if ($status !== 'paid'): ?>
            <a class="btn btn-primary btn-sm" data-no-drawer="true" href="<?= APP_URL ?>/bills/<?= (int)$bill['id'] ?>/paid" onclick="return confirm('Mark this bill as paid?')">Mark Paid</a>
        <?php endif; ?>
        <a class="btn btn-secondary btn-sm" href="<?= APP_URL ?>/bills/store/<?= (int)$bill['store_id'] ?><?= $dueDate ? '?month=' . date('m', strtotime($dueDate)) . '&year=' . date('Y', strtotime($dueDate)) : '' ?>">Open Store Bills</a>
        <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills">Back to Schedule</a>
    </div>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
