<?php
$today = DateService::today();
$firstDay = date('N', strtotime($startDate));
$daysInMonth = (int)date('t', strtotime($startDate));
$dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

$eventsByDate = [];
$counts = ['all' => count($events), 'task' => 0, 'bill' => 0, 'release' => 0, 'checklist' => 0, 'overdue' => 0, 'done' => 0];
foreach ($events as $ev) {
    $eventsByDate[$ev['date']][] = $ev;
    $type = $ev['type'] ?? 'task';
    if (isset($counts[$type])) {
        $counts[$type]++;
    }
    $status = strtolower($ev['status'] ?? '');
    if (in_array($status, ['done', 'completed', 'paid'], true)) {
        $counts['done']++;
    } elseif (!empty($ev['date']) && $ev['date'] < $today) {
        $counts['overdue']++;
    }
}

$baseQuery = ['store_id' => $selectedStoreId, 'type' => $selectedType];
$prevQuery = array_merge($baseQuery, [
    'month' => $month == 1 ? 12 : $month - 1,
    'year' => $month == 1 ? $year - 1 : $year,
]);
$nextQuery = array_merge($baseQuery, [
    'month' => $month == 12 ? 1 : $month + 1,
    'year' => $month == 12 ? $year + 1 : $year,
]);
?>

<style>
  .cc-page { max-width: 1500px; margin: 0 auto; padding: 28px; color: #e5eefc; }
  .cc-header { border: 1px solid #29486d; border-radius: 8px; background: #111827; padding: 18px; margin-bottom: 16px; }
  .cc-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
  .cc-title { margin: 0; font-size: 28px; line-height: 1.1; font-weight: 900; letter-spacing: 0; }
  .cc-subtitle { margin: 6px 0 0; color: #93a4bd; font-size: 14px; }
  .cc-nav { display: flex; gap: 8px; align-items: center; }
  .cc-nav a { color: #dbeafe; text-decoration: none; border: 1px solid #31527d; border-radius: 8px; padding: 9px 12px; background: #0b1322; font-size: 13px; }
  .cc-month { min-width: 120px; text-align: center; color: #f8fafc; font-weight: 800; }
  .cc-filter { display: grid; grid-template-columns: minmax(240px, 1fr) 180px auto; gap: 12px; align-items: end; }
  .cc-field label { display: block; margin-bottom: 6px; color: #9fb0c7; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  .cc-field select { width: 100%; height: 40px; border: 1px solid #31527d; border-radius: 8px; background: #0b1322; color: #f8fafc; padding: 0 12px; font-size: 14px; }
  .cc-btn { height: 40px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; padding: 0 18px; font-weight: 900; cursor: pointer; }
  .cc-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
  .cc-metric { border: 1px solid #27486f; border-radius: 8px; background: #101827; padding: 14px; }
  .cc-metric__label { color: #94a3b8; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
  .cc-metric__value { margin-top: 6px; font-size: 26px; font-weight: 900; }
  .cc-metric--task .cc-metric__value { color: #93c5fd; }
  .cc-metric--bill .cc-metric__value { color: #fbbf24; }
  .cc-metric--overdue .cc-metric__value { color: #fb7185; }
  .cc-metric--done .cc-metric__value { color: #22c55e; }
  .cc-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .cc-day-header { text-align: center; font-size: 12px; font-weight: 900; color: #9fb0c7; padding: 8px 4px; text-transform: uppercase; }
  .cc-day { min-height: 128px; border: 1px solid #27486f; border-radius: 8px; background: #101827; padding: 8px; overflow: hidden; }
  .cc-day--empty { opacity: .45; }
  .cc-day--today { border-color: #60a5fa; box-shadow: inset 0 0 0 1px rgba(96,165,250,.45); }
  .cc-day__num { color: #dbeafe; font-size: 13px; font-weight: 900; margin-bottom: 7px; }
  .cc-day--today .cc-day__num { color: #60a5fa; }
  .cc-event { display: grid; gap: 2px; border-radius: 7px; padding: 6px 7px; margin-bottom: 5px; text-decoration: none; color: #f8fafc; border-left: 4px solid var(--event-color, #60a5fa); background: rgba(59,130,246,.16); min-width: 0; }
  .cc-event--bill { background: rgba(245,158,11,.18); }
  .cc-event--release { background: rgba(139,92,246,.18); }
  .cc-event--checklist { background: rgba(34,197,94,.14); }
  .cc-event--done { background: rgba(148,163,184,.14); color: #94a3b8; text-decoration: line-through; }
  .cc-event--overdue { background: rgba(127,29,29,.3); }
  .cc-event__title { font-size: 11px; line-height: 1.2; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cc-event__meta { color: #b6c6dc; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cc-more { color: #93c5fd; font-size: 11px; font-weight: 800; padding: 2px 4px; }
  .cc-list { margin-top: 18px; border: 1px solid #27486f; border-radius: 8px; overflow: hidden; background: #101827; }
  .cc-list__head { display: flex; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #27486f; }
  .cc-list__title { font-size: 15px; font-weight: 900; }
  .cc-row { display: grid; grid-template-columns: 90px 80px 1fr 170px 110px; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(39,72,111,.7); }
  .cc-row:last-child { border-bottom: 0; }
  .cc-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-right: 7px; vertical-align: middle; }
  .cc-row__title { color: #f8fafc; font-weight: 800; text-decoration: none; }
  .cc-row__meta, .cc-row__date, .cc-row__store, .cc-row__status { color: #9fb0c7; font-size: 12px; }
  .cc-empty { padding: 36px 18px; color: #94a3b8; text-align: center; }
  @media (max-width: 1100px) {
    .cc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cc-day-header { display: none; }
    .cc-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .cc-row { grid-template-columns: 80px 1fr; }
    .cc-row__store, .cc-row__status { display: none; }
  }
  @media (max-width: 760px) {
    .cc-page { padding: 18px; }
    .cc-top, .cc-filter { display: block; }
    .cc-nav { margin-top: 14px; }
    .cc-field, .cc-btn { width: 100%; margin-top: 10px; }
    .cc-grid, .cc-summary { grid-template-columns: 1fr; }
  }
</style>

<div class="cc-page">
  <section class="cc-header">
    <div class="cc-top">
      <div>
        <h1 class="cc-title">Company Calendar</h1>
        <p class="cc-subtitle">Monthly operating calendar for tasks, bills, releases, and store checklists.</p>
      </div>
      <nav class="cc-nav" aria-label="Calendar navigation">
        <a href="?<?= http_build_query($prevQuery) ?>">← Prev</a>
        <span class="cc-month"><?= e($monthName) ?> <?= e($year) ?></span>
        <a href="?<?= http_build_query($nextQuery) ?>">Next →</a>
      </nav>
    </div>

    <form class="cc-filter" method="GET" action="/company/calendar">
      <input type="hidden" name="month" value="<?= e($month) ?>">
      <input type="hidden" name="year" value="<?= e($year) ?>">
      <div class="cc-field">
        <label for="store_id">Store</label>
        <select id="store_id" name="store_id">
          <option value="0">All stores</option>
          <?php foreach ($stores as $store): ?>
            <option value="<?= (int)$store['id'] ?>" <?= (int)$selectedStoreId === (int)$store['id'] ? 'selected' : '' ?>>
              <?= e($store['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="cc-field">
        <label for="type">Type</label>
        <select id="type" name="type">
          <?php foreach (['all' => 'All items', 'task' => 'Tasks', 'bill' => 'Bills', 'checklist' => 'Checklists', 'release' => 'Releases'] as $value => $label): ?>
            <option value="<?= e($value) ?>" <?= $selectedType === $value ? 'selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <button class="cc-btn" type="submit">View</button>
    </form>
  </section>

  <section class="cc-summary" aria-label="Calendar summary">
    <div class="cc-metric">
      <div class="cc-metric__label">Total</div>
      <div class="cc-metric__value"><?= (int)$counts['all'] ?></div>
    </div>
    <div class="cc-metric cc-metric--task">
      <div class="cc-metric__label">Tasks</div>
      <div class="cc-metric__value"><?= (int)$counts['task'] ?></div>
    </div>
    <div class="cc-metric cc-metric--bill">
      <div class="cc-metric__label">Bills</div>
      <div class="cc-metric__value"><?= (int)$counts['bill'] ?></div>
    </div>
    <div class="cc-metric cc-metric--overdue">
      <div class="cc-metric__label">Overdue</div>
      <div class="cc-metric__value"><?= (int)$counts['overdue'] ?></div>
    </div>
    <div class="cc-metric cc-metric--done">
      <div class="cc-metric__label">Done/Paid</div>
      <div class="cc-metric__value"><?= (int)$counts['done'] ?></div>
    </div>
  </section>

  <section class="cc-grid" aria-label="Calendar month grid">
    <?php foreach ($dayNames as $d): ?>
      <div class="cc-day-header"><?= e($d) ?></div>
    <?php endforeach; ?>

    <?php for ($i = 1; $i < $firstDay; $i++): ?>
      <div class="cc-day cc-day--empty"></div>
    <?php endfor; ?>

    <?php for ($day = 1; $day <= $daysInMonth; $day++):
      $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $day);
      $dayEvents = $eventsByDate[$dateStr] ?? [];
      $isToday = $dateStr === $today;
    ?>
      <div class="cc-day <?= $isToday ? 'cc-day--today' : '' ?>">
        <div class="cc-day__num"><?= (int)$day ?></div>
        <?php foreach (array_slice($dayEvents, 0, 4) as $ev):
          $status = strtolower($ev['status'] ?? '');
          $stateClass = in_array($status, ['done', 'completed', 'paid'], true) ? 'cc-event--done' : (($ev['date'] ?? '') < $today ? 'cc-event--overdue' : '');
        ?>
          <a class="cc-event cc-event--<?= e($ev['type']) ?> <?= $stateClass ?>"
             style="--event-color: <?= e($ev['color']) ?>"
             href="<?= e($ev['url']) ?>"
             title="<?= e($ev['title']) ?>">
            <span class="cc-event__title"><?= e($ev['title']) ?></span>
            <span class="cc-event__meta"><?= e($ev['store'] ?: ucfirst($ev['type'])) ?></span>
          </a>
        <?php endforeach; ?>
        <?php if (count($dayEvents) > 4): ?>
          <div class="cc-more">+<?= count($dayEvents) - 4 ?> more</div>
        <?php endif; ?>
      </div>
    <?php endfor; ?>
  </section>

  <section class="cc-list">
    <div class="cc-list__head">
      <div class="cc-list__title">Items This Month</div>
      <div class="cc-row__meta"><?= count($events) ?> item<?= count($events) === 1 ? '' : 's' ?></div>
    </div>
    <?php if (empty($events)): ?>
      <div class="cc-empty">No items found for this store/filter.</div>
    <?php else: ?>
      <?php foreach ($events as $ev): ?>
        <div class="cc-row">
          <div class="cc-row__date"><?= e(date('M d', strtotime($ev['date']))) ?></div>
          <div class="cc-row__meta"><span class="cc-dot" style="background:<?= e($ev['color']) ?>"></span><?= e(ucfirst($ev['type'])) ?></div>
          <div>
            <a class="cc-row__title" href="<?= e($ev['url']) ?>"><?= e($ev['title']) ?></a>
            <div class="cc-row__meta"><?= e($ev['subtitle'] ?? '') ?></div>
          </div>
          <div class="cc-row__store"><?= e($ev['store'] ?: 'Company') ?></div>
          <div class="cc-row__status"><?= e($ev['status'] ?? '') ?></div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>
</div>
