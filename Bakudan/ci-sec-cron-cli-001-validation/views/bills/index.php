<?php
/**
 * Financial Payment Calendar — /bills
 * Cross-business monthly calendar showing ALL recurring bill obligations.
 */
$pageTitle = 'Financial Calendar';
$currentPage = 'bills';

$today = date('Y-m-d');

// Category config: icon + label + color
$catConfig = [
    'utilities'    => ['icon' => '⚡', 'label' => 'Utilities',   'color' => '#00b4d8'],
    'electronic'   => ['icon' => '💻', 'label' => 'Electronic',  'color' => '#6366f1'],
    'water'        => ['icon' => '💧', 'label' => 'Water',       'color' => '#0ea5e9'],
    'phone'        => ['icon' => '📱', 'label' => 'Phone',       'color' => '#10b981'],
    'trash'        => ['icon' => '🗑', 'label' => 'Trash',       'color' => '#84cc16'],
    'tax'          => ['icon' => '📋', 'label' => 'Tax',         'color' => '#f4a261'],
    'insurance'    => ['icon' => '🛡',  'label' => 'Insurance',  'color' => '#7c3cff'],
    'rent'         => ['icon' => '🏠', 'label' => 'Rent',        'color' => '#1de9b6'],
    'payroll'      => ['icon' => '👥', 'label' => 'Payroll',     'color' => '#ff6b2b'],
    'subscription' => ['icon' => '🔄', 'label' => 'Subscription','color' => '#f59e0b'],
    'supplies'     => ['icon' => '📦', 'label' => 'Supplies',    'color' => '#78716c'],
    'maintenance'  => ['icon' => '🔧', 'label' => 'Maintenance', 'color' => '#ef4444'],
    'banking'      => ['icon' => '🏦', 'label' => 'Banking',     'color' => '#0f766e'],
    'general'      => ['icon' => '📌', 'label' => 'General',     'color' => '#888'],
];

// Sub-tab quick-filter categories (the highlighted ones from the spec)
$subTabCategories = ['tax', 'electronic', 'water', 'phone', 'trash', 'insurance', 'rent'];

// Status helper
function billStatusBadge($bill, $today) {
    if ($bill['status'] === 'paid') return ['class' => 'bc-paid',    'dot' => '🟢', 'label' => 'Paid'];
    $d = $bill['due_date'] ? substr($bill['due_date'], 0, 10) : '';
    if ($d && $d < $today)                                return ['class' => 'bc-overdue', 'dot' => '🔴', 'label' => 'Overdue'];
    $soon = date('Y-m-d', strtotime('+3 days'));
    if ($d && $d <= $soon)                                return ['class' => 'bc-soon',    'dot' => '🟡', 'label' => 'Due Soon'];
    return ['class' => 'bc-pending', 'dot' => '⚪', 'label' => 'Pending'];
}

function fmtAmt($v) {
    if (!$v || $v == 0) return '';
    return '$' . number_format((float)$v, 0, '.', ',');
}

function billCategoryKey($bill) {
    return $bill['display_category'] ?? $bill['category'] ?? $bill['finance_category'] ?? 'general';
}

// Calendar grid setup
$firstDay    = mktime(0, 0, 0, $month, 1, $year);
$daysInMonth = (int)date('t', $firstDay);
$startDow    = (int)date('N', $firstDay); // 1=Mon … 7=Sun

// Build current filter query string (for month nav links)
$filterQS = '';
if ($filterStore)    $filterQS .= '&store_id='    . (int)$filterStore;
if ($filterCategory) $filterQS .= '&category='    . urlencode($filterCategory);
if ($filterStatus)   $filterQS .= '&status='      . urlencode($filterStatus);
if ($filterVendorId) $filterQS .= '&vendor_id='   . (int)$filterVendorId;

ob_start();
?>

<!-- ══ Flash messages ══════════════════════════════════════════ -->
<?php if ($msg = flash('success')): ?>
<div class="alert alert-success"><?= e($msg) ?></div>
<?php endif; ?>
<?php if ($msg = flash('error')): ?>
<div class="alert alert-error"><?= e($msg) ?></div>
<?php endif; ?>

<!-- ══ PAGE HEADER ═════════════════════════════════════════════ -->
<div class="fc-header">
    <div class="fc-header-left">
        <h2 class="fc-title">💳 Payment Schedule</h2>
        <div class="fc-subtitle">All recurring obligations — every bill, every cycle, every business</div>
    </div>
    <div class="fc-header-right">
        <!-- Month navigation -->
        <div class="fc-month-nav">
            <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills?month=<?= $prevMonth ?>&year=<?= $prevYear ?><?= $filterQS ?>">‹</a>
            <span class="fc-month-label"><?= $monthNames[$month] ?> <?= $year ?></span>
            <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills?month=<?= $nextMonth ?>&year=<?= $nextYear ?><?= $filterQS ?>">›</a>
            <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills?month=<?= date('m') ?>&year=<?= date('Y') ?><?= $filterQS ?>" title="Go to today">Today</a>
        </div>
        <!-- View toggle -->
        <div class="fc-view-toggle">
            <button class="fc-toggle-btn active" id="btn-schedule" onclick="setView('schedule')">📋 Schedule</button>
            <button class="fc-toggle-btn" id="btn-calendar" onclick="setView('calendar')">📅 Calendar</button>
            <button class="fc-toggle-btn" id="btn-weekly"   onclick="setView('weekly')">≡ List</button>
        </div>
    </div>
</div>

<!-- ══ FILTER BAR ══════════════════════════════════════════════ -->
<form method="GET" action="<?= APP_URL ?>/bills" class="fc-filter-bar" id="filterForm">
    <input type="hidden" name="month" value="<?= $month ?>">
    <input type="hidden" name="year"  value="<?= $year ?>">

    <select name="store_id" class="fc-filter-select" onchange="this.form.submit()">
        <option value="">🏪 All Businesses</option>
        <?php foreach ($allStores as $s): ?>
        <option value="<?= $s['id'] ?>" <?= $filterStore == $s['id'] ? 'selected' : '' ?>>
            <?= e($s['name']) ?>
        </option>
        <?php endforeach; ?>
    </select>

    <select name="category" class="fc-filter-select" onchange="this.form.submit()">
        <option value="">🏷 All Categories</option>
        <?php foreach ($catConfig as $key => $cat): ?>
        <option value="<?= $key ?>" <?= $filterCategory === $key ? 'selected' : '' ?>>
            <?= $cat['icon'] ?> <?= $cat['label'] ?>
        </option>
        <?php endforeach; ?>
    </select>

    <select name="status" class="fc-filter-select" onchange="this.form.submit()">
        <option value="">📊 All Status</option>
        <option value="pending" <?= $filterStatus === 'pending' ? 'selected' : '' ?>>⚪ Pending</option>
        <option value="paid"    <?= $filterStatus === 'paid'    ? 'selected' : '' ?>>🟢 Paid</option>
        <option value="overdue" <?= $filterStatus === 'overdue' ? 'selected' : '' ?>>🔴 Overdue</option>
    </select>

    <select name="vendor_id" class="fc-filter-select" onchange="this.form.submit()">
        <option value="">🏢 All Vendors</option>
        <?php foreach ($allVendors as $v): ?>
        <option value="<?= $v['id'] ?>" <?= $filterVendorId == $v['id'] ? 'selected' : '' ?>>
            <?= e($v['name']) ?>
        </option>
        <?php endforeach; ?>
    </select>

    <?php if ($filterStore || $filterCategory || $filterStatus || $filterVendorId): ?>
    <a href="<?= APP_URL ?>/bills?month=<?= $month ?>&year=<?= $year ?>" class="btn btn-ghost btn-sm" style="white-space:nowrap">✕ Reset</a>
    <?php endif; ?>
</form>

<!-- ══ CATEGORY SUB-TABS ════════════════════════════════════════ -->
<div class="fc-subtabs" style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;background:var(--bg-card,#1a1a2e);border-bottom:1px solid var(--border,#2d2d3a);">
    <?php
    $baseQS = '?month=' . $month . '&year=' . $year;
    if ($filterStore)    $baseQS .= '&store_id='  . (int)$filterStore;
    if ($filterStatus)   $baseQS .= '&status='    . urlencode($filterStatus);
    if ($filterVendorId) $baseQS .= '&vendor_id=' . (int)$filterVendorId;
    foreach ($subTabCategories as $subKey):
        $cfg = $catConfig[$subKey] ?? ['icon'=>'🏷','label'=>ucfirst($subKey),'color'=>'#888'];
        $isActive = ($filterCategory === $subKey);
        $href = $isActive
            ? APP_URL . '/bills' . $baseQS
            : APP_URL . '/bills' . $baseQS . '&category=' . urlencode($subKey);
        $activeStyle = $isActive
            ? "background:{$cfg['color']};color:#fff;border-color:{$cfg['color']};"
            : "background:transparent;color:{$cfg['color']};border-color:{$cfg['color']}44;";
    ?>
    <a href="<?= $href ?>"
       class="fc-subtab-chip"
       style="<?= $activeStyle ?>display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1.5px solid;font-size:12px;font-weight:600;text-decoration:none;transition:all .15s;">
        <?= $cfg['icon'] ?> <?= $cfg['label'] ?><?= $isActive ? ' ✕' : '' ?>
    </a>
    <?php endforeach; ?>
    <a href="<?= APP_URL ?>/bills<?= $baseQS ?>" class="fc-subtab-chip"
       style="<?= !$filterCategory ? 'background:#374151;color:#e5e7eb;' : 'background:transparent;color:#9ca3af;' ?>display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1.5px solid #374151;font-size:12px;font-weight:600;text-decoration:none;transition:all .15s;">
        📋 All Categories
    </a>
</div>

<!-- ══ SUMMARY RIBBON ══════════════════════════════════════════ -->
<div class="fc-summary-ribbon">
    <div class="fc-stat fc-stat-total">
        <div class="fc-stat-num"><?= $summary['total_bills'] ?></div>
        <div class="fc-stat-lbl">Total Bills</div>
    </div>
    <div class="fc-stat fc-stat-overdue" <?= $summary['overdue_count'] > 0 ? 'style="border-color:#ff1744"' : '' ?>>
        <div class="fc-stat-num" style="color:<?= $summary['overdue_count'] > 0 ? '#ff1744' : 'inherit' ?>"><?= $summary['overdue_count'] ?></div>
        <div class="fc-stat-lbl">🔴 Overdue</div>
    </div>
    <div class="fc-stat fc-stat-week" <?= $summary['due_week_count'] > 0 ? 'style="border-color:#ffea00"' : '' ?>>
        <div class="fc-stat-num" style="color:<?= $summary['due_week_count'] > 0 ? '#ffea00' : 'inherit' ?>"><?= $summary['due_week_count'] ?></div>
        <div class="fc-stat-lbl">🟡 Due This Week</div>
    </div>
    <div class="fc-stat fc-stat-paid">
        <div class="fc-stat-num" style="color:#00e676"><?= $summary['paid_count'] ?></div>
        <div class="fc-stat-lbl">🟢 Paid</div>
    </div>
    <div class="fc-stat fc-stat-pending">
        <div class="fc-stat-num"><?= $summary['pending_count'] ?></div>
        <div class="fc-stat-lbl">⚪ Upcoming</div>
    </div>
    <?php if ($summary['unpaid_amount'] > 0): ?>
    <div class="fc-stat fc-stat-amount">
        <div class="fc-stat-num" style="color:#ff6b2b;font-size:16px"><?= fmtAmt($summary['unpaid_amount']) ?></div>
        <div class="fc-stat-lbl">Unpaid Total</div>
    </div>
    <?php endif; ?>
</div>

<!-- ══ MAIN BODY: Calendar + Sidebar ═══════════════════════════ -->
<div class="fc-body">

    <!-- ── LEFT: Calendar / Weekly view ─────────────────────── -->
    <div class="fc-main">

        <!-- ══ SCHEDULE VIEW (default) ══════════════════════════════ -->
        <?php
        $schOverdue  = [];
        $schToday    = [];
        $schWeek     = [];
        $schUpcoming = [];
        $schPaid     = [];
        $weekEnd     = date('Y-m-d', strtotime('+7 days'));
        foreach ($allBills as $b) {
            $d = !empty($b['due_date']) ? substr($b['due_date'],0,10) : '';
            if ($b['status'] === 'paid') { $schPaid[] = $b; continue; }
            if ($d && $d < $today)        $schOverdue[]  = $b;
            elseif ($d && $d === $today)  $schToday[]    = $b;
            elseif ($d && $d <= $weekEnd) $schWeek[]     = $b;
            else                          $schUpcoming[]  = $b;
        }
        $schSections = [];
        if ($schOverdue)  $schSections[] = ['key'=>'overdue', 'label'=>'🚨 Overdue',          'color'=>'#EF4444','bg'=>'rgba(239,68,68,.08)',   'items'=>$schOverdue];
        if ($schToday)    $schSections[] = ['key'=>'today',   'label'=>'📌 Due Today',         'color'=>'#F59E0B','bg'=>'rgba(245,158,11,.07)',  'items'=>$schToday];
        if ($schWeek)     $schSections[] = ['key'=>'week',    'label'=>'📅 Due This Week',     'color'=>'#8B5CF6','bg'=>'rgba(139,92,246,.06)',  'items'=>$schWeek];
        if ($schUpcoming) $schSections[] = ['key'=>'upcoming','label'=>'⚪ Upcoming',           'color'=>'#64748B','bg'=>'rgba(100,116,139,.05)', 'items'=>$schUpcoming];
        if ($schPaid)     $schSections[] = ['key'=>'paid',    'label'=>'✅ Paid This Month',   'color'=>'#22C55E','bg'=>'rgba(34,197,94,.05)',   'items'=>$schPaid];
        ?>
        <div id="view-schedule">
            <?php if (empty($allBills)): ?>
            <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
                <div style="font-size:48px;margin-bottom:16px">🎉</div>
                <div style="font-size:18px;font-weight:700;margin-bottom:8px">No bills this month</div>
                <div style="font-size:13px">All obligations for <?= $monthNames[$month] ?> <?= $year ?> are clear.</div>
            </div>
            <?php endif; ?>
            <?php foreach ($schSections as $sec): ?>
            <div class="sch-section" style="margin-bottom:20px">
                <div class="sch-section-header" style="border-left:3px solid <?= $sec['color'] ?>">
                    <span class="sch-section-title"><?= $sec['label'] ?></span>
                    <span class="sch-section-count" style="color:<?= $sec['color'] ?>"><?= count($sec['items']) ?></span>
                    <?php
                    $secAmt = array_sum(array_column($sec['items'], 'amount'));
                    if ($secAmt > 0): ?>
                    <span class="sch-section-amt" style="color:<?= $sec['color'] ?>">$<?= number_format($secAmt, 0) ?></span>
                    <?php endif; ?>
                </div>
                <div class="sch-rows" style="background:<?= $sec['bg'] ?>;border-radius:12px;overflow:hidden">
                    <?php foreach ($sec['items'] as $bill):
                        $daysLate = ($sec['key'] === 'overdue' && $bill['due_date'])
                            ? max(0,(int)((strtotime($today)-strtotime(substr($bill['due_date'],0,10)))/86400)) : 0;
                        $catCfg  = $catConfig[billCategoryKey($bill)] ?? ['icon'=>'📌','label'=>'General','color'=>'#888'];
                        $billIp  = IconPresenter::forBill($bill);
                        $billSt  = StatePresenter::forBill($bill);
                    ?>
                    <div class="sch-bill-row" onclick="openBillModal(<?= (int)$bill['id'] ?>)"
                         style="<?= $billSt['border_style'] ?><?= $billSt['row_bg'] ?>">
                        <div class="sch-bill-cat" title="<?= e($catCfg['label']) ?>" style="color:<?= $catCfg['color'] ?>"><?= $catCfg['icon'] ?></div>
                        <div class="sch-bill-body">
                            <div class="sch-bill-title"><?= e($bill['title']) ?></div>
                            <div class="sch-bill-meta">
                                <?php if (!empty($bill['store_name'])): ?>
                                <span>🏪 <?= e($bill['store_name']) ?></span>
                                <?php endif; ?>
                                <?php if (!empty($bill['vendor_label'])): ?>
                                <span>· <?= e($bill['vendor_label']) ?></span>
                                <?php endif; ?>
                                <?php if ($bill['due_date']): ?>
                                <span style="color:<?= $sec['color'] ?>">
                                    · <?= date('M j', strtotime($bill['due_date'])) ?>
                                    <?= $daysLate > 0 ? ' <strong style="color:#EF4444">(' . $daysLate . 'd late)</strong>' : '' ?>
                                </span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php if (!empty($bill['amount']) && $bill['amount'] > 0): ?>
                        <div class="sch-bill-amount" style="color:<?= $sec['key']==='paid' ? '#22C55E' : $sec['color'] ?>">
                            $<?= number_format((float)$bill['amount'], 0) ?>
                        </div>
                        <?php endif; ?>
                        <?php if ($sec['key'] !== 'paid'): ?>
                        <button onclick="event.stopPropagation();billPayAjax(<?= (int)$bill['id'] ?>, this)"
                                data-title="<?= e(htmlspecialchars($bill['title'])) ?>"
                                data-amount="<?= (float)($bill['amount'] ?? 0) ?>"
                                class="sch-pay-btn">✓ Pay</button>
                        <?php else: ?>
                        <span class="sch-paid-badge">✓ Paid</span>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div><!-- #view-schedule -->

        <!-- CALENDAR VIEW -->
        <div id="view-calendar" style="display:none">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 2px">
                <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills?month=<?= $prevMonth ?>&year=<?= $prevYear ?><?= $filterQS ?>">‹ <?= $monthNames[$prevMonth] ?></a>
                <span style="font-weight:700;font-size:16px"><?= $monthNames[$month] ?> <?= $year ?></span>
                <a class="btn btn-ghost btn-sm" href="<?= APP_URL ?>/bills?month=<?= $nextMonth ?>&year=<?= $nextYear ?><?= $filterQS ?>"><?= $monthNames[$nextMonth] ?> ›</a>
            </div>
            <div class="fc-grid">
                <!-- Day headers -->
                <?php foreach (['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as $dh): ?>
                <div class="fc-dow"><?= $dh ?></div>
                <?php endforeach; ?>

                <!-- Leading empty cells -->
                <?php for ($i = 1; $i < $startDow; $i++): ?>
                <div class="fc-cell fc-cell-empty"></div>
                <?php endfor; ?>

                <!-- Day cells -->
                <?php for ($day = 1; $day <= $daysInMonth; $day++):
                    $dateStr  = sprintf('%04d-%02d-%02d', $year, $month, $day);
                    $dayBills = $billsByDate[$dateStr] ?? [];
                    $isToday  = ($dateStr === $today);
                    $isPast   = ($dateStr < $today);
                    $cellClass = 'fc-cell';
                    if ($isToday) $cellClass .= ' fc-cell-today';
                    elseif ($isPast) $cellClass .= ' fc-cell-past';

                    // Determine urgency for cell background tint
                    $hasOverdue = false; $hasSoon = false;
                    foreach ($dayBills as $b) {
                        if ($b['status'] !== 'paid' && $b['due_date'] && substr($b['due_date'],0,10) < $today) $hasOverdue = true;
                        elseif ($b['status'] !== 'paid') $hasSoon = true;
                    }
                    if ($hasOverdue) $cellClass .= ' fc-cell-has-overdue';
                    elseif ($hasSoon && $dateStr <= date('Y-m-d', strtotime('+3 days'))) $cellClass .= ' fc-cell-has-soon';
                ?>
                <div class="<?= $cellClass ?>" data-date="<?= $dateStr ?>">
                    <div class="fc-day-num <?= $isToday ? 'fc-today-num' : '' ?>">
                        <?= $day ?>
                        <?php if (count($dayBills) > 0): ?>
                        <span class="fc-day-count"><?= count($dayBills) ?></span>
                        <?php endif; ?>
                    </div>

                    <?php
                    $visible = array_slice($dayBills, 0, 3);
                    $overflow = count($dayBills) - count($visible);
                    foreach ($visible as $b):
                        $st   = billStatusBadge($b, $today);
                        $cat  = billCategoryKey($b);
                        $ci   = $catConfig[$cat] ?? $catConfig['general'];
                        $sc   = $b['store_color'] ?: '#888';
                        $lbl  = $b['vendor_label'] ?: $b['title'];
                        $lbl  = mb_strimwidth($lbl, 0, 22, '…');
                    ?>
                    <div class="fc-bill-chip <?= $st['class'] ?>" onclick="openBillModal(<?= $b['id'] ?>, event)"
                         title="<?= e($b['title']) . ' — ' . e($b['store_name'] ?? '') ?>">
                        <span class="fc-chip-cat" style="color:<?= $ci['color'] ?>"><?= $ci['icon'] ?></span>
                        <span class="fc-chip-label"><?= e($lbl) ?></span>
                        <span class="fc-chip-biz" style="background:<?= e($sc) ?>20;color:<?= e($sc) ?>">
                            <?= e(mb_strimwidth($b['store_name'] ?? '', 0, 8, '…')) ?>
                        </span>
                        <?php if ($b['amount'] > 0): ?>
                        <span class="fc-chip-amt"><?= fmtAmt($b['amount']) ?></span>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>

                    <?php if ($overflow > 0): ?>
                    <div class="fc-overflow" onclick="showDayPanel('<?= $dateStr ?>')">+<?= $overflow ?> more</div>
                    <?php endif; ?>
                </div>
                <?php endfor; ?>

                <!-- Trailing empty cells to complete last row -->
                <?php
                $totalCells = $startDow - 1 + $daysInMonth;
                $trailing = (7 - ($totalCells % 7)) % 7;
                for ($i = 0; $i < $trailing; $i++): ?>
                <div class="fc-cell fc-cell-empty"></div>
                <?php endfor; ?>
            </div><!-- .fc-grid -->
        </div><!-- #view-calendar -->

        <!-- WEEKLY LIST VIEW -->
        <div id="view-weekly" style="display:none">
            <?php
            // Group bills by week + day
            for ($day = 1; $day <= $daysInMonth; $day++):
                $dateStr  = sprintf('%04d-%02d-%02d', $year, $month, $day);
                $dayBills = $billsByDate[$dateStr] ?? [];
                if (empty($dayBills)) continue;
                $dow      = date('l', strtotime($dateStr));
                $isToday  = ($dateStr === $today);
                $isPast   = ($dateStr < $today);
            ?>
            <div class="fc-week-day <?= $isToday ? 'fc-week-today' : ($isPast ? 'fc-week-past' : '') ?>">
                <div class="fc-week-date-header">
                    <span class="fc-week-dow"><?= $dow ?></span>
                    <span class="fc-week-date"><?= date('M j', strtotime($dateStr)) ?></span>
                    <?php if ($isToday): ?><span class="badge" style="background:var(--accent);color:#000;font-size:10px;padding:1px 6px">TODAY</span><?php endif; ?>
                    <span class="fc-week-count"><?= count($dayBills) ?> bill<?= count($dayBills) > 1 ? 's' : '' ?></span>
                </div>
                <?php foreach ($dayBills as $b):
                    $st  = billStatusBadge($b, $today);
                    $cat = billCategoryKey($b);
                    $ci  = $catConfig[$cat] ?? $catConfig['general'];
                    $sc  = $b['store_color'] ?: '#888';
                ?>
                <div class="fc-week-row <?= $st['class'] ?>">
                    <div class="fc-week-row-left">
                        <span class="fc-week-cat" title="<?= $ci['label'] ?>" style="color:<?= $ci['color'] ?>"><?= $ci['icon'] ?></span>
                        <div class="fc-week-info">
                            <div class="fc-week-title"><?= e($b['title']) ?></div>
                            <div class="fc-week-meta">
                                <?php if ($b['vendor_label']): ?>
                                <span style="color:var(--text-muted)"><?= e($b['vendor_label']) ?></span>
                                <?php endif; ?>
                                <span class="fc-week-biz-badge" style="background:<?= e($sc) ?>20;color:<?= e($sc) ?>">
                                    <?= e($b['store_name'] ?? '—') ?>
                                </span>
                                <?php if ($b['repeat_type'] && $b['repeat_type'] !== 'none'): ?>
                                <span style="color:var(--text-muted);font-size:10px">🔄 Recurring</span>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                    <div class="fc-week-row-right">
                        <?php if ($b['amount'] > 0): ?>
                        <span class="fc-week-amt"><?= fmtAmt($b['amount']) ?></span>
                        <?php endif; ?>
                        <span class="fc-status-dot <?= $st['class'] ?>"><?= $st['dot'] ?> <?= $st['label'] ?></span>
                        <?php if ($b['status'] !== 'paid'): ?>
                        <a class="btn btn-sm" href="<?= APP_URL ?>/bills/<?= $b['id'] ?>/paid"
                           onclick="return confirm('Mark as Paid?')"
                           style="background:var(--success,#00e676);color:#000;font-size:11px;padding:3px 10px">
                            ✓ Pay
                        </a>
                        <?php else: ?>
                        <span style="color:#00e676;font-size:12px">✓ Paid</span>
                        <?php endif; ?>
                        <button class="btn-ghost btn-sm" onclick="openBillModal(<?= $b['id'] ?>, event)" title="Edit" style="font-size:14px;padding:3px 8px">✏️</button>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endfor; ?>

            <?php if (empty($allBills)): ?>
            <div class="empty-state" style="padding:60px 0">
                <div class="icon">💳</div>
                <h3>No bills this month</h3>
                <p class="text-muted">Add recurring bills to your stores to see them here.</p>
            </div>
            <?php endif; ?>
        </div><!-- #view-weekly -->

</div><!-- .fc-main -->

    <div class="fc-sidebar-resizer" id="fcSidebarResizer" title="Drag to resize side panels" aria-hidden="true"></div>

    <!-- ── RIGHT: Sidebar ────────────────────────────────────── -->
    <div class="fc-sidebar" id="fcAdjustableSidebar">

        <!-- Upcoming Bills panel -->
        <div class="card mb-3 fc-side-panel" data-fc-panel="next7" draggable="true">
            <div class="card-header fc-panel-header">
                <h3 style="font-size:13px;margin:0">⏰ Next 7 Days</h3>
                <div class="fc-panel-actions">
                    <span class="text-muted text-sm"><?= count($upcomingBills) ?> due</span>
                    <button type="button" class="fc-panel-btn" data-fc-move="up" title="Move up">↑</button>
                    <button type="button" class="fc-panel-btn" data-fc-move="down" title="Move down">↓</button>
                    <button type="button" class="fc-panel-btn" data-fc-collapse title="Collapse">−</button>
                </div>
            </div>
            <div class="card-body" style="padding:0">
                <?php if (empty($upcomingBills)): ?>
                <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Nothing due this week 🎉</div>
                <?php else: ?>
                <?php foreach ($upcomingBills as $b):
                    $daysUntil = (int)((strtotime(substr($b['due_date'],0,10)) - strtotime($today)) / 86400);
                    $sc = $b['store_color'] ?: '#888';
                    $cat = billCategoryKey($b);
                    $ci = $catConfig[$cat] ?? $catConfig['general'];
                    if ($daysUntil < 0)       $urgencyStyle = 'color:#ff1744';
                    elseif ($daysUntil === 0)  $urgencyStyle = 'color:#ff2bd6';
                    elseif ($daysUntil <= 2)   $urgencyStyle = 'color:#ffea00';
                    else                        $urgencyStyle = 'color:var(--text-muted)';
                ?>
                <div class="fc-upcoming-row">
                    <span class="fc-upcoming-cat" style="color:<?= $ci['color'] ?>"><?= $ci['icon'] ?></span>
                    <div class="fc-upcoming-info">
                        <div class="fc-upcoming-title"><?= e(mb_strimwidth($b['title'], 0, 26, '…')) ?></div>
                        <div class="fc-upcoming-biz" style="color:<?= e($sc) ?>"><?= e($b['store_name'] ?? '—') ?></div>
                    </div>
                    <div class="fc-upcoming-right">
                        <?php if ($b['amount'] > 0): ?><div style="font-size:11px;font-weight:700"><?= fmtAmt($b['amount']) ?></div><?php endif; ?>
                        <div style="font-size:10px;<?= $urgencyStyle ?>">
                            <?php
                            if ($daysUntil < 0)      echo abs($daysUntil) . 'd late';
                            elseif ($daysUntil === 0) echo 'Due today';
                            else                      echo 'In ' . $daysUntil . 'd';
                            ?>
                        </div>
                    </div>
                    <?php if ($b['status'] !== 'paid'): ?>
                    <a href="<?= APP_URL ?>/bills/<?= $b['id'] ?>/paid"
                       onclick="return confirm('Mark as Paid?')"
                       class="fc-pay-btn" title="Mark paid">✓</a>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <!-- Business breakdown -->
        <?php if (!empty($storeStats)): ?>
        <div class="card mb-3 fc-side-panel" data-fc-panel="business" draggable="true">
            <div class="card-header fc-panel-header">
                <h3 style="font-size:13px;margin:0">🏪 By Business</h3>
                <div class="fc-panel-actions">
                    <span class="text-muted text-sm"><?= $monthNames[$month] ?></span>
                    <button type="button" class="fc-panel-btn" data-fc-move="up" title="Move up">↑</button>
                    <button type="button" class="fc-panel-btn" data-fc-move="down" title="Move down">↓</button>
                    <button type="button" class="fc-panel-btn" data-fc-collapse title="Collapse">−</button>
                </div>
            </div>
            <div class="card-body" style="padding:0">
                <?php foreach ($storeStats as $stat): ?>
                <a class="fc-store-row" href="<?= APP_URL ?>/bills/store/<?= $stat['id'] ?>?month=<?= $month ?>&year=<?= $year ?>">
                    <span class="store-dot" style="background:<?= e($stat['color'] ?: '#888') ?>"></span>
                    <span class="fc-store-name"><?= e($stat['name'] ?? '—') ?></span>
                    <div class="fc-store-badges">
                        <?php if ($stat['overdue'] > 0): ?>
                        <span class="badge-overdue" style="font-size:10px"><?= $stat['overdue'] ?> late</span>
                        <?php endif; ?>
                        <span class="badge" style="background:var(--bg-tertiary);color:var(--text-muted);font-size:10px"><?= $stat['total'] ?></span>
                        <?php if ($stat['paid'] > 0): ?>
                        <span style="font-size:10px;color:#00e676"><?= $stat['paid'] ?>✓</span>
                        <?php endif; ?>
                    </div>
                </a>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <!-- Category breakdown -->
        <?php
        $catTotals = [];
        foreach ($allBills as $b) {
            $cat = billCategoryKey($b);
            if (!isset($catTotals[$cat])) $catTotals[$cat] = ['total' => 0, 'paid' => 0, 'amount' => 0];
            $catTotals[$cat]['total']++;
            if ($b['status'] === 'paid') $catTotals[$cat]['paid']++;
            $catTotals[$cat]['amount'] += (float)($b['amount'] ?? 0);
        }
        arsort($catTotals);
        ?>
        <?php if (!empty($catTotals)): ?>
        <div class="card mb-3">
            <div class="card-header">
                <h3 style="font-size:13px;margin:0">🏷 By Category</h3>
            </div>
            <div class="card-body" style="padding:8px 12px">
                <?php foreach ($catTotals as $catKey => $ct):
                    $ci = $catConfig[$catKey] ?? $catConfig['general'];
                    $pct = $ct['total'] > 0 ? round($ct['paid'] / $ct['total'] * 100) : 0;
                ?>
                <div class="fc-cat-row">
                    <span style="color:<?= $ci['color'] ?>;font-size:14px"><?= $ci['icon'] ?></span>
                    <span class="fc-cat-label"><?= $ci['label'] ?></span>
                    <div class="fc-cat-bar-wrap">
                        <div class="fc-cat-bar" style="width:<?= $pct ?>%;background:<?= $ci['color'] ?>"></div>
                    </div>
                    <span class="fc-cat-pct" style="color:<?= $ci['color'] ?>"><?= $pct ?>%</span>
                    <?php if ($ct['amount'] > 0): ?>
                    <span class="fc-cat-amt"><?= fmtAmt($ct['amount']) ?></span>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <!-- Manage Stores link -->
        <div class="card">
            <div class="card-header">
                <h3 style="font-size:13px;margin:0">🏪 Manage Stores</h3>
            </div>
            <div class="card-body" style="padding:10px 14px">
                <?php foreach ($stores as $s):
                    $bc = $billCountMap[$s['id']] ?? null;
                    $unpaid = $bc ? (int)$bc['unpaid'] : 0;
                ?>
                <div class="fc-manage-store-row">
                    <span class="store-dot" style="background:<?= e($s['color'] ?: 'var(--neon-cyan)') ?>"></span>
                    <a href="<?= APP_URL ?>/bills/store/<?= $s['id'] ?>" class="fc-manage-store-name"><?= e($s['name']) ?></a>
                    <?php if ($unpaid > 0): ?>
                    <span class="badge-overdue" style="font-size:10px"><?= $unpaid ?> unpaid</span>
                    <?php endif; ?>
                    <div style="display:flex;gap:4px;margin-left:auto">
                        <button class="btn-ghost btn-sm" onclick="openStoreEditModal(<?= $s['id'] ?>, <?= e(json_encode($s['name'])) ?>, <?= e(json_encode($s['address'] ?? '')) ?>, <?= e(json_encode($s['color'] ?? '')) ?>)" style="font-size:12px;padding:2px 6px" title="Edit">✏️</button>
                        <a class="btn-ghost btn-sm" href="<?= APP_URL ?>/bills/store/<?= $s['id'] ?>/delete" onclick="return confirm('Delete store?')" style="font-size:12px;padding:2px 6px;color:var(--neon-pink)" title="Delete">🗑</a>
                    </div>
                </div>
                <?php endforeach; ?>
                <hr style="border-color:var(--border);margin:10px 0">
                <form method="POST" action="<?= APP_URL ?>/bills/store/create">
                    <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                    <div style="display:flex;gap:6px">
                        <input class="form-control" name="name" placeholder="New store name…" style="font-size:12px;padding:5px 10px" required>
                        <button class="btn btn-primary btn-sm" type="submit" style="white-space:nowrap;font-size:12px">+ Add</button>
                    </div>
                </form>
            </div>
        </div>

    </div><!-- .fc-sidebar -->
</div><!-- .fc-body -->

<!-- ══ DAY DRILL-DOWN PANEL ════════════════════════════════════ -->
<div class="fc-day-panel" id="fcDayPanel" style="display:none">
    <div class="fc-day-panel-header">
        <span id="fcDayPanelDate"></span>
        <button class="btn-ghost" onclick="closeDayPanel()" style="font-size:18px;padding:4px 8px">✕</button>
    </div>
    <div id="fcDayPanelBody"></div>
</div>

<!-- ══ BILL DETAIL / EDIT MODAL ════════════════════════════════ -->
<!-- Reuse the same edit modal from store.php, but in minimal form -->
<div class="modal-overlay" id="billViewModal" style="display:none" onclick="if(event.target===this)closeBillModal()">
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
        <div class="modal-header">
            <h3 id="billViewTitle">Bill Details</h3>
            <button class="btn-ghost" onclick="closeBillModal()" style="font-size:18px">✕</button>
        </div>
        <div id="billViewBody" style="padding:22px">
            <div style="text-align:center;padding:30px;color:var(--text-muted)">Loading…</div>
        </div>
    </div>
</div>

<!-- Store Edit Modal (kept for inline store management) -->
<div class="modal-overlay" id="storeEditModal" style="display:none" onclick="if(event.target===this)this.style.display='none'">
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;width:100%;max-width:440px;box-shadow:var(--shadow-lg)">
        <div class="modal-header">
            <h3>Edit Store</h3>
            <button class="btn-ghost" onclick="document.getElementById('storeEditModal').style.display='none'" style="font-size:18px">✕</button>
        </div>
        <form method="POST" id="storeEditForm">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div style="padding:22px">
                <div class="form-group"><label>Store Name</label><input class="form-control" name="name" id="store-edit-name" required></div>
                <div class="form-group"><label>Address</label><input class="form-control" name="address" id="store-edit-address"></div>
                <div class="form-group"><label>Color</label><input class="form-control" name="color" id="store-edit-color" placeholder="#00f5ff"></div>
            </div>
            <div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('storeEditModal').style.display='none'">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    </div>
</div>

<!-- ══ STYLES ═══════════════════════════════════════════════════ -->
<style>
/* ── Layout ─────────────────────────────────────── */
.fc-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; flex-wrap:wrap; }
.fc-header-left .fc-title   { margin:0; font-size:20px; font-weight:800; }
.fc-header-left .fc-subtitle { color:var(--text-muted); font-size:12px; margin-top:2px; }
.fc-header-right { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.fc-month-nav { display:flex; align-items:center; gap:6px; }
.fc-month-label { font-weight:700; font-size:15px; min-width:120px; text-align:center; }
.fc-view-toggle { display:flex; border:1px solid var(--border); border-radius:8px; overflow:hidden; }
.fc-toggle-btn  { background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:5px 12px; font-size:12px; transition:all .15s; }
.fc-toggle-btn.active { background:var(--accent,#dc2626); color:#fff; font-weight:600; }

/* ── Schedule View ───────────────────────────────── */
.sch-section-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; margin-bottom: 6px;
    border-left: 3px solid #888;
}
.sch-section-title { font-size: 13px; font-weight: 700; flex: 1; }
.sch-section-count { font-size: 13px; font-weight: 800; min-width: 24px; text-align:right; }
.sch-section-amt   { font-size: 12px; font-weight: 700; }

.sch-bill-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,.05);
    cursor: pointer; transition: background .12s;
}
.sch-bill-row:last-child { border-bottom: none; }
.sch-bill-row:hover { background: rgba(255,255,255,.05); }
.sch-bill-cat   { font-size: 18px; flex-shrink: 0; width: 22px; text-align: center; }
.sch-bill-body  { flex: 1; min-width: 0; }
.sch-bill-title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sch-bill-meta  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.sch-bill-amount { font-size: 14px; font-weight: 800; flex-shrink: 0; min-width: 60px; text-align: right; }
.sch-pay-btn {
    display: inline-flex; align-items: center;
    padding: 5px 14px; border-radius: 8px; font-size: 11px; font-weight: 700;
    background: rgba(37,99,235,.15); color: #60A5FA;
    border: 1px solid rgba(37,99,235,.25); text-decoration: none;
    white-space: nowrap; flex-shrink: 0; transition: .12s;
}
.sch-pay-btn:hover { background: rgba(37,99,235,.28); color: #93C5FD; }
.sch-paid-badge {
    font-size: 11px; font-weight: 700; color: #86EFAC;
    padding: 5px 10px; border-radius: 8px;
    background: rgba(34,197,94,.12); white-space: nowrap; flex-shrink: 0;
}
@media(max-width:600px) {
    .sch-bill-amount { display: none; }
    .sch-pay-btn, .sch-paid-badge { padding: 4px 8px; font-size: 10px; }
}

/* ── Filter bar ──────────────────────────────────── */
.fc-filter-bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
.fc-filter-select { background:var(--bg-secondary); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer; }
.fc-filter-select:focus { outline:none; border-color:var(--accent); }

/* ── Summary ribbon ──────────────────────────────── */
.fc-summary-ribbon { display:flex; gap:10px; flex-wrap:nowrap; margin-bottom:16px; overflow-x:auto; padding-bottom:4px; }
.fc-stat { background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; padding:10px 16px; min-width:90px; flex:1; text-align:center; transition:border-color .2s; }
.fc-stat-num { font-size:22px; font-weight:800; line-height:1.1; }
.fc-stat-lbl { font-size:10px; color:var(--text-muted); margin-top:2px; white-space:nowrap; }

/* ── Body layout ─────────────────────────────────── */
.fc-body { display:grid; grid-template-columns:minmax(0,1fr) 8px var(--fc-sidebar-w, 280px); gap:12px; align-items:start; }
@media (max-width: 900px) { .fc-body { grid-template-columns:1fr; } .fc-sidebar-resizer { display:none; } }
.fc-sidebar { display:flex; flex-direction:column; gap:0; }
.fc-sidebar-resizer {
    align-self: stretch;
    width: 8px;
    min-height: 220px;
    border-radius: 999px;
    cursor: col-resize;
    background: linear-gradient(90deg, transparent 2px, rgba(96,165,250,.35) 3px, rgba(96,165,250,.35) 5px, transparent 6px);
    opacity: .45;
}
.fc-sidebar-resizer:hover,
.fc-sidebar-resizer.is-dragging { opacity: 1; background: linear-gradient(90deg, transparent 2px, rgba(96,165,250,.8) 3px, rgba(96,165,250,.8) 5px, transparent 6px); }
.fc-side-panel { overflow:hidden; }
.fc-side-panel[draggable="true"] .fc-panel-header { cursor: grab; }
.fc-side-panel.fc-panel-collapsed .card-body { display:none; }
.fc-panel-header { gap:8px; }
.fc-panel-actions { display:flex; align-items:center; gap:5px; margin-left:auto; }
.fc-panel-btn {
    width:22px;
    height:22px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    border:1px solid rgba(148,163,184,.24);
    border-radius:6px;
    background:rgba(15,23,42,.45);
    color:#9ca3af;
    font-size:12px;
    font-weight:800;
    line-height:1;
    cursor:pointer;
}
.fc-panel-btn:hover { border-color:rgba(96,165,250,.45); color:#bfdbfe; background:rgba(96,165,250,.12); }

/* ── Calendar grid ───────────────────────────────── */
.fc-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; background:var(--border); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
.fc-dow  { background:var(--bg-secondary); text-align:center; font-size:11px; font-weight:700; color:var(--text-muted); padding:6px 2px; text-transform:uppercase; letter-spacing:.5px; }
.fc-cell { background:var(--bg-primary); min-height:90px; padding:4px; display:flex; flex-direction:column; gap:2px; position:relative; }
.fc-cell-empty { background:var(--bg-secondary); opacity:.4; }
.fc-cell-past  { background:var(--bg-primary); opacity:.85; }
.fc-cell-today { background:color-mix(in srgb, var(--accent,#dc2626) 8%, var(--bg-primary)); }
.fc-cell-has-overdue { border-top:2px solid #ff1744 !important; }
.fc-cell-has-soon    { border-top:2px solid #ffea00 !important; }
.fc-day-num  { font-size:11px; font-weight:600; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; padding:0 2px; }
.fc-today-num { background:var(--accent,#dc2626); color:#fff; border-radius:99px; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; }
.fc-day-count { background:var(--bg-tertiary); color:var(--text-muted); font-size:9px; border-radius:99px; padding:0 5px; }

/* ── Bill chips ──────────────────────────────────── */
.fc-bill-chip { display:flex; align-items:center; gap:3px; font-size:10px; border-radius:4px; padding:2px 4px; cursor:pointer; transition:opacity .15s; white-space:nowrap; overflow:hidden; }
.fc-bill-chip:hover { opacity:.8; }
.bc-paid    { background:#00e67614; border-left:2px solid #00e676; }
.bc-overdue { background:#ff174414; border-left:2px solid #ff1744; }
.bc-soon    { background:#ffea0014; border-left:2px solid #ffea00; }
.bc-pending { background:var(--bg-secondary); border-left:2px solid var(--border); }
.fc-chip-cat   { font-size:10px; flex-shrink:0; }
.fc-chip-label { overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }
.fc-chip-biz   { font-size:9px; border-radius:3px; padding:0 3px; flex-shrink:0; }
.fc-chip-amt   { font-size:9px; color:var(--text-muted); flex-shrink:0; }
.fc-overflow   { font-size:10px; color:var(--accent); cursor:pointer; padding:1px 4px; text-align:right; }
.fc-overflow:hover { text-decoration:underline; }

/* ── Weekly list view ────────────────────────────── */
.fc-week-day { border-bottom:1px solid var(--border); padding:10px 0; }
.fc-week-date-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; padding:0 2px; }
.fc-week-dow  { font-weight:700; font-size:13px; min-width:80px; }
.fc-week-date { color:var(--text-muted); font-size:12px; }
.fc-week-count { color:var(--text-muted); font-size:11px; margin-left:auto; }
.fc-week-today .fc-week-dow { color:var(--accent,#dc2626); }
.fc-week-past { opacity:.75; }
.fc-week-row  { display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:8px; margin-bottom:4px; background:var(--bg-secondary); }
.fc-week-row:hover { background:var(--bg-tertiary); }
.fc-week-cat  { font-size:16px; flex-shrink:0; }
.fc-week-info { flex:1; min-width:0; }
.fc-week-title { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fc-week-meta  { display:flex; align-items:center; gap:8px; margin-top:2px; font-size:11px; flex-wrap:wrap; }
.fc-week-biz-badge { border-radius:4px; padding:1px 6px; font-size:10px; }
.fc-week-row-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.fc-week-amt  { font-weight:700; font-size:13px; }
.fc-status-dot { font-size:11px; white-space:nowrap; }

/* ── Upcoming panel ──────────────────────────────── */
.fc-upcoming-row { display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid var(--border); }
.fc-upcoming-row:last-child { border-bottom:none; }
.fc-upcoming-cat  { font-size:15px; flex-shrink:0; }
.fc-upcoming-info { flex:1; min-width:0; }
.fc-upcoming-title { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fc-upcoming-biz   { font-size:10px; }
.fc-upcoming-right { text-align:right; flex-shrink:0; }
.fc-pay-btn { background:#00e676; color:#000; border:none; border-radius:99px; width:22px; height:22px; cursor:pointer; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-decoration:none; }
.fc-pay-btn:hover { background:#00c853; }

/* ── Store breakdown ─────────────────────────────── */
.fc-store-row { display:flex; align-items:center; gap:8px; padding:7px 14px; border-bottom:1px solid var(--border); text-decoration:none; color:var(--text); transition:background .15s; }
.fc-store-row:last-child { border-bottom:none; }
.fc-store-row:hover { background:var(--bg-tertiary); }
.fc-store-name { flex:1; font-size:12px; font-weight:600; }
.fc-store-badges { display:flex; gap:4px; align-items:center; }

/* ── Category rows ───────────────────────────────── */
.fc-cat-row { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
.fc-cat-label { font-size:11px; min-width:60px; }
.fc-cat-bar-wrap { flex:1; height:4px; background:var(--bg-tertiary); border-radius:99px; overflow:hidden; }
.fc-cat-bar { height:100%; border-radius:99px; transition:width .4s; }
.fc-cat-pct  { font-size:10px; min-width:28px; text-align:right; }
.fc-cat-amt  { font-size:10px; color:var(--text-muted); min-width:50px; text-align:right; }

/* ── Manage stores ───────────────────────────────── */
.fc-manage-store-row { display:flex; align-items:center; gap:6px; padding:4px 0; font-size:12px; }
.fc-manage-store-name { flex:1; color:var(--text); text-decoration:none; font-weight:500; }
.fc-manage-store-name:hover { color:var(--accent); }

/* ── Day panel ───────────────────────────────────── */
.fc-day-panel { position:fixed; right:20px; bottom:20px; width:320px; max-height:440px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:14px; box-shadow:var(--shadow-lg); overflow:hidden; z-index:200; }
.fc-day-panel-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border); font-weight:700; font-size:13px; }
</style>

<!-- ══ SCRIPTS ══════════════════════════════════════════════════ -->
<script>
// ── View toggle ──────────────────────────────────────────────
function setView(v) {
    document.getElementById('view-schedule').style.display = v === 'schedule' ? '' : 'none';
    document.getElementById('view-calendar').style.display = v === 'calendar' ? '' : 'none';
    document.getElementById('view-weekly').style.display   = v === 'weekly'   ? '' : 'none';
    document.getElementById('btn-schedule').classList.toggle('active', v === 'schedule');
    document.getElementById('btn-calendar').classList.toggle('active', v === 'calendar');
    document.getElementById('btn-weekly').classList.toggle('active',   v === 'weekly');
    localStorage.setItem('fcView', v);
}
// Restore last view — default to 'schedule' if never set
(function(){ var v = localStorage.getItem('fcView') || 'schedule'; setView(v); })();

// ── Store edit modal ─────────────────────────────────────────
function openStoreEditModal(id, name, address, color) {
    document.getElementById('storeEditForm').action = '<?= APP_URL ?>/bills/store/' + id + '/update';
    document.getElementById('store-edit-name').value    = name    || '';
    document.getElementById('store-edit-address').value = address || '';
    document.getElementById('store-edit-color').value   = color   || '';
    document.getElementById('storeEditModal').style.display = 'flex';
}

// ── Bill detail modal ────────────────────────────────────────
function openBillModal(billId, evt) {
    if (evt) evt.stopPropagation();
    if (window.DetailDrawer && typeof window.DetailDrawer.open === 'function') {
        window.DetailDrawer.open('<?= APP_URL ?>/bills/' + billId, { title: 'Bill Details' });
        return;
    }

    var modal = document.getElementById('billViewModal');
    var body  = document.getElementById('billViewBody');
    body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Loading…</div>';
    modal.style.display = 'flex';

    // Redirect to store view for that bill's month — simple drill-down
    // We encode enough context to open the per-store view
    fetch('<?= APP_URL ?>/api/bills/' + billId + '/detail')
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(data) {
            if (!data || !data.bill) {
                body.innerHTML = buildBillDetailHtml(null, billId);
                return;
            }
            body.innerHTML = buildBillDetailHtml(data.bill, billId);
        })
        .catch(function(){ body.innerHTML = buildBillDetailHtml(null, billId); });
}

function buildBillDetailHtml(bill, billId) {
    if (!bill) {
        return '<div style="text-align:center">' +
            '<p style="color:var(--text-muted);font-size:13px">Open the store view to edit this bill.</p>' +
            '<a href="<?= APP_URL ?>/bills" class="btn btn-ghost btn-sm">← Back to Calendar</a>' +
            '</div>';
    }
    var catIcons = {utilities:'⚡',utility:'⚡',electronic:'💻',water:'💧',phone:'📱',trash:'🗑',tax:'📋',insurance:'🛡',rent:'🏠',payroll:'👥',general:'📌'};
    var ci = catIcons[bill.category] || '📌';
    var cats = Array.isArray(bill.categories) && bill.categories.length ? bill.categories : (bill.category ? [bill.category] : []);
    var statusColor = bill.status === 'paid' ? '#00e676' : (bill.is_overdue ? '#ff1744' : '#ffea00');
    var html = '<div style="display:flex;flex-direction:column;gap:12px">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<span style="font-size:24px">' + ci + '</span>';
    html += '<div><div style="font-weight:700;font-size:16px">' + escHtml(bill.title) + '</div>';
    if (bill.vendor_label) html += '<div style="color:var(--text-muted);font-size:12px">' + escHtml(bill.vendor_label) + '</div>';
    html += '</div>';
    html += '<span style="margin-left:auto;font-size:13px;color:' + statusColor + '">' + (bill.status === 'paid' ? '✓ Paid' : (bill.is_overdue ? '🔴 Overdue' : '⏳ Pending')) + '</span>';
    html += '</div>';
    if (bill.store_name) html += '<div><span class="text-muted" style="font-size:11px">Business</span><div style="font-weight:600;font-size:13px">' + escHtml(bill.store_name) + '</div></div>';
    if (cats.length) html += '<div><span class="text-muted" style="font-size:11px">Category</span><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' + cats.map(function(c){ return '<span style="display:inline-flex;padding:3px 8px;border-radius:7px;background:#2563eb26;color:#93c5fd;border:1px solid #2563eb66;font-size:11px;font-weight:800">' + escHtml(c.replace(/_/g, ' ')) + '</span>'; }).join('') + '</div></div>';
    if (bill.due_date)   html += '<div><span class="text-muted" style="font-size:11px">Due Date</span><div style="font-weight:600;font-size:13px">' + bill.due_date + '</div></div>';
    if (bill.amount > 0) html += '<div><span class="text-muted" style="font-size:11px">Amount</span><div style="font-weight:700;font-size:18px">$' + Number(bill.amount).toLocaleString() + '</div></div>';
    if (bill.repeat_type && bill.repeat_type !== 'none') html += '<div style="background:var(--bg-tertiary);border-radius:8px;padding:8px 12px;font-size:12px">🔄 Recurring · ' + escHtml(bill.repeat_type) + '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">';
    if (bill.status !== 'paid') {
        html += '<a href="<?= APP_URL ?>/bills/' + billId + '/paid" onclick="return confirm(\'Mark as Paid?\')" class="btn btn-primary btn-sm">✓ Mark Paid</a>';
    }
    html += '<a href="<?= APP_URL ?>/bills/store/' + bill.store_id + '?month=' + bill.due_month + '&year=' + bill.due_year + '" class="btn btn-ghost btn-sm">Open Store View →</a>';
    html += '</div>';
    html += '</div>';
    return html;
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function closeBillModal() {
    document.getElementById('billViewModal').style.display = 'none';
}

// ── Day drill-down panel ─────────────────────────────────────
function showDayPanel(dateStr) {
    var panel = document.getElementById('fcDayPanel');
    document.getElementById('fcDayPanelDate').textContent = dateStr;
    var cell = document.querySelector('.fc-cell[data-date="' + dateStr + '"]');
    var html = '';
    if (cell) {
        var chips = cell.querySelectorAll('.fc-bill-chip');
        chips.forEach(function(chip) { html += '<div style="padding:6px 14px;border-bottom:1px solid var(--border)">' + chip.outerHTML + '</div>'; });
        var overflow = cell.querySelector('.fc-overflow');
        if (overflow) html = cell.innerHTML;
    }
    document.getElementById('fcDayPanelBody').innerHTML = html || '<div style="padding:14px;color:var(--text-muted)">No bills</div>';
    panel.style.display = '';
}
function closeDayPanel() { document.getElementById('fcDayPanel').style.display = 'none'; }

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeBillModal(); closeDayPanel(); document.getElementById('storeEditModal').style.display = 'none'; }
});

// ── AJAX Bill Pay — no reload ────────────────────────────────────────────────
function billPayAjax(billId, btn) {
    var title = btn.dataset.title || 'this bill';
    if (!confirm('Mark "' + title + '" as paid?')) return;

    btn.textContent = '⏳…';
    btn.disabled = true;

    fetch('<?= APP_URL ?>/api/bills/' + billId + '/pay', {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': '<?= csrf_token() ?>'
        }
    })
    .then(function(r){ return r.json(); })
    .then(function(d) {
        if (!d.ok) { btn.textContent = '✓ Pay'; btn.disabled = false; return; }

        // Animate row out
        var row = btn.closest('.sch-bill-row');
        if (row) {
            row.style.transition = 'opacity .25s, max-height .3s';
            row.style.opacity = '0';
            row.style.maxHeight = '0';
            row.style.overflow = 'hidden';
            setTimeout(function(){ row.remove(); }, 300);
        }

        // Update section count
        var section = btn.closest('.sch-section');
        if (section) {
            var countEl = section.querySelector('.sch-section-count');
            if (countEl) {
                var cur = parseInt(countEl.textContent) || 0;
                countEl.textContent = Math.max(0, cur - 1);
            }
        }

        // Update summary ribbon
        if (d.summary) {
            var elOverdue = document.querySelector('.fc-stat-overdue .fc-stat-num');
            var elPaid    = document.querySelector('.fc-stat-paid .fc-stat-num');
            if (elOverdue) elOverdue.textContent = d.summary.overdue_count || 0;
            if (elPaid)    elPaid.textContent    = d.summary.paid_count   || 0;
        }

        // Show a brief toast
        showToast('✅ ' + escHtml(title) + ' marked as paid');
    })
    .catch(function() { btn.textContent = '✓ Pay'; btn.disabled = false; });
}

// Simple toast notification
function showToast(msg) {
    var t = document.createElement('div');
    t.innerHTML = msg;
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1e293b;border:1px solid rgba(34,197,94,.3);color:#86efac;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.4);transition:opacity .3s';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; setTimeout(function(){ t.remove(); },300); }, 2500);
}

// ── Adjustable right panels ────────────────────────────────────────────────
(function initFcAdjustableSidebar() {
    var body = document.querySelector('.fc-body');
    var sidebar = document.getElementById('fcAdjustableSidebar');
    var resizer = document.getElementById('fcSidebarResizer');
    if (!body || !sidebar) return;

    var widthKey = 'fcSidebarWidth';
    var orderKey = 'fcSidebarOrder';
    var collapsedKey = 'fcSidebarCollapsed';

    function clampWidth(value) {
        return Math.max(240, Math.min(460, value));
    }
    var savedWidth = parseInt(localStorage.getItem(widthKey) || '', 10);
    if (savedWidth) body.style.setProperty('--fc-sidebar-w', clampWidth(savedWidth) + 'px');

    function panels() {
        return Array.prototype.slice.call(sidebar.querySelectorAll('[data-fc-panel]'));
    }
    function saveOrder() {
        localStorage.setItem(orderKey, panels().map(function(p){ return p.dataset.fcPanel; }).join(','));
    }
    function applyOrder() {
        var order = (localStorage.getItem(orderKey) || '').split(',').filter(Boolean);
        order.forEach(function(id) {
            var panel = sidebar.querySelector('[data-fc-panel="' + id + '"]');
            if (panel) sidebar.appendChild(panel);
        });
    }
    function saveCollapsed() {
        var collapsed = panels().filter(function(p){ return p.classList.contains('fc-panel-collapsed'); }).map(function(p){ return p.dataset.fcPanel; });
        localStorage.setItem(collapsedKey, collapsed.join(','));
    }
    function applyCollapsed() {
        var collapsed = (localStorage.getItem(collapsedKey) || '').split(',');
        panels().forEach(function(panel) {
            if (collapsed.indexOf(panel.dataset.fcPanel) !== -1) {
                panel.classList.add('fc-panel-collapsed');
                var btn = panel.querySelector('[data-fc-collapse]');
                if (btn) btn.textContent = '+';
            }
        });
    }

    applyOrder();
    applyCollapsed();

    sidebar.addEventListener('click', function(e) {
        var move = e.target.closest('[data-fc-move]');
        var collapse = e.target.closest('[data-fc-collapse]');
        if (!move && !collapse) return;
        e.preventDefault();
        e.stopPropagation();
        var panel = e.target.closest('[data-fc-panel]');
        if (!panel) return;
        if (move) {
            if (move.dataset.fcMove === 'up' && panel.previousElementSibling) {
                sidebar.insertBefore(panel, panel.previousElementSibling);
            } else if (move.dataset.fcMove === 'down' && panel.nextElementSibling) {
                sidebar.insertBefore(panel.nextElementSibling, panel);
            }
            saveOrder();
        }
        if (collapse) {
            panel.classList.toggle('fc-panel-collapsed');
            collapse.textContent = panel.classList.contains('fc-panel-collapsed') ? '+' : '−';
            saveCollapsed();
        }
    });

    var dragPanel = null;
    sidebar.addEventListener('dragstart', function(e) {
        var panel = e.target.closest('[data-fc-panel]');
        if (!panel || e.target.closest('button,a,input,select,textarea')) return;
        dragPanel = panel;
        e.dataTransfer.effectAllowed = 'move';
        panel.style.opacity = '.55';
    });
    sidebar.addEventListener('dragend', function() {
        if (dragPanel) dragPanel.style.opacity = '';
        dragPanel = null;
        saveOrder();
    });
    sidebar.addEventListener('dragover', function(e) {
        if (!dragPanel) return;
        e.preventDefault();
        var target = e.target.closest('[data-fc-panel]');
        if (!target || target === dragPanel) return;
        var rect = target.getBoundingClientRect();
        var after = e.clientY > rect.top + rect.height / 2;
        sidebar.insertBefore(dragPanel, after ? target.nextSibling : target);
    });

    if (resizer) {
        resizer.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            resizer.setPointerCapture(e.pointerId);
            resizer.classList.add('is-dragging');
            function move(ev) {
                var rect = body.getBoundingClientRect();
                var nextWidth = clampWidth(rect.right - ev.clientX);
                body.style.setProperty('--fc-sidebar-w', nextWidth + 'px');
                localStorage.setItem(widthKey, String(nextWidth));
            }
            function up(ev) {
                resizer.classList.remove('is-dragging');
                resizer.releasePointerCapture(ev.pointerId);
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
            }
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        });
    }
})();
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
