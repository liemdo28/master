<?php
$pageTitle = t('page.bills') . ' - ' . ($store['name'] ?? 'Store');
$currentPage = 'bills';

$monthNamesStr = t('bills.month_names');
$monthNames = explode(',', $monthNamesStr);

// Color palette
$colorPalette = [
    '#ff2bd6' => 'Pink',
    '#00f5ff' => 'Cyan',
    '#b6ff00' => 'Lime',
    '#7c3cff' => 'Purple',
    '#ffea00' => 'Yellow',
    '#ff6b2b' => 'Orange',
    '#ff1744' => 'Red',
    '#2979ff' => 'Blue',
    '#1de9b6' => 'Teal',
    '#ffffff' => 'White',
];

// Calendar setup
$firstDay = mktime(0, 0, 0, $month, 1, $year);
$daysInMonth = date('t', $firstDay);
$startDow = (date('N', $firstDay)); // 1=Monday
$today = date('Y-m-d');

// Format currency helper
function fmtAmount($amt) {
    if ($amt === null || $amt === '' || $amt == 0) return '';
    return number_format((float)$amt, 0, ',', '.');
}

function fmtDueTime($time) {
    if (!$time) return '';
    return substr((string)$time, 0, 5);
}

function renderUserSelect($name, $label, $users, $selected = null) {
    ob_start();
    ?>
    <div class="form-group">
        <label><?= e($label) ?></label>
        <select class="form-control" name="<?= e($name) ?>" data-user-field="<?= e($name) ?>">
            <option value="">--</option>
            <?php foreach ($users as $u): ?>
                <option value="<?= (int)$u['id'] ?>" <?= ((int)$selected === (int)$u['id']) ? 'selected' : '' ?>>
                    <?= e($u['name']) ?><?= !empty($u['role']) ? ' (' . e($u['role']) . ')' : '' ?>
                </option>
            <?php endforeach; ?>
        </select>
    </div>
    <?php
    return ob_get_clean();
}

function billCategoryLabel($category) {
    return ucwords(str_replace('_', ' ', (string)$category));
}

ob_start();
?>
<div class="flex-between mb-3">
    <div style="display:flex;gap:10px;align-items:center">
        <span class="store-dot" style="width:12px;height:12px;border-radius:99px;background:<?= e($store['color'] ?: 'var(--neon-cyan)') ?>"></span>
        <div>
            <h2 style="margin:0;font-size:18px;font-weight:800"><?= e($store['name']) ?></h2>
            <div class="text-muted text-sm"><?= e($store['address'] ?? '') ?></div>
        </div>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
        <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills"><?= e(t('bills.back_stores')) ?></a>
        <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills/store/<?= $store['id'] ?>?month=<?= $prevMonth ?>&year=<?= $prevYear ?>">‹</a>
        <div class="badge"><?= $monthNames[$month] ?? '' ?> <?= (int)$year ?></div>
        <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills/store/<?= $store['id'] ?>?month=<?= $nextMonth ?>&year=<?= $nextYear ?>">›</a>
    </div>
</div>

<?php if ($msg = flash('success')): ?>
<div class="alert alert-success"><?= e($msg) ?></div>
<?php endif; ?>
<?php if ($msg = flash('error')): ?>
<div class="alert alert-error"><?= e($msg) ?></div>
<?php endif; ?>

<!-- Monthly Summary Stats -->
<?php if ($summary && $summary['total_bills'] > 0): ?>
<div class="grid grid-4 mb-4">
    <div class="stat-card">
        <div class="stat-icon dark">📋</div>
        <div><div class="stat-value"><?= (int)$summary['total_bills'] ?></div><div class="stat-label"><?= e(t('bills.total_bills')) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon red">⏳</div>
        <div><div class="stat-value"><?= (int)$summary['pending_count'] + (int)$summary['overdue_count'] ?></div><div class="stat-label"><?= e(t('bills.unpaid')) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div><div class="stat-value"><?= (int)$summary['paid_count'] ?></div><div class="stat-label"><?= e(t('bills.paid_label')) ?></div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon blue">💰</div>
        <div>
            <div class="stat-value" style="font-size:18px"><?= fmtAmount($summary['total_amount']) ?: '0' ?></div>
            <div class="stat-label">
                <?php if ($summary['unpaid_amount'] > 0): ?>
                    <?= e(t('bills.remaining')) ?>: <span style="color:var(--neon-pink);font-weight:700"><?= fmtAmount($summary['unpaid_amount']) ?></span>
                <?php else: ?>
                    <?= e(t('bills.total_amount')) ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>
<?php endif; ?>

<div class="grid grid-2 mb-4">
    <div class="card">
        <div class="card-header"><h3>➕ <?= e(t('bills.add_bill')) ?></h3></div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/bills/create" enctype="multipart/form-data">
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <input type="hidden" name="store_id" value="<?= (int)$store['id'] ?>">
                <div class="form-group"><label><?= e(t('bills.bill_name')) ?></label><input class="form-control" name="title" required placeholder="Water / Electric / Internet..."></div>
                <div class="grid grid-2" style="gap:10px">
                    <div class="form-group"><label><?= e(t('bills.due_date')) ?></label><input class="form-control" type="date" name="due_date" id="due-date-create" required value="<?= e($today) ?>"></div>
                    <div class="form-group"><label><?= e(t('bills.amount')) ?></label><input class="form-control" type="number" step="0.01" name="amount" placeholder="0.00"></div>
                </div>
                <div class="form-group"><label><?= e(t('bills.repeat')) ?></label>
                    <div class="repeat-builder">
                        <div class="repeat-controls repeat-controls-inline" style="display:flex;align-items:center;gap:10px;flex-wrap:nowrap">
                            <select class="form-control repeat-type-select" name="repeat_type" id="repeat-type-create" onchange="renderRepeatControls('create')" style="flex:1.2 1 0;min-width:0">
                                <option value="none"><?= e(t('bills.no_repeat')) ?></option>
                                <option value="hourly"><?= e(t('bills.hourly')) ?></option>
                                <option value="daily"><?= e(t('bills.daily')) ?></option>
                                <option value="weekly"><?= e(t('bills.weekly')) ?></option>
                                <option value="monthly"><?= e(t('bills.monthly')) ?></option>
                                <option value="yearly"><?= e(t('bills.yearly')) ?></option>
                            </select>
                            <select class="form-control repeat-number" name="repeat_interval" id="repeat-interval-create" onchange="renderRepeatControls('create')" style="flex:0 0 96px;min-width:96px"></select>
                            <select class="form-control repeat-anchor-select" name="repeat_anchor" id="repeat-anchor-create" style="flex:1.1 1 0;min-width:0"></select>
                        </div>
                        <div class="repeat-hint" id="repeat-hint-create"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select class="form-control" name="bill_categories[]" multiple size="6">
                        <?php foreach ($categoryOptions as $cat): ?>
                            <option value="<?= e($cat) ?>" <?= $cat === 'general' ? 'selected' : '' ?>><?= e(billCategoryLabel($cat)) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <div class="text-muted text-sm" style="margin-top:6px">Hold Ctrl/Cmd to select more than one.</div>
                </div>
                <div class="form-group"><label><?= e(t('bills.vendor')) ?></label>
                    <select class="form-control" name="vendor_id" id="vendor-select-create" onchange="toggleNewVendor('create')">
                        <option value=""><?= e(t('bills.select_vendor')) ?></option>
                        <?php foreach ($vendors as $v): ?><option value="<?= $v['id'] ?>"><?= e($v['name']) ?></option><?php endforeach; ?>
                        <option value="new"><?= e(t('bills.new_vendor')) ?></option>
                    </select>
                    <input class="form-control mt-1" name="vendor_new" id="vendor-new-create" placeholder="<?= e(t('bills.new_vendor_name')) ?>" style="display:none">
                </div>
                <div class="grid grid-2" style="gap:10px">
                    <?= renderUserSelect('responsible_user_id', 'Responsible', $users) ?>
                    <?= renderUserSelect('checker_user_id', 'Checker', $users) ?>
                    <?= renderUserSelect('approver_user_id', 'Approver', $users) ?>
                    <?= renderUserSelect('verifier_user_id', 'Verifier', $users) ?>
                    <?= renderUserSelect('reviewer_id', 'Reviewer', $users) ?>
                    <div class="form-group">
                        <label>Reviewer Due</label>
                        <input class="form-control" type="date" name="reviewer_due_date">
                    </div>
                </div>
                <div class="form-group"><label>Review Instructions</label><textarea class="form-control" name="review_instructions" rows="2" placeholder="What should reviewer check?"></textarea></div>
                <div class="form-group"><label><?= e(t('bills.color')) ?></label>
                    <input type="hidden" name="color" id="color-create" value="">
                    <div class="color-options"><?php foreach ($colorPalette as $hex => $name): ?><div class="color-option" style="background:<?= $hex ?>" title="<?= $name ?>" onclick="selectColor('create', '<?= $hex ?>', this)"></div><?php endforeach; ?></div>
                </div>
                <div class="form-group"><label><?= e(t('bills.note')) ?></label><input class="form-control" name="note" placeholder="..."></div>
                <div class="form-group"><label><?= e(t('bills.attach')) ?></label><input class="form-control" type="file" name="bill_file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"></div>
                <button class="btn btn-primary" type="submit" id="btn-add-bill"><?= e(t('bills.add')) ?></button>
                <div class="text-muted text-sm" style="margin-top:10px"><?= t('bills.reminder_tip') ?></div>
            </form>
        </div>
    </div>
    <div class="card">
        <div class="card-header"><h3>📋 <?= e(t('bills.bill_list')) ?> (<?= $monthNames[$month] ?? '' ?>)</h3><span class="text-muted text-sm"><?= count($bills) ?> <?= e(t('bills.bills_count')) ?></span></div>
        <div class="card-body">
            <?php if (empty($bills)): ?>
                <div class="empty-state"><div class="icon">💳</div><h3><?= e(t('bills.empty')) ?></h3><p><?= e(t('bills.empty_desc')) ?></p></div>
            <?php else: ?>
                <div class="bill-list">
                    <?php foreach ($bills as $b): $urgencyColor = dueColor($b['due_date'], $b['status']); ?>
                    <div class="bill-row bill-row-clickable" data-bill-trigger="<?= (int)$b['id'] ?>" tabindex="0" role="button">
                        <div class="bill-left">
                            <span class="bill-dot" style="background:<?= e($urgencyColor) ?>"></span>
                            <div>
                                <div class="bill-title"><?= e($b['title']) ?></div>
                                <div class="text-muted text-sm">
                                    <?= e($b['vendor'] ?? '') ?>
                                    <?php if (!empty($b['due_time'])): ?><?php if (!empty($b['vendor'])): ?> · <?php endif; ?><span style="color:var(--neon-cyan);font-weight:700"><?= e(fmtDueTime($b['due_time'])) ?></span><?php endif; ?>
                                    <?php if (!empty($b['amount']) && $b['amount'] > 0): ?><?php if (!empty($b['vendor']) || !empty($b['due_time'])): ?> · <?php endif; ?><span style="color:var(--neon-yellow);font-weight:700"><?= fmtAmount($b['amount']) ?></span><?php endif; ?>
                                </div>
                            </div>
                        </div>
                        <div class="bill-right">
                            <?php if (!empty($b['attachments'])): ?><span class="text-muted text-sm" title="<?= count($b['attachments']) ?> file(s)">📎<?= count($b['attachments']) ?></span><?php endif; ?>
                            <span class="chip" style="border-color:<?= e($urgencyColor) ?>40;color:<?= e($urgencyColor) ?>"><?= e(date('d/m', strtotime($b['due_date']))) ?></span>
                            <?php if (!empty($b['due_time'])): ?><span class="chip chip-info"><?= e(fmtDueTime($b['due_time'])) ?></span><?php endif; ?>
                            <button type="button" class="btn btn-outline btn-sm bill-edit-action" data-bill-trigger="<?= (int)$b['id'] ?>"><?= e(t('bills.edit_btn')) ?></button>
                            <?php if ($b['status'] === 'paid'): ?><span class="pill pill-ok"><?= e(t('bills.status_paid')) ?></span>
                            <?php elseif ($b['status'] === 'overdue'): ?><span class="badge-overdue" style="font-size:11px"><?= e(t('bills.status_overdue')) ?></span><a class="btn btn-ghost btn-sm" data-no-modal="true" href="<?= APP_URL ?>/bills/<?= (int)$b['id'] ?>/paid"><?= e(t('bills.pay_btn')) ?></a>
                            <?php else: ?><a class="btn btn-ghost btn-sm" data-no-modal="true" href="<?= APP_URL ?>/bills/<?= (int)$b['id'] ?>/paid"><?= e(t('bills.pay_btn')) ?></a><?php endif; ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--text-muted)">
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#2979ff;display:inline-block"></span> <?= e(t('bills.legend_3days')) ?></span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#ffea00;display:inline-block"></span> <?= e(t('bills.legend_1to3')) ?></span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#ff2bd6;display:inline-block"></span> <?= e(t('bills.legend_today')) ?></span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#ff1744;display:inline-block"></span> <?= e(t('bills.legend_overdue')) ?></span>
                <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#333333;display:inline-block"></span> <?= e(t('bills.legend_paid')) ?></span>
            </div>
        </div>
    </div>
</div>

<div class="card">
    <div class="card-header"><h3>🗓️ <?= e(t('bills.calendar')) ?></h3><span class="text-muted text-sm"><?= e(t('bills.calendar_desc')) ?></span></div>
    <div class="card-body" style="padding:0">
        <div class="calendar-wrap">
            <div class="cal-head">
                <div class="cal-dow"><?= e(t('bills.dow_mon')) ?></div><div class="cal-dow"><?= e(t('bills.dow_tue')) ?></div><div class="cal-dow"><?= e(t('bills.dow_wed')) ?></div><div class="cal-dow"><?= e(t('bills.dow_thu')) ?></div><div class="cal-dow"><?= e(t('bills.dow_fri')) ?></div><div class="cal-dow"><?= e(t('bills.dow_sat')) ?></div><div class="cal-dow"><?= e(t('bills.dow_sun')) ?></div>
            </div>
            <div class="cal-grid">
                <?php
                $cell = 1; $day = 1;
                $totalCells = ceil(($startDow - 1 + $daysInMonth) / 7) * 7;
                while ($cell <= $totalCells):
                    $isBlank = ($cell < $startDow) || ($day > $daysInMonth);
                    if ($isBlank) { echo '<div class="cal-cell cal-blank"></div>'; } else {
                        $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
                        $isToday = ($date === $today);
                        $dayBills = $billsByDate[$date] ?? [];
                        $primaryBillId = !empty($dayBills) ? (int)$dayBills[0]['id'] : 0;
                        echo '<div class="cal-cell '.($isToday?'cal-today ':'').(!empty($dayBills)?'cal-cell-interactive':'').'"'.($primaryBillId ? ' data-bill-trigger="'.$primaryBillId.'" tabindex="0" role="button"' : '').'>';
                        echo '<div class="cal-day">'.$day.'</div>';
                        if (!empty($dayBills)) {
                            echo '<div class="cal-items">';
                            foreach (array_slice($dayBills, 0, 4) as $b) {
                                $urgColor = dueColor($b['due_date'], $b['status']);
                                $timeLabel = !empty($b['due_time']) ? ' · '.fmtDueTime($b['due_time']) : '';
                                $amtLabel = (!empty($b['amount']) && $b['amount'] > 0) ? ' · '.fmtAmount($b['amount']) : '';
                                echo '<button type="button" class="cal-item cal-item-button" data-bill-trigger="'.(int)$b['id'].'" style="border-left-color:'.e($urgColor).';background:'.e($urgColor).'15"><span class="cal-item-title">'.e($b['title']).$timeLabel.$amtLabel.'</span></button>';
                            }
                            if (count($dayBills) > 4) echo '<div class="text-muted text-sm" style="margin-top:6px">+'.(count($dayBills)-4).' '.e(t('common.more')).'</div>';
                            echo '</div>';
                        }
                        echo '</div>'; $day++;
                    }
                    $cell++;
                endwhile;
                ?>
            </div>
        </div>
    </div>
</div>

<div class="modal-overlay" id="editModal" onclick="if(event.target===this)closeEditModal()">
    <div class="modal-content" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;width:100%;max-width:560px;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
        <div class="modal-header"><h3 id="editModalTitle"><?= e(t('bills.edit_bill')) ?></h3><button class="btn-ghost" onclick="closeEditModal()" style="font-size:18px">✕</button></div>
        <form method="POST" id="editForm" enctype="multipart/form-data">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div class="modal-body" style="padding:22px">
                <div class="form-group"><label><?= e(t('bills.bill_name')) ?></label><input class="form-control" name="title" id="edit-title" required></div>
                <div class="grid grid-2" style="gap:10px">
                    <div class="form-group"><label><?= e(t('bills.due_date')) ?></label><input class="form-control" type="date" name="due_date" id="edit-due_date" required></div>
                    <div class="form-group"><label><?= e(t('bills.amount')) ?></label><input class="form-control" type="number" step="0.01" name="amount" id="edit-amount"></div>
                </div>
                <div class="form-group"><label><?= e(t('bills.repeat')) ?></label>
                    <div class="repeat-builder">
                        <div class="repeat-controls repeat-controls-inline" style="display:flex;align-items:center;gap:10px;flex-wrap:nowrap">
                            <select class="form-control repeat-type-select" name="repeat_type" id="repeat-type-edit" onchange="renderRepeatControls('edit')" style="flex:1.2 1 0;min-width:0">
                                <option value="none"><?= e(t('bills.no_repeat')) ?></option><option value="hourly"><?= e(t('bills.hourly')) ?></option><option value="daily"><?= e(t('bills.daily')) ?></option><option value="weekly"><?= e(t('bills.weekly')) ?></option><option value="monthly"><?= e(t('bills.monthly')) ?></option><option value="yearly"><?= e(t('bills.yearly')) ?></option>
                            </select>
                            <select class="form-control repeat-number" name="repeat_interval" id="repeat-interval-edit" onchange="renderRepeatControls('edit')" style="flex:0 0 96px;min-width:96px"></select>
                            <select class="form-control repeat-anchor-select" name="repeat_anchor" id="repeat-anchor-edit" style="flex:1.1 1 0;min-width:0"></select>
                        </div>
                        <div class="repeat-hint" id="repeat-hint-edit"></div>
                    </div>
                </div>
                <div class="form-group"><label><?= e(t('bills.status')) ?></label>
                    <select class="form-control" name="status" id="edit-status">
                        <option value="pending"><?= e(t('bills.status_pending')) ?></option><option value="paid"><?= e(t('bills.status_paid')) ?></option><option value="overdue"><?= e(t('bills.status_overdue')) ?></option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select class="form-control" name="bill_categories[]" id="edit-categories" multiple size="6">
                        <?php foreach ($categoryOptions as $cat): ?>
                            <option value="<?= e($cat) ?>"><?= e(billCategoryLabel($cat)) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <div class="text-muted text-sm" style="margin-top:6px">Hold Ctrl/Cmd to select more than one.</div>
                </div>
                <div class="form-group"><label><?= e(t('bills.vendor')) ?></label>
                    <select class="form-control" name="vendor_id" id="edit-vendor_id" onchange="toggleNewVendor('edit')">
                        <option value=""><?= e(t('bills.select_vendor')) ?></option>
                        <?php foreach ($vendors as $v): ?><option value="<?= $v['id'] ?>"><?= e($v['name']) ?></option><?php endforeach; ?>
                        <option value="new"><?= e(t('bills.new_vendor')) ?></option>
                    </select>
                    <input class="form-control mt-1" name="vendor_new" id="vendor-new-edit" placeholder="<?= e(t('bills.new_vendor_name')) ?>" style="display:none">
                </div>
                <div class="grid grid-2" style="gap:10px">
                    <?= renderUserSelect('responsible_user_id', 'Responsible', $users) ?>
                    <?= renderUserSelect('checker_user_id', 'Checker', $users) ?>
                    <?= renderUserSelect('approver_user_id', 'Approver', $users) ?>
                    <?= renderUserSelect('verifier_user_id', 'Verifier', $users) ?>
                    <?= renderUserSelect('reviewer_id', 'Reviewer', $users) ?>
                    <div class="form-group">
                        <label>Reviewer Due</label>
                        <input class="form-control" type="date" name="reviewer_due_date" id="edit-reviewer_due_date">
                    </div>
                </div>
                <div class="form-group"><label>Review Instructions</label><textarea class="form-control" name="review_instructions" id="edit-review_instructions" rows="2"></textarea></div>
                <div class="form-group"><label><?= e(t('bills.color')) ?></label>
                    <input type="hidden" name="color" id="color-edit" value="">
                    <div class="color-options"><?php foreach ($colorPalette as $hex => $name): ?><div class="color-option" style="background:<?= $hex ?>" title="<?= $name ?>" onclick="selectColor('edit', '<?= $hex ?>', this)"></div><?php endforeach; ?></div>
                </div>
                <div class="form-group"><label><?= e(t('bills.note')) ?></label><input class="form-control" name="note" id="edit-note"></div>
                <div id="edit-attachments"></div>
                <div class="form-group"><label><?= e(t('bills.attach_more')) ?></label><input class="form-control" type="file" name="bill_file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"></div>
            </div>
            <div class="modal-footer" style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;gap:8px">
                    <a class="btn btn-ghost btn-sm" id="edit-delete-btn" onclick="return confirm('<?= e(t('bills.delete_bill_confirm')) ?>')" style="color:var(--neon-pink)"><?= e(t('common.delete')) ?></a>
                    <a class="btn btn-ghost btn-sm" id="edit-duplicate-btn" style="color:var(--neon-cyan)"><?= e(t('bills.duplicate')) ?></a>
                </div>
                <div style="display:flex;gap:8px">
                    <button type="button" class="btn btn-secondary" onclick="closeEditModal()"><?= e(t('common.cancel')) ?></button>
                    <button type="submit" class="btn btn-primary"><?= e(t('common.save')) ?></button>
                </div>
            </div>
        </form>
    </div>
</div>

<script>
const billData = <?= json_encode(array_values($bills), JSON_UNESCAPED_UNICODE) ?>;
const BL = {edit:<?=json_encode(t('bills.edit_bill'))?>,attach:<?=json_encode(t('bills.current_attach'))?>,delFile:<?=json_encode(t('common.confirm_delete'))?>,sPending:<?=json_encode(t('bills.status_pending'))?>,sPaid:<?=json_encode(t('bills.status_paid'))?>,sOverdue:<?=json_encode(t('bills.status_overdue'))?>};

function openEditModal(billId) {
    const bill = billData.find(b => b.id == billId);
    if (!bill) return;
    document.getElementById('editForm').action = '<?= APP_URL ?>/bills/' + billId + '/update';
    document.getElementById('edit-title').value = bill.title || '';
    document.getElementById('edit-due_date').value = bill.due_date || '';
    document.getElementById('edit-amount').value = bill.amount || '';
    document.getElementById('edit-note').value = bill.note || '';
    document.getElementById('edit-delete-btn').href = '<?= APP_URL ?>/bills/' + billId + '/delete';
    document.getElementById('edit-duplicate-btn').href = '<?= APP_URL ?>/bills/' + billId + '/duplicate';
    setRepeatState('edit', {type: bill.repeat_type || 'none', interval: bill.repeat_interval || 1, anchor: bill.repeat_day ?? null});
    document.getElementById('edit-status').value = bill.status || 'pending';
    const selectedCategories = Array.isArray(bill.categories) && bill.categories.length ? bill.categories : (bill.category ? [bill.category] : ['general']);
    document.querySelectorAll('#edit-categories option').forEach(function(opt) {
        opt.selected = selectedCategories.indexOf(opt.value) !== -1;
    });
    const vendorSelect = document.getElementById('edit-vendor_id');
    const vendorNewInput = document.getElementById('vendor-new-edit');
    vendorNewInput.value = '';
    if (bill.vendor_id) vendorSelect.value = bill.vendor_id;
    else if (bill.vendor) { vendorSelect.value = 'new'; vendorNewInput.value = bill.vendor; }
    else vendorSelect.value = '';
    toggleNewVendor('edit');
    ['responsible_user_id','checker_user_id','approver_user_id','verifier_user_id','reviewer_id'].forEach(function(field) {
        const el = document.querySelector('#editModal [data-user-field="' + field + '"]');
        if (el) el.value = bill[field] || '';
    });
    document.getElementById('edit-reviewer_due_date').value = bill.reviewer_due_date || '';
    document.getElementById('edit-review_instructions').value = bill.review_instructions || '';
    document.getElementById('color-edit').value = bill.color || '';
    document.querySelectorAll('#editModal .color-option').forEach(el => el.classList.toggle('selected', el.style.background === bill.color || rgbToHex(el.style.backgroundColor) === (bill.color || '').toLowerCase()));
    const attDiv = document.getElementById('edit-attachments');
    if (bill.attachments && bill.attachments.length > 0) {
        let html = '<div class="form-group"><label>' + BL.attach + '</label><div class="attachment-list">';
        bill.attachments.forEach(att => { html += `<div class="attachment-item"><a href="<?= APP_URL ?>/bill-attachments/${att.id}/download" class="attachment-name">${escHtml(att.original_name)}</a><span class="text-muted text-sm">(${Math.round(att.file_size/1024)}KB)</span><a href="<?= APP_URL ?>/bill-attachments/${att.id}/delete" class="btn-ghost text-sm" onclick="return confirm('${BL.delFile}')" style="color:var(--neon-pink)">✕</a></div>`; });
        html += '</div></div>'; attDiv.innerHTML = html;
    } else attDiv.innerHTML = '';
    const sc = {pending:'var(--neon-yellow)',paid:'var(--green)',overdue:'var(--neon-pink)'};
    const sl = {pending:BL.sPending,paid:BL.sPaid,overdue:BL.sOverdue};
    document.getElementById('editModalTitle').innerHTML = BL.edit + ' <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:' + (sc[bill.status]||'var(--text-muted)') + '20;color:' + (sc[bill.status]||'var(--text-muted)') + ';font-weight:700;margin-left:8px">' + (sl[bill.status]||bill.status) + '</span>';
    document.getElementById('editModal').classList.add('active');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('active'); }
function selectColor(ctx, hex, el) { document.getElementById('color-' + ctx).value = hex; el.parentElement.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); }
function toggleNewVendor(ctx) { const s = document.getElementById('vendor-select-' + ctx) || document.getElementById(ctx === 'edit' ? 'edit-vendor_id' : 'vendor-select-create'); const n = document.getElementById('vendor-new-' + ctx); if (s && n) n.style.display = s.value === 'new' ? 'block' : 'none'; }
const repeatConfigMap = {none:{max:1,hint:()=>''},hourly:{max:24,hint:(_,i,a)=>`${i}h, ${a}`},daily:{max:30,hint:(d,i)=>`${i}d`},weekly:{max:12,hint:(d,i)=>`${i}w`},monthly:{max:12,hint:(d,i)=>`${i}m`},yearly:{max:10,hint:(d,i)=>`${i}y`}};
function repeatDueInputId(ctx) { return ctx === 'edit' ? 'edit-due_date' : 'due-date-create'; }
function formatRepeatDay(d) { if(!d||!d.includes('-'))return'--'; return parseInt(d.split('-')[2],10)||'--'; }
function formatRepeatWeekday(d) { if(!d)return'--'; const dt=new Date(d+'T00:00:00'); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]||'--'; }
function formatRepeatMonthDay(d) { if(!d||!d.includes('-'))return'--'; const[y,m,dy]=d.split('-').map(Number); return['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(m||1)-1]+' '+(dy||1); }
function formatRepeatDate(d) { if(!d||!d.includes('-'))return'--'; const[y,m,dy]=d.split('-').map(Number); return`${String(dy||1).padStart(2,'0')}/${String(m||1).padStart(2,'0')}/${y||''}`; }
function repeatHourLabel(h) { return`${String(Math.max(0,Math.min(23,parseInt(h,10)||0))).padStart(2,'0')}:00`; }
function fillRepeatIntervalOptions(ctx,type,sel) { const el=document.getElementById('repeat-interval-'+ctx); if(!el)return; const max=(repeatConfigMap[type]||repeatConfigMap.none).max||1; el.innerHTML=''; for(let i=1;i<=max;i++){const o=document.createElement('option');o.value=String(i);o.textContent=String(i);el.appendChild(o);} el.value=String(Math.max(1,Math.min(max,parseInt(sel,10)||1))); el.disabled=type==='none'; }
function fillRepeatAnchorOptions(ctx,type,sel) { const el=document.getElementById('repeat-anchor-'+ctx),due=document.getElementById(repeatDueInputId(ctx)); if(!el||!due)return; el.innerHTML='';el.disabled=type!=='hourly';el.classList.toggle('repeat-anchor-readonly',type!=='hourly'); if(type==='hourly'){for(let h=0;h<24;h++){const o=document.createElement('option');o.value=String(h);o.textContent=repeatHourLabel(h);el.appendChild(o);}el.value=String(Math.max(0,Math.min(23,parseInt(sel,10)||7)));return;} const o=document.createElement('option');o.value=''; if(type==='daily')o.textContent=formatRepeatDate(due.value);if(type==='weekly')o.textContent=formatRepeatWeekday(due.value);if(type==='monthly')o.textContent=formatRepeatDay(due.value);if(type==='yearly')o.textContent=formatRepeatMonthDay(due.value);if(type==='none')o.textContent='-'; el.appendChild(o);el.value=''; }
function renderRepeatControls(ctx) { const ts=document.getElementById('repeat-type-'+ctx),h=document.getElementById('repeat-hint-'+ctx); if(!ts||!h)return; const type=ts.value||'none'; fillRepeatIntervalOptions(ctx,type,document.getElementById('repeat-interval-'+ctx)?.value||1); fillRepeatAnchorOptions(ctx,type,document.getElementById('repeat-anchor-'+ctx)?.value||null); const iv=document.getElementById('repeat-interval-'+ctx)?.value||'1',av=document.getElementById('repeat-anchor-'+ctx)?.value||'',al=type==='hourly'?repeatHourLabel(av):''; h.textContent=repeatConfigMap[type].hint(document.getElementById(repeatDueInputId(ctx))?.value||'',iv,al); }
function setRepeatState(ctx,st) { const ts=document.getElementById('repeat-type-'+ctx); if(!ts)return; ts.value=st.type||'none'; fillRepeatIntervalOptions(ctx,ts.value,st.interval||1); fillRepeatAnchorOptions(ctx,ts.value,st.anchor); renderRepeatControls(ctx); }
function rgbToHex(rgb) { if(!rgb||rgb.startsWith('#'))return rgb; const m=rgb.match(/\d+/g); if(!m||m.length<3)return''; return'#'+m.slice(0,3).map(x=>parseInt(x).toString(16).padStart(2,'0')).join(''); }
function escHtml(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeEditModal();});
document.addEventListener('click',e=>{if(e.target.closest('[data-no-modal="true"]'))return;const t=e.target.closest('[data-bill-trigger]');if(!t)return;e.preventDefault();openEditModal(t.getAttribute('data-bill-trigger'));});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const t=e.target.closest('.bill-row-clickable, .cal-cell-interactive');if(!t||t!==e.target)return;e.preventDefault();openEditModal(t.getAttribute('data-bill-trigger'));});
const ddc=document.getElementById('due-date-create');if(ddc)ddc.addEventListener('change',()=>renderRepeatControls('create'));
const dde=document.getElementById('edit-due_date');if(dde)dde.addEventListener('change',()=>renderRepeatControls('edit'));
setRepeatState('create',{type:'none',interval:1,anchor:7});setRepeatState('edit',{type:'none',interval:1,anchor:7});

// Fix 1: make date inputs open picker on click
document.querySelectorAll('input[type="date"]').forEach(el=>{
    el.addEventListener('click',function(){if(this.showPicker)this.showPicker();});
});

// Fix 3: Duplicate check on bill creation form submit
(function(){
    const form = document.querySelector('form[action$="/bills/create"]');
    if(!form) return;
    let _confirmed = false;
    form.addEventListener('submit', async function(e){
        if(_confirmed){_confirmed=false;return;}
        e.preventDefault();
        const fd = new FormData(form);
        const check = new FormData();
        check.append('title',    fd.get('title')||'');
        check.append('store_id', fd.get('store_id')||'');
        check.append('due_date', fd.get('due_date')||'');
        check.append('amount',   fd.get('amount')||'0');
        check.append('vendor',   '');
        check.append('category', '');
        let res;
        try { res = await fetch('<?= APP_URL ?>/api/bills/check-duplicate',{method:'POST',body:check}).then(r=>r.json()); }
        catch { form.submit(); return; }
        if(!res.duplicate){ form.submit(); return; }
        const m = res.match;
        const msg = `⚠️ Possible duplicate detected (${res.score}% match)\n\n` +
            `Existing bill: "${m.title}"\n` +
            `Due: ${m.due_date}  ·  Status: ${m.status}\n\n` +
            `Save anyway?`;
        if(confirm(msg)){_confirmed=true;form.submit();}
    });
})();
</script>

<!-- Duplicate warning modal (used by JS confirm above) -->

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php';
