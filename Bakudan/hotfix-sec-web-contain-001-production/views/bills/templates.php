<?php
$pageTitle   = 'Recurring Bill Templates';
$currentPage = 'bills-templates';
ob_start();

// ── Recurrence preview helper ──────────────────────────────────────────────
function previewNextDates($repeatType, $repeatDay, $repeatInterval, $startDate, $count = 3) {
    $dates = [];
    $dt = $startDate ? new DateTimeImmutable($startDate) : new DateTimeImmutable();
    $interval = max(1, (int)$repeatInterval);

    for ($i = 1; $i <= $count; $i++) {
        $steps = $i * $interval;
        switch ($repeatType) {
            case 'monthly':
                $y = (int)$dt->format('Y');
                $m = (int)$dt->format('n') + $steps;
                $ty = $y + (int)floor(($m - 1) / 12);
                $tm = (($m - 1) % 12) + 1;
                $day = $repeatDay ?: (int)$dt->format('j');
                $last = cal_days_in_month(CAL_GREGORIAN, $tm, $ty);
                $dates[] = sprintf('%04d-%02d-%02d', $ty, $tm, min($day, $last));
                break;
            case 'weekly':
                $ts = $dt->modify('+' . ($steps * 7) . ' days');
                $dates[] = $ts->format('Y-m-d');
                break;
            case 'yearly':
                $ty = (int)$dt->format('Y') + $steps;
                $tm = (int)$dt->format('n');
                $td = (int)$dt->format('j');
                $last = cal_days_in_month(CAL_GREGORIAN, $tm, $ty);
                $dates[] = sprintf('%04d-%02d-%02d', $ty, $tm, min($td, $last));
                break;
            default: // daily
                $ts = $dt->modify('+' . $steps . ' days');
                $dates[] = $ts->format('Y-m-d');
        }
    }
    return $dates;
}

$catIcons = [
    'utilities'    => '⚡',
    'electronic'   => '💻',
    'water'        => '💧',
    'phone'        => '📱',
    'trash'        => '🗑',
    'tax'          => '📋',
    'insurance'    => '🛡️',
    'rent'         => '🏠',
    'payroll'      => '💼',
    'subscription' => '🔄',
    'supplies'     => '📦',
    'maintenance'  => '🔧',
    'banking'      => '🏦',
    'general'      => '📌',
];
$repeatLabels = [
    'monthly' => 'Monthly',
    'weekly'  => 'Weekly',
    'yearly'  => 'Yearly',
    'daily'   => 'Daily',
];
?>
<style>
/* ═══════════════════════════════════════════════════════
   BILL TEMPLATES — Split-Panel Layout
   ═══════════════════════════════════════════════════════ */
.tpl-wrap {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 20px;
    height: calc(100vh - 120px);
    overflow: hidden;
}
@media(max-width:900px) { .tpl-wrap { grid-template-columns:1fr; height:auto; overflow:auto; } }

/* Left panel */
.tpl-left {
    display: flex;
    flex-direction: column;
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 16px;
    overflow: hidden;
}
.tpl-left-header {
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
    flex-shrink: 0;
}
.tpl-left-header h2 {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 4px;
}
.tpl-left-header p { font-size: 12px; color: var(--text-muted,#94A3B8); margin: 0; }
.tpl-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.tpl-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    cursor: pointer;
    transition: .15s;
    border-left: 3px solid transparent;
    text-decoration: none;
    color: inherit;
}
.tpl-row:hover { background: rgba(255,255,255,.04); }
.tpl-row.active { background: rgba(59,130,246,.08); border-left-color: #3B82F6; }
.tpl-row-icon {
    width: 38px; height: 38px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
    background: rgba(255,255,255,.06);
}
.tpl-row-info { flex: 1; min-width: 0; }
.tpl-row-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tpl-row-meta  { font-size: 12px; color: var(--text-muted,#94A3B8); margin-top: 2px; }
.tpl-row-right { text-align: right; flex-shrink: 0; }
.tpl-row-amount { font-size: 14px; font-weight: 700; }
.tpl-row-recur  { font-size: 11px; color: var(--text-muted,#94A3B8); }

/* Right panel */
.tpl-right {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    padding-right: 4px;
}

/* Summary strip */
.tpl-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}
@media(max-width:640px) { .tpl-summary { grid-template-columns: 1fr 1fr; } }
.tpl-sum-card {
    background: var(--surface,#1E293B);
    border: 1px solid var(--border,rgba(255,255,255,.08));
    border-radius: 12px;
    padding: 16px;
    text-align: center;
}
.tpl-sum-num { font-size: 28px; font-weight: 800; }
.tpl-sum-lbl { font-size: 11px; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .07em; margin-top: 2px; }

/* Create form card */
.tpl-form-card {
    background: var(--surface,#1E293B);
    border: 1px solid var(--border,rgba(255,255,255,.08));
    border-radius: 16px;
    padding: 24px;
}
.tpl-form-title {
    font-size: 16px; font-weight: 700; margin: 0 0 20px;
    display: flex; align-items: center; gap: 8px;
}
.tpl-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
}
@media(max-width:640px) { .tpl-form-grid { grid-template-columns: 1fr; } }
.tpl-fg-full { grid-column: 1 / -1; }

.tpl-label { font-size: 12px; font-weight: 600; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em; display: block; margin-bottom: 6px; }
.tpl-input {
    width: 100%; padding: 9px 12px;
    background: rgba(255,255,255,.05);
    border: 1px solid var(--border,rgba(255,255,255,.1));
    border-radius: 8px;
    color: var(--text,#F1F5F9);
    font-size: 14px;
    box-sizing: border-box;
    transition: border-color .15s;
}
.tpl-input:focus { outline: none; border-color: #3B82F6; }
.tpl-input option { background: #1E293B; }

/* Recurrence preview */
.tpl-preview {
    background: rgba(59,130,246,.06);
    border: 1px solid rgba(59,130,246,.2);
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 13px;
}
.tpl-preview-label { font-weight: 700; color: #93C5FD; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
.tpl-preview-dates { display: flex; gap: 8px; flex-wrap: wrap; }
.tpl-preview-date {
    background: rgba(59,130,246,.15); color: #BFDBFE;
    padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;
}

/* Status chip */
.tpl-status {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px;
}
.ts-pending  { background: rgba(245,158,11,.15); color: #FCD34D; }
.ts-active   { background: rgba(34,197,94,.15);  color: #86EFAC; }
.ts-overdue  { background: rgba(220,38,38,.15);  color: #FCA5A5; }

/* Detail panel */
.tpl-detail-card {
    background: var(--surface,#1E293B);
    border: 1px solid var(--border,rgba(255,255,255,.08));
    border-radius: 16px;
    padding: 24px;
}
.tpl-detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px; }
.tpl-detail-title { font-size: 20px; font-weight: 800; margin: 0; }
.tpl-detail-sub   { font-size: 13px; color: var(--text-muted,#94A3B8); margin-top: 4px; }
.tpl-detail-meta  { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.tpl-detail-stat  { display: flex; flex-direction: column; align-items: center; background: rgba(255,255,255,.04); border-radius: 10px; padding: 10px 16px; min-width: 90px; }
.tpl-detail-stat .val { font-size: 22px; font-weight: 800; }
.tpl-detail-stat .lbl { font-size: 10px; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
.tpl-cycle-list   { margin-top: 12px; }
.tpl-cycle-row    { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border,rgba(255,255,255,.06)); font-size: 13px; }
.tpl-cycle-row:last-child { border-bottom: none; }
.tpl-generate-form { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }

/* Buttons */
.btn-tpl {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
    border: none; cursor: pointer; text-decoration: none; transition: .15s;
}
.btn-tpl-primary { background: #2563EB; color: #fff; }
.btn-tpl-primary:hover { background: #1D4ED8; }
.btn-tpl-ghost { background: rgba(255,255,255,.06); color: var(--text,#F1F5F9); border: 1px solid var(--border,rgba(255,255,255,.1)); }
.btn-tpl-ghost:hover { background: rgba(255,255,255,.1); }
.btn-tpl-danger { background: rgba(220,38,38,.15); color: #FCA5A5; border: 1px solid rgba(220,38,38,.2); }
.btn-tpl-danger:hover { background: rgba(220,38,38,.25); }
</style>

<!-- Page Header -->
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
    <div>
        <h1 style="font-size:24px;font-weight:800;margin:0">🔄 Recurring Bill Templates</h1>
        <p style="font-size:13px;color:var(--text-muted);margin:4px 0 0">Master schedules that auto-generate monthly bill cycles</p>
    </div>
    <div style="display:flex;gap:10px">
        <a href="<?= APP_URL ?>/bills" class="btn-tpl btn-tpl-ghost">💳 Payment Schedule</a>
        <a href="<?= APP_URL ?>/ceo" class="btn-tpl btn-tpl-ghost">📊 CEO View</a>
    </div>
</div>

<div class="tpl-wrap">

    <!-- ── LEFT: Template List ── -->
    <div class="tpl-left">
        <div class="tpl-left-header">
            <h2>Templates <span style="font-size:12px;color:var(--text-muted);font-weight:400"><?= $totalTemplates ?> total</span></h2>
            <p>Click to view details · right panel to create</p>
        </div>
        <div class="tpl-list">
            <?php if (empty($templates)): ?>
            <div style="padding:32px 20px;text-align:center;color:var(--text-muted)">
                <div style="font-size:32px;margin-bottom:8px">🔄</div>
                <div style="font-size:14px">No recurring templates yet</div>
                <div style="font-size:12px;margin-top:4px">Create one using the form on the right</div>
            </div>
            <?php else: ?>
            <?php foreach ($templates as $tpl): ?>
            <?php
                $cat = $tpl['category'] ?? 'general';
                $icon = $catIcons[$cat] ?? '📌';
                $repeatType = $tpl['repeat_type'] ?? 'monthly';
                $repeatLabel = $repeatLabels[$repeatType] ?? ucfirst($repeatType);
                $intervalTxt = (int)($tpl['repeat_interval'] ?? 1) > 1 ? 'Every ' . $tpl['repeat_interval'] . ' ' . $repeatType . 's' : $repeatLabel;
                $isActive = isset($_GET['tpl']) && (int)$_GET['tpl'] === (int)$tpl['id'];
            ?>
            <a href="?tpl=<?= (int)$tpl['id'] ?>" class="tpl-row <?= $isActive ? 'active' : '' ?>">
                <div class="tpl-row-icon"><?= $icon ?></div>
                <div class="tpl-row-info">
                    <div class="tpl-row-title"><?= e($tpl['title']) ?></div>
                    <div class="tpl-row-meta">
                        <?= e($tpl['store_name']) ?>
                        <?php if (!empty($tpl['vendor_name'])): ?> · <?= e($tpl['vendor_name']) ?><?php endif; ?>
                    </div>
                </div>
                <div class="tpl-row-right">
                    <?php if ($tpl['amount']): ?>
                    <div class="tpl-row-amount">$<?= number_format((float)$tpl['amount']) ?></div>
                    <?php endif; ?>
                    <div class="tpl-row-recur"><?= e($intervalTxt) ?></div>
                </div>
            </a>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>

    <!-- ── RIGHT: Detail + Create ── -->
    <div class="tpl-right">

        <!-- Summary Strip -->
        <div class="tpl-summary">
            <div class="tpl-sum-card">
                <div class="tpl-sum-num" style="color:#3B82F6"><?= $totalTemplates ?></div>
                <div class="tpl-sum-lbl">Templates</div>
            </div>
            <div class="tpl-sum-card">
                <div class="tpl-sum-num" style="color:#22C55E"><?= $totalCycles ?></div>
                <div class="tpl-sum-lbl">Cycles Generated</div>
            </div>
            <div class="tpl-sum-card">
                <div class="tpl-sum-num" style="color:#F59E0B"><?= $activeTemplates ?></div>
                <div class="tpl-sum-lbl">Active</div>
            </div>
        </div>

        <?php
        // ── Show selected template detail ──
        $selectedId = (int)($_GET['tpl'] ?? 0);
        $selectedTpl = null;
        if ($selectedId) {
            foreach ($templates as $tpl) {
                if ((int)$tpl['id'] === $selectedId) { $selectedTpl = $tpl; break; }
            }
        }
        ?>

        <?php if ($selectedTpl): ?>
        <?php
        $cat    = $selectedTpl['category'] ?? 'general';
        $icon   = $catIcons[$cat] ?? '📌';
        $rt     = $selectedTpl['repeat_type'] ?? 'monthly';
        $ri     = (int)($selectedTpl['repeat_interval'] ?? 1);
        $rd     = (int)($selectedTpl['repeat_day'] ?? 0);
        $nextDates = previewNextDates($rt, $rd, $ri, $selectedTpl['due_date'] ?? date('Y-m-d'));
        $db = Database::getInstance();
        $cycles = $db->fetchAll(
            "SELECT id, due_date, status, amount, paid_at FROM bills
             WHERE repeat_parent_id = ?
             ORDER BY due_date DESC LIMIT 12",
            [$selectedTpl['id']]
        );
        $month = (int)date('m'); $year = (int)date('Y');
        ?>
        <div class="tpl-detail-card">
            <div class="tpl-detail-header">
                <div>
                    <div class="tpl-detail-title"><?= $icon ?> <?= e($selectedTpl['title']) ?></div>
                    <div class="tpl-detail-sub">
                        <?= e($selectedTpl['store_name']) ?>
                        <?php if (!empty($selectedTpl['business_name'])): ?> · <?= e($selectedTpl['business_name']) ?><?php endif; ?>
                        <?php if (!empty($selectedTpl['vendor_name'])): ?> · <?= e($selectedTpl['vendor_name']) ?><?php endif; ?>
                    </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <span class="tpl-status ts-<?= e($selectedTpl['status'] ?? 'pending') ?>"><?= ucfirst($selectedTpl['status'] ?? 'pending') ?></span>
                    <a href="<?= APP_URL ?>/bills/<?= (int)$selectedTpl['id'] ?>/edit" class="btn-tpl btn-tpl-ghost">✏️ Edit</a>
                </div>
            </div>

            <div class="tpl-detail-meta">
                <?php if ($selectedTpl['amount']): ?>
                <div class="tpl-detail-stat">
                    <div class="val" style="color:#22C55E">$<?= number_format((float)$selectedTpl['amount']) ?></div>
                    <div class="lbl">Amount</div>
                </div>
                <?php endif; ?>
                <div class="tpl-detail-stat">
                    <div class="val" style="color:#3B82F6"><?= (int)$selectedTpl['cycle_count'] ?></div>
                    <div class="lbl">Cycles</div>
                </div>
                <div class="tpl-detail-stat">
                    <div class="val"><?= $ri > 1 ? 'Every '.$ri : 'Every' ?></div>
                    <div class="lbl"><?= ucfirst($rt) ?></div>
                </div>
                <?php if ($rd): ?>
                <div class="tpl-detail-stat">
                    <div class="val">Day <?= $rd ?></div>
                    <div class="lbl">Due Rule</div>
                </div>
                <?php endif; ?>
                <?php if (!empty($selectedTpl['next_due'])): ?>
                <div class="tpl-detail-stat">
                    <div class="val" style="color:#F59E0B"><?= date('M j', strtotime($selectedTpl['next_due'])) ?></div>
                    <div class="lbl">Next Due</div>
                </div>
                <?php endif; ?>
            </div>

            <!-- Next occurrence preview -->
            <div class="tpl-preview" style="margin-bottom:20px">
                <div class="tpl-preview-label">Next 3 occurrences</div>
                <div class="tpl-preview-dates">
                    <?php foreach ($nextDates as $d): ?>
                    <span class="tpl-preview-date"><?= date('M j, Y', strtotime($d)) ?></span>
                    <?php endforeach; ?>
                </div>
                <div style="font-size:12px;color:#93C5FD;margin-top:8px">
                    <?= $ri > 1 ? "Every {$ri} {$rt}s" : "Every {$rt}" ?>
                    <?php if ($rd): ?>, on day <?= $rd ?><?php endif; ?>
                </div>
            </div>

            <!-- Generate cycles button -->
            <?php if (isAdmin() || isManager()): ?>
            <form method="POST" action="<?= APP_URL ?>/bills/templates/<?= (int)$selectedTpl['id'] ?>/generate"
                  class="tpl-generate-form" style="margin-bottom:20px">
                <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
                <div>
                    <label class="tpl-label">Month</label>
                    <select name="month" class="tpl-input" style="width:auto">
                        <?php for ($m=1;$m<=12;$m++): ?>
                        <option value="<?= $m ?>" <?= $m===$month?'selected':'' ?>><?= date('F', mktime(0,0,0,$m,1)) ?></option>
                        <?php endfor; ?>
                    </select>
                </div>
                <div>
                    <label class="tpl-label">Year</label>
                    <input type="number" name="year" class="tpl-input" value="<?= $year ?>" style="width:90px">
                </div>
                <button type="submit" class="btn-tpl btn-tpl-primary">⚡ Generate Cycles</button>
            </form>
            <?php endif; ?>

            <!-- Past cycles -->
            <?php if (!empty($cycles)): ?>
            <div>
                <div class="tpl-label" style="margin-bottom:8px">Generated Cycles (latest 12)</div>
                <div class="tpl-cycle-list">
                    <?php foreach ($cycles as $cy): ?>
                    <div class="tpl-cycle-row">
                        <span style="font-weight:600;min-width:90px"><?= date('M j, Y', strtotime($cy['due_date'])) ?></span>
                        <span class="tpl-status ts-<?= e($cy['status']) ?>"><?= ucfirst($cy['status']) ?></span>
                        <?php if ($cy['amount']): ?>
                        <span style="margin-left:auto;font-weight:700">$<?= number_format((float)$cy['amount']) ?></span>
                        <?php endif; ?>
                        <?php if ($cy['paid_at']): ?>
                        <span style="font-size:11px;color:#86EFAC">Paid <?= date('M j', strtotime($cy['paid_at'])) ?></span>
                        <?php endif; ?>
                        <a href="<?= APP_URL ?>/bills/<?= (int)$cy['id'] ?>" style="font-size:11px;color:#93C5FD;text-decoration:none">View →</a>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <!-- ── CREATE NEW TEMPLATE FORM ── -->
        <?php if (isAdmin() || isManager()): ?>
        <div class="tpl-form-card">
            <div class="tpl-form-title">➕ Create New Recurring Template</div>
            <form method="POST" action="<?= APP_URL ?>/bills/templates/create">
                <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">

                <div class="tpl-form-grid">
                    <div class="tpl-fg-full">
                        <label class="tpl-label">Template Name *</label>
                        <input type="text" name="title" class="tpl-input" placeholder="e.g. PG&E Electricity Bill" required>
                    </div>

                    <div>
                        <label class="tpl-label">Business / Store *</label>
                        <select name="store_id" class="tpl-input" required>
                            <option value="">— Select store —</option>
                            <?php foreach ($stores as $s): ?>
                            <option value="<?= (int)$s['id'] ?>"><?= e($s['name']) ?><?= !empty($s['business_name']) ? ' (' . e($s['business_name']) . ')' : '' ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div>
                        <label class="tpl-label">Vendor</label>
                        <select name="vendor_id" class="tpl-input" id="tpl-vendor-select">
                            <option value="">— Select vendor —</option>
                            <?php foreach ($vendors as $v): ?>
                            <option value="<?= (int)$v['id'] ?>"><?= e($v['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div>
                        <label class="tpl-label">Category</label>
                        <select name="category" class="tpl-input">
                            <?php foreach ($billCategories as $bc): ?>
                            <option value="<?= $bc ?>"><?= $catIcons[$bc] ?? '' ?> <?= ucfirst($bc) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div>
                        <label class="tpl-label">Estimated Amount ($)</label>
                        <input type="number" name="amount" class="tpl-input" placeholder="0.00" step="0.01" min="0">
                    </div>

                    <div>
                        <label class="tpl-label">Template Start Date</label>
                        <input type="date" name="due_date" class="tpl-input" value="<?= date('Y-m-d') ?>" id="tpl-start-date">
                    </div>

                    <div>
                        <label class="tpl-label">Repeat Every</label>
                        <select name="repeat_type" class="tpl-input" id="tpl-repeat-type" onchange="updatePreview()">
                            <?php foreach ($repeatTypes as $rt): ?>
                            <option value="<?= $rt ?>"><?= ucfirst($rt) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div>
                        <label class="tpl-label">Interval <span style="color:var(--text-muted)">(e.g. 1 = every month)</span></label>
                        <input type="number" name="repeat_interval" class="tpl-input" value="1" min="1" max="12" id="tpl-repeat-interval" onchange="updatePreview()">
                    </div>

                    <div>
                        <label class="tpl-label">Due Day of Month <span style="color:var(--text-muted)">(1–31, monthly only)</span></label>
                        <input type="number" name="repeat_day" class="tpl-input" placeholder="e.g. 20" min="1" max="31" id="tpl-repeat-day" onchange="updatePreview()">
                    </div>

                    <div class="tpl-fg-full">
                        <label class="tpl-label">Notes</label>
                        <textarea name="note" class="tpl-input" rows="2" placeholder="Login info, account details, contacts…"></textarea>
                    </div>

                    <!-- Live preview -->
                    <div class="tpl-fg-full">
                        <div class="tpl-preview" id="tpl-preview-box">
                            <div class="tpl-preview-label">Recurrence Preview</div>
                            <div class="tpl-preview-dates" id="tpl-preview-dates">
                                <span class="tpl-preview-date" id="tpl-preview-d0">—</span>
                                <span class="tpl-preview-date" id="tpl-preview-d1">—</span>
                                <span class="tpl-preview-date" id="tpl-preview-d2">—</span>
                            </div>
                            <div style="font-size:12px;color:#93C5FD;margin-top:8px" id="tpl-preview-desc">Select type and interval to see preview</div>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:10px;margin-top:20px">
                    <button type="submit" class="btn-tpl btn-tpl-primary">💾 Create Template</button>
                    <button type="reset" class="btn-tpl btn-tpl-ghost">↺ Reset</button>
                </div>
            </form>
        </div>
        <?php endif; ?>

        <!-- Help panel — what are templates? -->
        <div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);border-radius:12px;padding:16px 20px">
            <div style="font-size:13px;font-weight:700;color:#93C5FD;margin-bottom:8px">💡 How Templates Work</div>
            <div style="font-size:13px;color:var(--text-muted,#94A3B8);line-height:1.7">
                <b style="color:#F1F5F9">Templates</b> define the recurring schedule (e.g. "PG&E every month on day 20").<br>
                <b style="color:#F1F5F9">Bill Cycles</b> are the actual monthly instances generated from a template.<br>
                Each month, cycles are auto-generated when you visit the Payment Schedule or click "Generate Cycles".<br>
                Marking a cycle <b style="color:#86EFAC">Paid</b> records the payment without affecting future cycles.
            </div>
        </div>

    </div><!-- /.tpl-right -->
</div><!-- /.tpl-wrap -->

<script>
function updatePreview() {
    var type     = document.getElementById('tpl-repeat-type').value;
    var interval = parseInt(document.getElementById('tpl-repeat-interval').value) || 1;
    var day      = parseInt(document.getElementById('tpl-repeat-day').value) || 0;
    var startEl  = document.getElementById('tpl-start-date');
    var startStr = startEl ? startEl.value : '';

    var dt = startStr ? new Date(startStr) : new Date();
    if (isNaN(dt.getTime())) dt = new Date();

    var dates = [];
    for (var i = 1; i <= 3; i++) {
        var next = new Date(dt);
        var steps = i * interval;
        if (type === 'monthly') {
            var y = dt.getFullYear();
            var m = dt.getMonth() + steps;
            var ty = y + Math.floor(m / 12);
            var tm = m % 12;
            var d  = day || dt.getDate();
            var last = new Date(ty, tm + 1, 0).getDate();
            next = new Date(ty, tm, Math.min(d, last));
        } else if (type === 'weekly') {
            next = new Date(dt); next.setDate(dt.getDate() + steps * 7);
        } else if (type === 'yearly') {
            next = new Date(dt); next.setFullYear(dt.getFullYear() + steps);
        } else { // daily
            next = new Date(dt); next.setDate(dt.getDate() + steps);
        }
        dates.push(next);
    }

    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (var j = 0; j < 3; j++) {
        var el = document.getElementById('tpl-preview-d' + j);
        if (el && dates[j]) {
            el.textContent = months[dates[j].getMonth()] + ' ' + dates[j].getDate() + ', ' + dates[j].getFullYear();
        }
    }

    var typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    var desc = interval > 1 ? ('Every ' + interval + ' ' + type + 's') : ('Every ' + typeLabel);
    if (type === 'monthly' && day) desc += ', on day ' + day;
    document.getElementById('tpl-preview-desc').textContent = desc;
}

document.getElementById('tpl-start-date') && document.getElementById('tpl-start-date').addEventListener('change', updatePreview);
updatePreview();
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
