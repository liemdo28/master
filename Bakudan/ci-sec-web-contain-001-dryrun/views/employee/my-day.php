<?php
// Phase 11 — Module 4: Employee My Day View
?>
<style>
.myday-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px; padding: 32px; margin-bottom: 28px;
    border: 1px solid #2a2a3e;
}
.myday-hero h2 { font-size: 28px; font-weight: 700; color: #fff; margin: 0 0 8px; }
.myday-hero .greeting { font-size: 14px; color: #9ca3af; margin-bottom: 20px; }
.myday-stats { display: flex; gap: 16px; flex-wrap: wrap; }
.myday-stat { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px 20px; text-align: center; min-width: 80px; }
.myday-stat .num { font-size: 28px; font-weight: 700; color: #fff; line-height: 1; }
.myday-stat .num.red { color: #ff4444; } .myday-stat .num.blue { color: #3b82f6; } .myday-stat .num.green { color: #00cc66; }
.myday-stat .lbl { font-size: 10px; color: #9ca3af; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

.task-card { background: var(--card-bg, #18181b); border: 1px solid var(--border, #27272a); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.task-card h3 { font-size: 14px; font-weight: 600; color: var(--text-muted); margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
.task-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border, #27272a); }
.task-item:last-child { border-bottom: none; }
.task-pri { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.task-pri.urgent { background: #ff4444; box-shadow: 0 0 6px #ff4444; } .task-pri.high { background: #ff4444; }
.task-pri.medium { background: #ffaa00; } .task-pri.low { background: #3b82f6; }
.task-body { flex: 1; min-width: 0; }
.task-title { font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.task-project { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.task-due { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; flex-shrink: 0; }
.task-due.overdue { background: rgba(255,68,68,0.15); color: #ff4444; }
.task-due.today { background: rgba(59,130,246,0.15); color: #3b82f6; }
.task-due.upcoming { background: rgba(255,255,255,0.05); color: var(--text-muted); }

.btn-check { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #3b82f6; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
.btn-check:hover { background: rgba(59,130,246,0.2); }
.btn-check.done { background: #00cc66; border-color: #00cc66; color: white; }

.announce-card { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
.announce-title { font-size: 13px; font-weight: 600; color: #3b82f6; margin-bottom: 4px; }
.announce-body { font-size: 12px; color: var(--text-muted); }
.announce-from { font-size: 11px; color: var(--text-muted); margin-top: 6px; }

.empty-state { text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; }
.empty-state .emoji { font-size: 32px; margin-bottom: 8px; }

.myday-layout { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }
@media (max-width: 900px) { .myday-layout { grid-template-columns: 1fr; } }
</style>

<div class="myday-hero">
    <h2>Good <?= (int)date('H') < 12 ? 'Morning' : ((int)date('H') < 17 ? 'Afternoon' : 'Evening') ?>, <?= e($user['name']) ?></h2>
    <p class="greeting"><?= e($today) ?> &mdash; Here's your day</p>
    <div class="myday-stats">
        <div class="myday-stat">
            <div class="num <?= ($stats['overdue'] ?? 0) > 0 ? 'red' : 'green' ?>"><?= $stats['overdue'] ?? 0 ?></div>
            <div class="lbl">Overdue</div>
        </div>
        <div class="myday-stat">
            <div class="num blue"><?= $stats['due_today'] ?? 0 ?></div>
            <div class="lbl">Due Today</div>
        </div>
        <div class="myday-stat">
            <div class="num green"><?= $stats['completed'] ?? 0 ?></div>
            <div class="lbl">Completed</div>
        </div>
        <div class="myday-stat">
            <div class="num"><?= $stats['total'] ?? 0 ?></div>
            <div class="lbl">Total Tasks</div>
        </div>
    </div>
</div>

<div class="myday-layout">
    <div>
        <!-- Today's Tasks -->
        <div class="task-card">
            <h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Today's Tasks (<?= count($todayTasks) ?>)
            </h3>
            <?php if (empty($todayTasks)): ?>
                <div class="empty-state"><div class="emoji">🎉</div>Nothing due today — enjoy!</div>
            <?php else: ?>
                <?php foreach ($todayTasks as $t): ?>
                    <div class="task-item">
                        <button class="btn-check" onclick="completeTask(<?= $t['id'] ?>, this)" title="Mark complete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <div class="task-pri <?= e($t['priority']) ?>"></div>
                        <div class="task-body">
                            <div class="task-title"><?= e($t['title']) ?></div>
                            <div class="task-project"><?= e($t['project_name'] ?? '') ?></div>
                        </div>
                        <?php
                        $isOverdue = !empty($t['due_date']) && $t['due_date'] < $today;
                        ?>
                        <span class="task-due <?= $isOverdue ? 'overdue' : 'today' ?>">
                            <?= $isOverdue ? 'Overdue' : 'Today' ?>
                        </span>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Upcoming -->
        <?php if (!empty($upcomingTasks)): ?>
        <div class="task-card">
            <h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Coming Up (next 7 days)
            </h3>
            <?php foreach ($upcomingTasks as $t): ?>
                <div class="task-item">
                    <div class="task-pri <?= e($t['priority']) ?>"></div>
                    <div class="task-body">
                        <div class="task-title"><?= e($t['title']) ?></div>
                        <div class="task-project"><?= e($t['project_name'] ?? '') ?></div>
                    </div>
                    <span class="task-due upcoming"><?= e(date('M d', strtotime($t['due_date']))) ?></span>
                </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div>

    <!-- Sidebar -->
    <div>
        <!-- Announcements -->
        <div class="task-card">
            <h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Announcements
            </h3>
            <?php if (empty($announcements)): ?>
                <div class="empty-state"><div class="emoji">📢</div>No announcements</div>
            <?php else: ?>
                <?php foreach ($announcements as $a): ?>
                    <div class="announce-card">
                        <div class="announce-title"><?= e($a['title']) ?></div>
                        <?php if (!empty($a['description'])): ?>
                            <div class="announce-body"><?= e(mb_substr($a['description'], 0, 100)) ?></div>
                        <?php endif; ?>
                        <div class="announce-from"><?= e($a['created_by_name'] ?? '') ?> · <?= timeAgo($a['created_at']) ?></div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Quick Actions -->
        <div class="task-card">
            <h3>Quick Actions</h3>
            <a href="/my-tasks" class="btn btn-sm btn-secondary" style="display:block;text-align:center;margin-bottom:8px">View All My Tasks</a>
            <a href="/calendar" class="btn btn-sm btn-secondary" style="display:block;text-align:center">Calendar</a>
        </div>
    </div>
</div>

<script>
function completeTask(id, btn) {
    fetch('/api/tasks/' + id + '/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'csrf_token=' + encodeURIComponent(window.CSRF_TOKEN)
    }).then(r => r.json()).then(d => {
        if (d.ok) {
            btn.classList.add('done');
            setTimeout(() => btn.closest('.task-item').remove(), 500);
        }
    });
}
</script>
