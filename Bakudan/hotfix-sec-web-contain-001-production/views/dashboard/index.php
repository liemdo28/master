<?php
function ui_status($status) {
  $map = [
    'todo' => [t('dashboard.status.todo'), 'pill pill-neutral'],
    'in_progress' => [t('dashboard.status.in_progress'), 'pill pill-info'],
    'review' => [t('dashboard.status.review'), 'pill pill-warn'],
    'done' => [t('dashboard.status.done'), 'pill pill-ok'],
  ];
  $key = $status ?: 'todo';
  return $map[$key] ?? [ucfirst(str_replace('_',' ',$key)), 'pill pill-neutral'];
}

function ui_priority($p) {
  $p = strtolower((string)$p);
  if (in_array($p, ['high','urgent','p1'])) return [t('task.priority_high'), 'pill pill-danger'];
  if (in_array($p, ['medium','normal','p2'])) return [t('task.priority_medium'), 'pill pill-warn'];
  if (in_array($p, ['low','p3'])) return [t('task.priority_low'), 'pill pill-neutral'];
  return [ucfirst($p ?: '—'), 'pill pill-neutral'];
}

function ui_due($dueDate) {
  if (empty($dueDate)) return [t('common.no_due'), 'chip chip-muted'];
  $ts = strtotime($dueDate);
  if (!$ts) return [$dueDate, 'chip chip-muted'];

  $today = strtotime(date('Y-m-d'));
  $diffDays = (int) floor(($ts - $today) / 86400);

  if ($diffDays < 0) return [t('common.overdue_days', ['days' => abs($diffDays)]), 'chip chip-danger'];
  if ($diffDays === 0) return [t('common.due_today'), 'chip chip-warn'];
  if ($diffDays <= 3) return [t('common.due_in_days', ['days' => $diffDays]), 'chip chip-info'];
  return [date('M d', $ts), 'chip chip-muted'];
}

function ui_task_url($taskId) {
  return 'index.php?route=tasks/view&id=' . urlencode($taskId);
}

$pageTitle = t('page.dashboard');
$currentPage = 'dashboard';
$dashboardView = $_GET['view'] ?? 'detail';
ob_start();
?>

<!-- View Tabs -->
<div class="view-tabs mb-4" style="border-bottom:1px solid var(--border);margin-bottom:24px">
    <a href="<?= APP_URL ?>/dashboard" class="view-tab <?= $dashboardView !== 'overview' ? 'active' : '' ?>"><?= e(t('dashboard.tab_detail')) ?></a>
    <a href="<?= APP_URL ?>/overview" class="view-tab <?= $dashboardView === 'overview' ? 'active' : '' ?>"><?= e(t('dashboard.tab_overview')) ?></a>
</div>

<?php if ($dashboardView === 'overview'): ?>
<?php include __DIR__ . '/overview.php'; ?>
<?php else: ?>

<!-- TKT-201 · Your workday — action-first daily landing panel -->
<?php if (!empty($workday) && isset($workday['today_tasks'])): $user = currentUser(); ?>
<section class="wd-panel">
    <div class="wd-head">
        <div>
            <div class="wd-eyebrow">Today · <?= e(date('l, d/m/Y', strtotime(app_today()))) ?></div>
            <h2 class="wd-title">Welcome, <?= e(explode(' ', $user['name'] ?? 'bạn')[0] ?? 'bạn') ?></h2>
        </div>
        <div class="wd-kpi-row">
            <div class="wd-kpi"><span class="wd-kpi-num"><?= count($workday['today_tasks']) ?></span><span class="wd-kpi-lbl">Due Today</span></div>
            <div class="wd-kpi <?= count($workday['overdue_tasks']) > 0 ? 'wd-kpi-danger' : '' ?>"><span class="wd-kpi-num"><?= count($workday['overdue_tasks']) ?></span><span class="wd-kpi-lbl">Overdue</span></div>
            <div class="wd-kpi"><span class="wd-kpi-num"><?= count($workday['recent_tasks']) ?></span><span class="wd-kpi-lbl">In Progress</span></div>
        </div>
    </div>
    <div class="wd-grid">
        <?php if ($workday['focus_task']): $f = $workday['focus_task']; ?>
        <div class="wd-focus" onclick="if(window.TaskDrawer){window.TaskDrawer.focusTask(<?= (int)$f['id'] ?>)}">
            <div class="wd-focus-label">✨ Focus task</div>
            <div class="wd-focus-title"><?= e($f['title']) ?></div>
            <div class="wd-focus-meta">
                <?php if (!empty($f['project_name'])): ?><span>📁 <?= e($f['project_name']) ?></span><?php endif; ?>
                <?php if (!empty($f['store_name'])): ?><span>🏪 <?= e($f['store_name']) ?></span><?php endif; ?>
                <?php if (!empty($f['due_date'])): ?><span class="<?= $f['due_date'] < app_today() ? 'wd-focus-overdue' : '' ?>">📅 <?= e(date('d/m/Y', strtotime($f['due_date']))) ?></span><?php endif; ?>
            </div>
            <button type="button" class="wd-focus-cta">Start →</button>
        </div>
        <?php endif; ?>
        <div class="wd-col">
            <div class="wd-col-head"><span>🌅 Due Today</span><span class="wd-col-count"><?= count($workday['today_tasks']) ?></span></div>
            <?php if (empty($workday['today_tasks'])): ?>
                <div class="wd-empty">No tasks due today 🎉</div>
            <?php else: ?>
                <?php foreach (array_slice($workday['today_tasks'], 0, 4) as $t): ?>
                <a class="wd-item" href="<?= APP_URL ?>/tasks/<?= (int)$t['id'] ?>" onclick="if(window.TaskDrawer){event.preventDefault();window.TaskDrawer.focusTask(<?= (int)$t['id'] ?>)}">
                    <span class="wd-item-title"><?= e(mb_strimwidth($t['title'], 0, 40, '…')) ?></span>
                    <span class="wd-item-meta"><?= e($t['project_name'] ?? '') ?></span>
                </a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
        <div class="wd-col wd-col-danger">
            <div class="wd-col-head"><span>🔥 Overdue</span><span class="wd-col-count"><?= count($workday['overdue_tasks']) ?></span></div>
            <?php if (empty($workday['overdue_tasks'])): ?>
                <div class="wd-empty">No overdue tasks 🎉</div>
            <?php else: ?>
                <?php foreach (array_slice($workday['overdue_tasks'], 0, 4) as $t): ?>
                <a class="wd-item wd-item-danger" href="<?= APP_URL ?>/tasks/<?= (int)$t['id'] ?>" onclick="if(window.TaskDrawer){event.preventDefault();window.TaskDrawer.focusTask(<?= (int)$t['id'] ?>)}">
                    <span class="wd-item-title">! <?= e(mb_strimwidth($t['title'], 0, 40, '…')) ?></span>
                    <span class="wd-item-meta"><?= e(date('d/m', strtotime($t['due_date']))) ?></span>
                </a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</section>
<style>
.wd-panel{border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(34,197,94,.04));padding:20px;margin-bottom:24px}
.wd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.wd-eyebrow{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
.wd-title{margin:0;font-size:22px;font-weight:700}
.wd-kpi-row{display:flex;gap:8px}
.wd-kpi{display:flex;flex-direction:column;align-items:center;padding:8px 16px;border-radius:12px;background:var(--bg-secondary);border:1px solid var(--border)}
.wd-kpi-num{font-size:20px;font-weight:700;line-height:1}
.wd-kpi-lbl{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.wd-kpi-danger .wd-kpi-num{color:#ef4444}
.wd-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px}
@media (max-width:900px){.wd-grid{grid-template-columns:1fr}}
.wd-focus{padding:16px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(99,102,241,.25);transition:transform .12s,box-shadow .12s}
.wd-focus:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(99,102,241,.35)}
.wd-focus-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;opacity:.8;margin-bottom:6px}
.wd-focus-title{font-size:16px;font-weight:700;line-height:1.3;margin-bottom:10px}
.wd-focus-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;opacity:.88;margin-bottom:12px}
.wd-focus-overdue{color:#fecaca;font-weight:600}
.wd-focus-cta{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer}
.wd-col{border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary);padding:14px}
.wd-col-head{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:13px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.wd-col-count{background:rgba(255,255,255,.08);padding:2px 8px;border-radius:999px;font-size:11px}
.wd-col-danger .wd-col-head{color:#fca5a5}
.wd-col-danger{border-color:rgba(239,68,68,.3);background:linear-gradient(135deg,rgba(239,68,68,.04),var(--bg-secondary))}
.wd-item{display:flex;justify-content:space-between;align-items:center;padding:7px 8px;border-radius:6px;text-decoration:none;color:inherit;font-size:12.5px;transition:background .1s}
.wd-item:hover{background:rgba(99,102,241,.12)}
.wd-item-title{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:8px}
.wd-item-meta{font-size:11px;color:var(--text-muted);flex-shrink:0}
.wd-item-danger{color:#fca5a5}
.wd-item-danger:hover{background:rgba(239,68,68,.12)}
.wd-empty{padding:16px;text-align:center;color:var(--text-muted);font-size:12px}
</style>
<?php endif; ?>

<!-- Stats -->
<div class="grid grid-4 mb-4">
    <div class="stat-card">
        <div class="stat-icon red"><?= tf_icon('folder-open', 20) ?></div>
        <div>
            <div class="stat-value"><?= $totalProjects ?></div>
            <div class="stat-label"><?= e(t('dashboard.projects')) ?></div>
        </div>
    </div>
    <div class="stat-card">
        <div class="stat-icon dark"><?= tf_icon('clipboard-list', 20) ?></div>
        <div>
            <div class="stat-value"><?= $totalTasks ?></div>
            <div class="stat-label"><?= e(t('dashboard.total_tasks')) ?></div>
        </div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green"><?= tf_icon('check-circle', 20) ?></div>
        <div>
            <div class="stat-value"><?= $completedTasks ?></div>
            <div class="stat-label"><?= e(t('dashboard.completed')) ?></div>
        </div>
    </div>
    <div class="stat-card">
        <div class="stat-icon blue"><?= tf_icon('users', 20) ?></div>
        <div>
            <div class="stat-value"><?= $totalMembers ?></div>
            <div class="stat-label"><?= e(t('dashboard.members')) ?></div>
        </div>
    </div>
</div>

<div class="grid grid-2 mb-4">
    <!-- Task Distribution -->
    <div class="card" style="min-height:280px">
        <div class="card-header"><h3><?= tf_icon('bar-chart-3', 18) ?> <?= e(t('dashboard.task_distribution')) ?></h3></div>
        <div class="card-body" style="padding:20px 24px">
            <?php
            $statusMap = ['todo'=>0,'in_progress'=>0,'review'=>0,'done'=>0];
            foreach ($tasksByStatus as $s) $statusMap[$s['status']] = $s['count'];
            $maxVal = max(1, max($statusMap));
            $sLabels = ['todo'=>t('dashboard.status.todo'),'in_progress'=>t('dashboard.status.in_progress'),'review'=>t('dashboard.status.review'),'done'=>t('dashboard.status.done')];
            $sColors = ['todo'=>'var(--text-muted)','in_progress'=>'var(--blue)','review'=>'var(--amber)','done'=>'var(--green)'];
            ?>
            <div class="task-dist-chart">
                <?php foreach ($statusMap as $key => $val): ?>
                <div class="dist-col">
                    <div class="dist-val"><?= $val ?></div>
                    <div class="dist-bar-wrap">
                        <div class="dist-bar" style="height:<?= ($val / $maxVal * 100) ?>%;background:<?= $sColors[$key] ?>"></div>
                    </div>
                    <div class="dist-label"><?= $sLabels[$key] ?></div>
                </div>
                <?php endforeach; ?>
            </div>
            <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center">
                <?php foreach ($statusMap as $key => $val): ?>
                <div style="display:flex;align-items:center;gap:6px;font-size:12px">
                    <span style="width:10px;height:10px;border-radius:2px;background:<?= $sColors[$key] ?>;display:inline-block;flex-shrink:0"></span>
                    <span style="color:var(--text-muted)"><?= $sLabels[$key] ?></span>
                    <span style="font-weight:700"><?= $val ?></span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

    <!-- Overdue -->
    <div class="card">
        <div class="card-header">
            <h3><?= tf_icon('alert-triangle', 18) ?> <?= e(t('dashboard.overdue_tasks')) ?></h3>
            <span class="badge badge-admin"><?= count($overdueTasks) ?></span>
        </div>
        <div class="card-body">
            <?php if (empty($overdueTasks)): ?>
                <p class="text-muted text-center" style="padding:16px"><?= e(t('dashboard.no_overdue')) ?></p>
            <?php else: ?>
                <?php foreach (array_slice($overdueTasks, 0, 5) as $task): ?>
                <div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
                    <div>
                        <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>" style="font-size:13px;font-weight:600;color:var(--text)"><?= e($task['title']) ?></a>
                        <div class="text-sm text-muted"><?= e($task['project_name']) ?></div>
                    </div>
                    <span class="due-date overdue"><?= date('d/m', strtotime($task['due_date'])) ?></span>
                </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- My Tasks -->
<div class="card mb-4">
    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <h3><?= tf_icon('pin', 18) ?> <?= e(t('dashboard.my_tasks')) ?></h3>
        <div style="display:flex;align-items:center;gap:12px">
            <span class="text-muted text-sm"><?= count($myTasks) ?> <?= e(t('common.tasks_count')) ?></span>
            <a href="#" onclick="openCreateTaskModal();return false;" class="btn btn-primary btn-sm" style="font-size:11px;padding:4px 10px">+ <?= e(t('create.task')) ?></a>
        </div>
    </div>

    <div class="card-body">
        <?php if (empty($myTasks)): ?>
            <div class="empty-state">
                <div class="icon"><?= tf_icon('clipboard-list', 40) ?></div>
                <h3><?= e(t('dashboard.no_tasks')) ?></h3>
                <p><?= e(t('dashboard.no_assigned_tasks')) ?></p>
            </div>
        <?php else: ?>

        <div class="my-tasks-grid">
            <?php foreach ($myTasks as $task): ?>
                <?php
                $status = $task['status'];
                $priority = $task['priority'];
                $due = $task['due_date'];

                $statusLabels = ['todo'=>t('task.status_todo'),'in_progress'=>t('task.status_in_progress'),'review'=>t('task.status_review'),'done'=>t('task.status_done')];
                $priorityLabels = ['low'=>t('task.priority_low'),'medium'=>t('task.priority_medium'),'high'=>t('task.priority_high'),'urgent'=>t('task.priority_urgent')];
                $statusLabel = $statusLabels[$status] ?? ucfirst(str_replace('_',' ',$status));
                $priorityLabel = $priorityLabels[$priority] ?? ucfirst($priority);

                $isOverdue = ($due && $due < date('Y-m-d'));
                $isUrgent = in_array($priority, ['urgent', 'high']);

                $priColors = ['urgent'=>'var(--accent)','high'=>'var(--amber)','medium'=>'var(--blue)','low'=>'var(--text-muted)'];
                $priColor = $priColors[$priority] ?? 'var(--text-muted)';
                ?>

                <a class="my-task-row <?= $isUrgent ? 'urgency-gap' : '' ?>" href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>">
                    <div class="task-priority-bar" style="background:<?= $priColor ?>"></div>
                    <?php if ($priority === 'urgent'): ?>
                        <div class="urgency-blink"></div>
                    <?php endif; ?>
                    <div class="task-info">
                        <div class="task-name"><?= e($task['title']) ?></div>
                        <div class="task-sub">
                            <span><?= e($task['project_name'] ?? '-') ?></span>
                            <?php if ($due): ?>
                                <span>•</span>
                                <span class="<?= $isOverdue ? 'overdue' : '' ?>"><?= date('d/m', strtotime($due)) ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="task-badges">
                        <span class="tbadge priority-<?= e($priority) ?>"><?= e($priorityLabel) ?></span>
                        <span class="tbadge status-<?= e($status) ?>"><?= e($statusLabel) ?></span>
                    </div>
                    <div class="task-arrow-icon">→</div>
                </a>
            <?php endforeach; ?>
        </div>

        <?php endif; ?>
    </div>
</div>

<!-- Projects -->
<div class="flex-between mb-3">
    <h3 style="font-size:15px;font-weight:700"><?= e(t('dashboard.recent_projects')) ?></h3>
    <a href="<?= APP_URL ?>/projects/create" class="btn btn-primary btn-sm"><?= e(t('dashboard.create_project')) ?></a>
</div>

<div class="grid grid-3">
    <?php foreach (array_slice($projects, 0, 6) as $proj):
        $pct = $proj['task_count'] > 0 ? round($proj['completed_count'] / $proj['task_count'] * 100) : 0;
    ?>
    <a href="<?= APP_URL ?>/projects/<?= $proj['id'] ?>" class="project-card">
        <div class="card-accent" style="background:<?= e($proj['color']) ?>"></div>
        <div class="card-content">
            <h3><?= e($proj['name']) ?></h3>
            <p><?= e(mb_substr($proj['description'] ?? t('common.untitled'), 0, 60)) ?></p>
            <div class="progress-bar">
                <div class="progress-fill" style="width:<?= $pct ?>%;background:<?= e($proj['color']) ?>"></div>
            </div>
            <div class="card-footer">
                <span><?= $pct . e(t('dashboard.complete_percent')) ?></span>
                <span><?= $proj['task_count'] ?> <?= e(t('common.tasks_count')) ?></span>
            </div>
        </div>
    </a>
    <?php endforeach; ?>
</div>

<?php endif; // end detail/overview tab ?>

<!-- (Optional) JS: currently unused because dashboard doesn't have [data-seg="mywork"] -->
<script>
(function(){
  const seg = document.querySelector('[data-seg="mywork"]');
  const list = document.getElementById('myworkList');
  if(!seg || !list) return;

  function isToday(d){ if(!d) return false; const x=new Date(d); const t=new Date(); return x.toDateString()===t.toDateString(); }
  function daysDiff(d){
    if(!d) return null;
    const x=new Date(d); const t=new Date();
    const a=new Date(t.getFullYear(),t.getMonth(),t.getDate());
    const b=new Date(x.getFullYear(),x.getMonth(),x.getDate());
    return Math.round((b-a)/86400000);
  }

  seg.addEventListener('click', (e)=>{
    const btn = e.target.closest('.seg'); if(!btn) return;
    seg.querySelectorAll('.seg').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');

    const f = btn.dataset.filter;
    [...list.querySelectorAll('.task-card')].forEach(card=>{
      const st = (card.dataset.status || '').toLowerCase();
      const due = card.dataset.due || '';
      const dd = daysDiff(due);

      let ok = true;
      if (f === 'today') ok = isToday(due);
      if (f === 'week') ok = (dd !== null && dd >= 0 && dd <= 7);
      if (f === 'in_progress') ok = (st === 'in_progress');
      if (f === 'all') ok = true;

      card.style.display = ok ? '' : 'none';
    });
  });
})();
</script>

<?php
$content = ob_get_clean();

$headerActions = '';

require __DIR__ . '/../layouts/main.php';
