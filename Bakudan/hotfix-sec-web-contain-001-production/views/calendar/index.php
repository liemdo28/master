<?php
$calendarOwner = currentUser();
$calendarOwnerName = trim((string)($calendarOwner['name'] ?? ''));
$pageTitle = canAdmin() ? 'Admin Calendar' : 'My Calendar';
$currentPage = 'calendar';

// Calendar logic
$month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
$year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

// Normalize
if ($month < 1) { $month = 12; $year--; }
if ($month > 12) { $month = 1; $year++; }

$prevMonth = $month - 1; $prevYear = $year;
if ($prevMonth < 1) { $prevMonth = 12; $prevYear--; }
$nextMonth = $month + 1; $nextYear = $year;
if ($nextMonth > 12) { $nextMonth = 1; $nextYear++; }

$firstDay = mktime(0, 0, 0, $month, 1, $year);
$daysInMonth = date('t', $firstDay);
$startDow = (date('N', $firstDay)); // 1=Monday
$today = app_today();

// Fetch tasks for this month
$taskModel = new Task();
$monthStart = app_month_start($year, $month)->format('Y-m-d');
$monthEnd = app_month_end($year, $month)->format('Y-m-d');
$calTasks = $taskModel->getCalendarTasksForUser($_SESSION['user_id'], $monthStart, $monthEnd);

// Group tasks by date
$tasksByDate = [];
foreach ($calTasks as $t) {
    $tasksByDate[$t['due_date']][] = $t;
}

$monthNames = explode(',', t('bills.month_names'));
$dayNames = [t('calendar.dow_mon'),t('calendar.dow_tue'),t('calendar.dow_wed'),t('calendar.dow_thu'),t('calendar.dow_fri'),t('calendar.dow_sat'),t('calendar.dow_sun')];
$priColors = ['urgent'=>'#dc2626','high'=>'#f59e0b','medium'=>'#3b82f6','low'=>'#71717a'];

// Due date color coding
$twoDays = date('Y-m-d', strtotime('+2 days'));

function normalizeCalendarHex($hex) {
    // FIX: Handle null/undefined project_color safely
    if ($hex === null || $hex === '') return null;
    $hex = trim((string)$hex);
    if ($hex === '') return null;
    // Only call substr() if string is long enough
    if (strlen($hex) > 0 && $hex[0] === '#') $hex = substr($hex, 1);
    if (strlen($hex) === 3) {
        $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
    }
    return preg_match('/^[0-9a-fA-F]{6}$/', $hex) ? strtolower($hex) : null;
}

function calendarTaskTextColor($hex) {
    $normalized = normalizeCalendarHex($hex);
    if (!$normalized) return '#f8fafc';

    $r = hexdec(substr($normalized, 0, 2));
    $g = hexdec(substr($normalized, 2, 2));
    $b = hexdec(substr($normalized, 4, 2));
    $luminance = (0.299 * $r + 0.587 * $g + 0.114 * $b) / 255;

    return $luminance > 0.68 ? '#050816' : '#f8fafc';
}

function calendarTaskBorderColor($textColor) {
    return $textColor === '#050816' ? 'rgba(5, 8, 22, .18)' : 'rgba(248, 250, 252, .18)';
}

ob_start();
?>

<div class="calendar-wrap">
    <div class="calendar-header">
        <div class="calendar-nav">
            <a href="<?= APP_URL ?>/calendar?month=<?= $prevMonth ?>&year=<?= $prevYear ?>" class="btn btn-secondary btn-sm">‹</a>
        </div>
        <h3>
            <?= e($pageTitle) ?>
            <span class="calendar-subtitle"><?= e($monthNames[$month] ?? ('Tháng ' . $month)) ?> <?= $year ?><?= $calendarOwnerName ? ' · ' . e($calendarOwnerName) : '' ?></span>
        </h3>
        <div class="calendar-nav" style="gap:6px">
            <input type="month" class="form-control" style="max-width:170px" value="<?= sprintf('%04d-%02d', $year, $month) ?>" onchange="jumpCalendarMonth(this.value)">
            <a href="<?= APP_URL ?>/calendar?month=<?= (int)date('m') ?>&year=<?= (int)date('Y') ?>" class="btn btn-sm btn-outline"><?= e(t('common.today')) ?></a>
            <a href="<?= APP_URL ?>/calendar?month=<?= $nextMonth ?>&year=<?= $nextYear ?>" class="btn btn-secondary btn-sm">›</a>
        </div>
    </div>

    <div class="calendar-grid">
        <?php foreach ($dayNames as $dn): ?>
            <div class="calendar-day-header"><?= $dn ?></div>
        <?php endforeach; ?>

        <?php
        // Previous month padding
        $prevMonthDays = date('t', mktime(0,0,0,$month-1,1,$year));
        for ($i = $startDow - 1; $i > 0; $i--):
            $d = $prevMonthDays - $i + 1;
        ?>
            <div class="calendar-cell other"><div class="day-num"><?= $d ?></div></div>
        <?php endfor; ?>

        <?php
        // Current month days
        for ($d = 1; $d <= $daysInMonth; $d++):
            $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $d);
            $isToday = ($dateStr === $today);
            $dayTasks = $tasksByDate[$dateStr] ?? [];
        ?>
            <div class="calendar-cell day-clickable <?= $isToday ? 'today' : '' ?> <?= !empty($dayTasks) ? 'has-events' : '' ?>" data-date="<?= $dateStr ?>" onclick="openCalendarDayDetail('<?= $dateStr ?>')">
                <div class="calendar-day-meta">
                    <div class="day-num"><?= $d ?></div>
                    <?php if (!empty($dayTasks)): ?>
                        <span class="calendar-count"><?= count($dayTasks) ?></span>
                    <?php endif; ?>
                </div>
                <?php foreach (array_slice($dayTasks, 0, 3) as $t):
                    $isOverdueCal = !empty($t['due_date']) && $t['due_date'] < $today && empty($t['is_completed']);
                    $isTodayCal = !empty($t['due_date']) && $t['due_date'] === $today && empty($t['is_completed']);
                    $isSoonCal = !empty($t['due_date']) && $t['due_date'] > $today && $t['due_date'] <= $twoDays && empty($t['is_completed']);

                    if ($isOverdueCal) { $urgencyClass = 'task-overdue'; $color = '#991b1b'; $textColor = '#fef2f2'; $borderColor = 'rgba(220,38,38,.4)'; }
                    elseif ($isTodayCal) { $urgencyClass = 'task-today'; $color = '#9a3412'; $textColor = '#fff7ed'; $borderColor = 'rgba(234,88,12,.5)'; }
                    elseif ($isSoonCal) { $urgencyClass = 'task-soon'; $color = '#78350f'; $textColor = '#fef3c7'; $borderColor = 'rgba(245,158,11,.4)'; }
                    elseif ($t['is_completed']) { $urgencyClass = 'completed'; $color = '#166534'; $textColor = '#bbf7d0'; $borderColor = 'rgba(255,255,255,.12)'; }
                    else { $urgencyClass = ''; $color = $t['project_color'] ?? ($priColors[$t['priority']] ?? '#3b82f6'); $textColor = calendarTaskTextColor($color); $borderColor = calendarTaskBorderColor($textColor); }
                ?>
                    <a
                        class="calendar-task <?= $urgencyClass ?>"
                        href="<?= APP_URL ?>/tasks/<?= $t['id'] ?>"
                        onclick="event.preventDefault();event.stopPropagation();openTaskPreview(<?= $t['id'] ?>)"
                        style="<?= !$urgencyClass ? "background:".e($color).";" : "" ?>color:<?= e($textColor) ?>;border-color:<?= e($borderColor) ?>"
                        title="<?= e($t['title']) ?> • <?= e($t['project_name'] ?? 'Task') ?>"
                    >
                        <?= $t['is_completed'] ? '✓ ' : ($isOverdueCal ? '! ' : '') ?><?= e(mb_substr($t['title'], 0, 18)) ?>
                    </a>
                <?php endforeach; ?>
                <?php if (count($dayTasks) > 3): ?>
                    <div class="calendar-more" onclick="event.stopPropagation();openCalendarDayDetail('<?= $dateStr ?>')"><?= e(t('calendar.more', ['count' => count($dayTasks) - 3])) ?></div>
                <?php endif; ?>
            </div>
        <?php endfor; ?>

        <?php
        // Next month padding
        $totalCells = $startDow - 1 + $daysInMonth;
        $remaining = (7 - ($totalCells % 7)) % 7;
        for ($i = 1; $i <= $remaining; $i++):
        ?>
            <div class="calendar-cell other"><div class="day-num"><?= $i ?></div></div>
        <?php endfor; ?>
    </div>
</div>

<div class="calendar-legend">
    <span><?= e(t('calendar.total_in_month', ['count' => count($calTasks)])) ?></span>
    <div class="calendar-legend-item"><span class="legend-dot legend-overdue"></span><?= e(t('calendar.priority_overdue')) ?></div>
    <div class="calendar-legend-item"><span class="legend-dot legend-today"></span><?= e(t('calendar.priority_today')) ?></div>
    <div class="calendar-legend-item"><span class="legend-dot legend-soon"></span><?= e(t('calendar.priority_soon')) ?></div>
    <div class="calendar-legend-item"><span class="legend-dot legend-completed"></span><?= e(t('calendar.completed')) ?></div>
</div>

<script>
// Calendar month picker jump — preserved helper
function jumpCalendarMonth(value) {
    if (!value) return;
    const [yearValue, monthValue] = value.split('-');
    window.location.href = `<?= APP_URL ?>/calendar?month=${Number(monthValue)}&year=${yearValue}`;
}
// Calendar cells call openCalendarDayDetail(date) — delegate to TaskDrawer
function openCalendarDayDetail(dateKey) { window.TaskDrawer && window.TaskDrawer.open(dateKey); }
function openTaskPreview(taskId) { window.location.href = `<?= APP_URL ?>/tasks/${taskId}`; }
</script>

<?php
// Include TaskDrawer professional drawer (CSS + JS)
$extraCss = array_merge($extraCss ?? [], ['task-drawer.css']);
$extraJs  = array_merge($extraJs ?? [], ['task-drawer.js']);
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
