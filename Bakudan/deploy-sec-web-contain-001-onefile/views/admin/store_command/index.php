<?php
/**
 * Store Command Center — Index
 * All stores with health scores, tasks, bills, employees
 * Uses app CSS classes (executive-ui, cards, layout) — NO Tailwind
 */
$gradeColors = [
    'A' => 'background:rgba(34,197,94,.15);color:#22c55e;border-color:rgba(34,197,94,.3)',
    'B' => 'background:rgba(59,130,246,.15);color:#3b82f6;border-color:rgba(59,130,246,.3)',
    'C' => 'background:rgba(234,179,8,.15);color:#eab308;border-color:rgba(234,179,8,.3)',
    'D' => 'background:rgba(249,115,22,.15);color:#f97316;border-color:rgba(249,115,22,.3)',
    'F' => 'background:rgba(239,68,68,.15);color:#ef4444;border-color:rgba(239,68,68,.3)',
];
?>
<style>
.sc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.sc-card{
    background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);
    display:flex;flex-direction:column;overflow:hidden;transition:all .15s ease;text-decoration:none;color:inherit;
}
.sc-card:hover{border-color:var(--border-hover);box-shadow:0 8px 24px rgba(0,0,0,.25);transform:translateY(-2px)}
.sc-card__head{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start}
.sc-card__name{font-size:15px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:8px}
.sc-card__dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.sc-card__address{font-size:11px;color:var(--text-muted);margin-top:2px}
.sc-card__manager{font-size:11px;color:var(--text-muted);margin-top:4px;display:flex;align-items:center;gap:4px}
.sc-card__health{text-align:right}
.sc-card__score{font-size:32px;font-weight:900;line-height:1}
.sc-card__grade{display:inline-block;margin-top:4px;padding:2px 8px;font-size:10px;font-weight:700;border-radius:6px;border:1px solid}
.sc-card__stats{padding:14px 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex:1}
.sc-stat{text-align:center}
.sc-stat__val{font-size:18px;font-weight:800;color:var(--text)}
.sc-stat__label{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.sc-stat--warn .sc-stat__val{color:#f97316}
.sc-stat--bad .sc-stat__val{color:#ef4444}
.sc-stat--ok .sc-stat__val{color:#22c55e}
.sc-card__footer{padding:10px 18px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end}
.sc-quick-btn{padding:4px 10px;font-size:11px;font-weight:600;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-muted);text-decoration:none;transition:all .12s}
.sc-quick-btn:hover{background:var(--bg-tertiary);color:var(--text);border-color:var(--border-hover)}
.sc-empty{text-align:center;padding:60px 20px;color:var(--text-muted)}
.sc-empty__icon{font-size:48px;margin-bottom:12px}
.sc-empty__title{font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px}
.sc-legend{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:12px 18px;font-size:12px;color:var(--text-muted)}
.sc-legend__item{display:flex;align-items:center;gap:5px}
.sc-legend__badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;font-size:10px;font-weight:700;color:#fff}
@media(max-width:1100px){.sc-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.sc-grid{grid-template-columns:1fr}.sc-card__stats{grid-template-columns:repeat(3,1fr);gap:6px}}
</style>

<div style="padding:24px">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
            <h1 style="font-size:22px;font-weight:900;color:var(--text);margin:0"><?php echo e(t('store.command_center')); ?></h1>
            <p style="font-size:13px;color:var(--text-muted);margin:4px 0 0"><?php echo e(t('store.command_center_desc')); ?></p>
        </div>
        <?php if (isAdmin()): ?>
            <a href="<?php echo APP_URL ?>/admin/stores" class="sc-quick-btn" style="padding:8px 16px;font-size:13px">
                <?php echo e(t('store.manage_stores')); ?>
            </a>
        <?php endif; ?>
    </div>

    <?php if (empty($stores)): ?>
        <div class="sc-empty">
            <div class="sc-empty__icon">🏪</div>
            <div class="sc-empty__title"><?php echo e(t('store.no_stores')); ?></div>
            <p style="color:var(--text-muted);margin-top:4px"><?php echo e(t('store.no_stores_desc')); ?></p>
            <a href="<?php echo APP_URL ?>/admin/stores" class="sc-quick-btn" style="display:inline-block;margin-top:12px;padding:8px 20px">
                <?php echo e(t('store.manage_stores')); ?>
            </a>
        </div>
    <?php else: ?>
        <!-- Health Grade Legend -->
        <div class="sc-legend" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:16px">
            <span style="font-weight:700;color:var(--text)"><?php echo e(t('store.health_grades')); ?>:</span>
            <span class="sc-legend__item"><span class="sc-legend__badge" style="background:#22c55e">A</span> 90-100</span>
            <span class="sc-legend__item"><span class="sc-legend__badge" style="background:#3b82f6">B</span> 80-89</span>
            <span class="sc-legend__item"><span class="sc-legend__badge" style="background:#eab308">C</span> 70-79</span>
            <span class="sc-legend__item"><span class="sc-legend__badge" style="background:#f97316">D</span> 60-69</span>
            <span class="sc-legend__item"><span class="sc-legend__badge" style="background:#ef4444">F</span> &lt;60</span>
        </div>

        <!-- Store Cards Grid -->
        <div class="sc-grid">
            <?php foreach ($stores as $store):
                $g = $store['health_grade'] ?? 'F';
                $s = (float)($store['health_score'] ?? 0);
                $scoreColor = $s >= 80 ? '#22c55e' : ($s >= 60 ? '#eab308' : '#ef4444');
                $gradeStyle = $gradeColors[$g] ?? $gradeColors['F'];
                $taskOverdue = (int)($store['task_overdue'] ?? 0);
                $taskCritical = (int)($store['task_critical'] ?? 0);
                $billUnpaid = (int)($store['bill_unpaid'] ?? 0);
            ?>
                <a href="<?php echo APP_URL ?>/admin/stores/<?php echo $store['id'] ?>" class="sc-card" data-no-drawer="true">
                    <!-- Card Header -->
                    <div class="sc-card__head">
                        <div style="flex:1;min-width:0">
                            <div class="sc-card__name">
                                <span class="sc-card__dot" style="background:<?php echo e($store['color'] ?: '#6b7280') ?>"></span>
                                <?php echo e($store['name']) ?>
                            </div>
                            <?php if (!empty($store['address'])): ?>
                                <div class="sc-card__address"><?php echo e($store['address']) ?></div>
                            <?php endif; ?>
                            <?php if (!empty($store['manager_name'])): ?>
                                <div class="sc-card__manager">
                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    <?php echo e($store['manager_name']) ?>
                                </div>
                            <?php endif; ?>
                        </div>
                        <div class="sc-card__health">
                            <div class="sc-card__score" style="color:<?php echo $scoreColor ?>"><?php echo number_format($s, 0) ?></div>
                                <span class="sc-card__grade" style="<?php echo $gradeStyle ?>"><?php echo e(t('store.grade')) ?> <?php echo $g ?></span>
                        </div>
                    </div>

                    <!-- Stats Grid -->
                    <div class="sc-card__stats">
                        <div class="sc-stat<?php echo $taskOverdue > 0 ? ' sc-stat--warn' : '' ?>">
                            <div class="sc-stat__val"><?php echo $taskOverdue ?></div>
                            <div class="sc-stat__label"><?php echo e(t('store.overdue_tasks')); ?></div>
                        </div>
                        <div class="sc-stat<?php echo $taskCritical > 0 ? ' sc-stat--bad' : '' ?>">
                            <div class="sc-stat__val"><?php echo $taskCritical ?></div>
                            <div class="sc-stat__label"><?php echo e(t('store.critical_tasks')); ?></div>
                        </div>
                        <div class="sc-stat<?php echo $billUnpaid > 0 ? ' sc-stat--warn' : '' ?>">
                            <div class="sc-stat__val"><?php echo $billUnpaid ?></div>
                            <div class="sc-stat__label"><?php echo e(t('store.unpaid_bills')); ?></div>
                        </div>
                    </div>

                    <!-- Card Footer: Quick Actions -->
                    <div class="sc-card__footer">
                        <span class="sc-quick-btn"><?php echo e(t('store.employees')); ?>: <?php echo (int)($store['employee_count'] ?? 0) ?></span>
                        <span class="sc-quick-btn"><?php echo e(t('store.total_tasks')); ?>: <?php echo (int)($store['task_total'] ?? 0) ?></span>
                        <span class="sc-quick-btn"><?php echo e(t('store.bills')); ?>: <?php echo (int)($store['bill_total'] ?? 0) ?></span>
                    </div>
                </a>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>
