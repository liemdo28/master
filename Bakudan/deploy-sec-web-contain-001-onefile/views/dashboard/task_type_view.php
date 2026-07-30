<?php
  $selectedLabel = '';
  foreach ($availableTypes as $t) {
      if (($t['task_type'] ?? '') === $taskType) {
          $selectedLabel = $t['label'] ?? $taskType;
          break;
      }
  }

  $totalTasks = 0;
  $doneTasks = 0;
  $openTasks = 0;
  $overdueTasks = 0;
  if (!empty($storeResults)) {
      foreach ($storeResults as $result) {
          foreach ($result['tasks'] as $task) {
              $totalTasks++;
              $status = strtolower($task['status'] ?? '');
              $isDone = (int)($task['is_completed'] ?? 0) === 1 || in_array($status, ['done', 'completed'], true);
              if ($isDone) {
                  $doneTasks++;
              } else {
                  $openTasks++;
                  if (!empty($task['due_date']) && $task['due_date'] < date('Y-m-d')) {
                      $overdueTasks++;
                  }
              }
          }
      }
  }
?>

<style>
  .ttv-page { max-width: 1440px; margin: 0 auto; padding: 28px; color: #e5eefc; }
  .ttv-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 22px; }
  .ttv-title { margin: 0; font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: 0; }
  .ttv-subtitle { margin: 8px 0 0; color: #94a3b8; font-size: 14px; }
  .ttv-back { color: #60a5fa; text-decoration: none; font-size: 14px; white-space: nowrap; }
  .ttv-panel { background: #111827; border: 1px solid #25456f; border-radius: 8px; padding: 16px; margin-bottom: 18px; }
  .ttv-filter { display: grid; grid-template-columns: minmax(240px, 1fr) 180px auto; gap: 12px; align-items: end; }
  .ttv-field label { display: block; margin-bottom: 6px; color: #93a4bd; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .ttv-field select { width: 100%; height: 40px; border: 1px solid #31527d; border-radius: 8px; background: #0b1322; color: #f8fafc; padding: 0 12px; font-size: 14px; }
  .ttv-btn { height: 40px; border: 0; border-radius: 8px; background: #2563eb; color: #fff; padding: 0 18px; font-weight: 800; cursor: pointer; }
  .ttv-btn:hover { background: #1d4ed8; }
  .ttv-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
  .ttv-metric { border: 1px solid #27486f; border-radius: 8px; background: #101827; padding: 16px; min-height: 86px; }
  .ttv-metric__label { color: #9aaec8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  .ttv-metric__value { margin-top: 8px; font-size: 30px; font-weight: 900; }
  .ttv-metric--total .ttv-metric__value { color: #93c5fd; }
  .ttv-metric--open .ttv-metric__value { color: #facc15; }
  .ttv-metric--done .ttv-metric__value { color: #22c55e; }
  .ttv-metric--overdue .ttv-metric__value { color: #fb7185; }
  .ttv-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .ttv-store { border: 1px solid #27486f; border-radius: 8px; background: #101827; overflow: hidden; }
  .ttv-store--green { border-color: rgba(34,197,94,.55); }
  .ttv-store--yellow { border-color: rgba(250,204,21,.6); }
  .ttv-store--red { border-color: rgba(248,113,113,.7); }
  .ttv-store__head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 14px; border-bottom: 1px solid #213a5d; }
  .ttv-store__name { font-weight: 800; }
  .ttv-pill { border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .ttv-pill--green { color: #bbf7d0; background: rgba(34,197,94,.16); }
  .ttv-pill--yellow { color: #fef08a; background: rgba(250,204,21,.14); }
  .ttv-pill--red { color: #fecdd3; background: rgba(248,113,113,.18); }
  .ttv-pill--gray { color: #cbd5e1; background: rgba(148,163,184,.14); }
  .ttv-store__body { padding: 12px 14px 14px; display: grid; gap: 8px; }
  .ttv-empty { color: #64748b; font-size: 13px; padding: 8px 0; }
  .ttv-task { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; padding: 9px 10px; border-radius: 8px; border: 1px solid rgba(71,85,105,.6); background: #0b1322; }
  .ttv-task--done { background: rgba(148,163,184,.12); color: #94a3b8; text-decoration: line-through; }
  .ttv-task--overdue { background: rgba(127,29,29,.22); border-color: rgba(248,113,113,.55); }
  .ttv-task--due { background: rgba(113,63,18,.22); border-color: rgba(250,204,21,.5); }
  .ttv-task--upcoming { background: rgba(20,83,45,.18); border-color: rgba(34,197,94,.36); }
  .ttv-task__title { min-width: 0; font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ttv-task__meta { color: #9fb0c7; font-size: 12px; margin-top: 3px; }
  .ttv-task__date { color: #dbeafe; font-size: 12px; white-space: nowrap; }
  .ttv-center { border: 1px dashed #31527d; border-radius: 8px; padding: 54px 20px; text-align: center; color: #9aaec8; background: rgba(15,23,42,.55); }
  @media (max-width: 1080px) {
    .ttv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 760px) {
    .ttv-page { padding: 18px; }
    .ttv-header, .ttv-filter { display: block; }
    .ttv-field, .ttv-btn { width: 100%; margin-top: 10px; }
    .ttv-summary, .ttv-grid { grid-template-columns: 1fr; }
  }
</style>

<div class="ttv-page">
  <div class="ttv-header">
    <div>
      <h1 class="ttv-title">Task Type View</h1>
      <p class="ttv-subtitle">View one recurring task type across all stores for a selected month.</p>
    </div>
    <a class="ttv-back" href="/overview">← Overview</a>
  </div>

  <form method="GET" action="/task-type-view" class="ttv-panel ttv-filter">
    <div class="ttv-field">
      <label for="type">Task Type</label>
      <select id="type" name="type">
        <option value="">Select type</option>
        <?php foreach ($availableTypes as $t): ?>
          <option value="<?= htmlspecialchars($t['task_type']) ?>" <?= $taskType===$t['task_type']?'selected':'' ?>>
            <?= htmlspecialchars($t['label'] ?: $t['task_type']) ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="ttv-field">
      <label for="period">Month</label>
      <select id="period" name="period">
        <?php foreach ($periods as $p): ?>
          <option value="<?= htmlspecialchars($p) ?>" <?= $period===$p?'selected':'' ?>><?= htmlspecialchars($p) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <button type="submit" class="ttv-btn">View</button>
  </form>

  <?php if (!$taskType): ?>
    <div class="ttv-center">Select Review Google, Review Yelp, DoorDash, or another task type to see every store for that month.</div>
  <?php elseif (empty($storeResults)): ?>
    <div class="ttv-center">No stores found.</div>
  <?php else: ?>
    <div class="ttv-summary" aria-label="Task type summary">
      <div class="ttv-metric ttv-metric--total">
        <div class="ttv-metric__label"><?= htmlspecialchars($selectedLabel ?: $taskType) ?></div>
        <div class="ttv-metric__value"><?= $totalTasks ?></div>
      </div>
      <div class="ttv-metric ttv-metric--open">
        <div class="ttv-metric__label">Open</div>
        <div class="ttv-metric__value"><?= $openTasks ?></div>
      </div>
      <div class="ttv-metric ttv-metric--done">
        <div class="ttv-metric__label">Done</div>
        <div class="ttv-metric__value"><?= $doneTasks ?></div>
      </div>
      <div class="ttv-metric ttv-metric--overdue">
        <div class="ttv-metric__label">Overdue</div>
        <div class="ttv-metric__value"><?= $overdueTasks ?></div>
      </div>
    </div>

    <div class="ttv-grid">
      <?php foreach ($storeResults as $result):
        $color = $result['color'] ?? 'gray';
        $label = ['green' => 'Done', 'yellow' => 'Due Soon', 'red' => 'Overdue', 'gray' => 'No Task'][$color] ?? 'No Task';
      ?>
        <section class="ttv-store ttv-store--<?= htmlspecialchars($color) ?>">
          <div class="ttv-store__head">
            <div class="ttv-store__name"><?= htmlspecialchars($result['store']['name']) ?></div>
            <span class="ttv-pill ttv-pill--<?= htmlspecialchars($color) ?>"><?= htmlspecialchars($label) ?></span>
          </div>
          <div class="ttv-store__body">
            <?php if (empty($result['tasks'])): ?>
              <div class="ttv-empty">No task for <?= htmlspecialchars($period) ?>.</div>
            <?php else: ?>
              <?php foreach ($result['tasks'] as $task):
                $status = strtolower($task['status'] ?? '');
                $isDone = (int)($task['is_completed'] ?? 0) === 1 || in_array($status, ['done', 'completed'], true);
                $taskClass = 'ttv-task--upcoming';
                if ($isDone) {
                    $taskClass = 'ttv-task--done';
                } elseif (!empty($task['due_date']) && $task['due_date'] < date('Y-m-d')) {
                    $taskClass = 'ttv-task--overdue';
                } elseif (!empty($task['due_date']) && $task['due_date'] <= date('Y-m-d', strtotime('+7 days'))) {
                    $taskClass = 'ttv-task--due';
                }
              ?>
                <div class="ttv-task <?= $taskClass ?>">
                  <div>
                    <div class="ttv-task__title"><?= htmlspecialchars($task['title']) ?></div>
                    <div class="ttv-task__meta"><?= htmlspecialchars($task['assignee_name'] ?? 'Unassigned') ?> · <?= htmlspecialchars($task['status'] ?? 'todo') ?></div>
                  </div>
                  <div class="ttv-task__date"><?= htmlspecialchars($task['due_date'] ?? '-') ?></div>
                </div>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </section>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>
