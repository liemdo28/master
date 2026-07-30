<?php
/**
 * IconPresenter — Smart Icon + Visual Identity Layer
 *
 * Centralises all icon/colour/tone decisions for bills, tasks, users, and
 * business health. Every view calls these static methods instead of
 * hardcoding icons individually.
 *
 * Return format:
 *   [
 *     'icon'  => '⚡',          // emoji glyph (works everywhere without SVG)
 *     'label' => 'Utilities',   // human-readable category label
 *     'color' => '#F59E0B',     // primary hex colour
 *     'bg'    => 'rgba(…)',     // chip / badge background
 *     'tone'  => 'warning',     // semantic: info | success | warning | danger | neutral
 *     'class' => 'ip-utilities' // CSS class for targeted overrides
 *   ]
 */
class IconPresenter
{
    // ── Bill category icons ──────────────────────────────────────────────────
    private static array $BILL_CATEGORY = [
        'utilities'    => ['icon'=>'⚡','label'=>'Utilities',    'color'=>'#0EA5E9','bg'=>'rgba(14,165,233,.15)'],
        'tax'          => ['icon'=>'📋','label'=>'Tax',          'color'=>'#8B5CF6','bg'=>'rgba(139,92,246,.15)'],
        'insurance'    => ['icon'=>'🛡️','label'=>'Insurance',    'color'=>'#06B6D4','bg'=>'rgba(6,182,212,.15)'],
        'rent'         => ['icon'=>'🏠','label'=>'Rent',         'color'=>'#84CC16','bg'=>'rgba(132,204,22,.15)'],
        'payroll'      => ['icon'=>'💼','label'=>'Payroll',      'color'=>'#3B82F6','bg'=>'rgba(59,130,246,.15)'],
        'subscription' => ['icon'=>'🔁','label'=>'Subscription', 'color'=>'#A78BFA','bg'=>'rgba(167,139,250,.15)'],
        'supplies'     => ['icon'=>'📦','label'=>'Supplies',     'color'=>'#F59E0B','bg'=>'rgba(245,158,11,.15)'],
        'maintenance'  => ['icon'=>'🔧','label'=>'Maintenance',  'color'=>'#6B7280','bg'=>'rgba(107,114,128,.15)'],
        'banking'      => ['icon'=>'🏦','label'=>'Banking',      'color'=>'#10B981','bg'=>'rgba(16,185,129,.15)'],
        'general'      => ['icon'=>'📌','label'=>'General',      'color'=>'#94A3B8','bg'=>'rgba(148,163,184,.15)'],
    ];

    // ── Bill status overlays (applied ON TOP of category) ───────────────────
    private static array $BILL_STATUS = [
        'paid'    => ['icon'=>'✅','color'=>'#22C55E','bg'=>'rgba(34,197,94,.12)',  'tone'=>'success'],
        'overdue' => ['icon'=>'🚨','color'=>'#EF4444','bg'=>'rgba(239,68,68,.12)',  'tone'=>'danger'],
        'pending' => ['icon'=>'⏳','color'=>'#F59E0B','bg'=>'rgba(245,158,11,.12)', 'tone'=>'warning'],
        'due_today' => ['icon'=>'⏰','color'=>'#F97316','bg'=>'rgba(249,115,22,.15)','tone'=>'warning'],
    ];

    // ── Task state icons ─────────────────────────────────────────────────────
    private static array $TASK_STATE = [
        'overdue'    => ['icon'=>'🚨','color'=>'#EF4444','bg'=>'rgba(239,68,68,.12)',  'tone'=>'danger',  'label'=>'Overdue'],
        'due_today'  => ['icon'=>'⏰','color'=>'#F97316','bg'=>'rgba(249,115,22,.14)', 'tone'=>'warning', 'label'=>'Due Today'],
        'due_week'   => ['icon'=>'📅','color'=>'#F59E0B','bg'=>'rgba(245,158,11,.12)', 'tone'=>'caution', 'label'=>'Due This Week'],
        'completed'  => ['icon'=>'✅','color'=>'#22C55E','bg'=>'rgba(34,197,94,.12)',  'tone'=>'success', 'label'=>'Completed'],
        'in_progress'=> ['icon'=>'🔵','color'=>'#3B82F6','bg'=>'rgba(59,130,246,.12)','tone'=>'info',    'label'=>'In Progress'],
        'recurring'  => ['icon'=>'🔄','color'=>'#8B5CF6','bg'=>'rgba(139,92,246,.12)','tone'=>'info',    'label'=>'Recurring'],
        'upcoming'   => ['icon'=>'📌','color'=>'#94A3B8','bg'=>'rgba(148,163,184,.1)','tone'=>'neutral', 'label'=>'Upcoming'],
    ];

    // ── Risk states ─────────────────────────────────────────────────────────
    private static array $RISK = [
        'stable'   => ['icon'=>'✅','label'=>'Stable',   'color'=>'#22C55E','bg'=>'rgba(34,197,94,.12)',  'tone'=>'success'],
        'watch'    => ['icon'=>'👀','label'=>'Watch',    'color'=>'#F59E0B','bg'=>'rgba(245,158,11,.12)', 'tone'=>'caution'],
        'behind'   => ['icon'=>'⚠️','label'=>'Behind',  'color'=>'#F97316','bg'=>'rgba(249,115,22,.12)', 'tone'=>'warning'],
        'critical' => ['icon'=>'🚨','label'=>'Critical', 'color'=>'#EF4444','bg'=>'rgba(239,68,68,.12)',  'tone'=>'danger'],
    ];

    // ── Business health ──────────────────────────────────────────────────────
    private static array $BIZ_HEALTH = [
        'healthy'  => ['icon'=>'🟢','label'=>'Healthy',  'color'=>'#22C55E','bg'=>'rgba(34,197,94,.1)',  'tone'=>'success'],
        'watch'    => ['icon'=>'🟡','label'=>'Watch',    'color'=>'#F59E0B','bg'=>'rgba(245,158,11,.1)', 'tone'=>'caution'],
        'at_risk'  => ['icon'=>'🟠','label'=>'At Risk',  'color'=>'#F97316','bg'=>'rgba(249,115,22,.1)', 'tone'=>'warning'],
        'critical' => ['icon'=>'🔴','label'=>'Critical', 'color'=>'#EF4444','bg'=>'rgba(239,68,68,.1)',  'tone'=>'danger'],
    ];

    // ── Smart suggestion types ───────────────────────────────────────────────
    private static array $SUGGESTION = [
        'reassign'    => ['icon'=>'🔄','color'=>'#8B5CF6','tone'=>'info'],
        'urgent'      => ['icon'=>'🚨','color'=>'#EF4444','tone'=>'danger'],
        'warning'     => ['icon'=>'⚠️','color'=>'#F59E0B','tone'=>'warning'],
        'next_action' => ['icon'=>'👉','color'=>'#3B82F6','tone'=>'info'],
        'rebalance'   => ['icon'=>'⇄', 'color'=>'#8B5CF6','tone'=>'info'],
        'insight'     => ['icon'=>'🧠','color'=>'#A78BFA','tone'=>'info'],
        'overload'    => ['icon'=>'🔥','color'=>'#EF4444','tone'=>'danger'],
        'capacity'    => ['icon'=>'⚡','color'=>'#22C55E','tone'=>'success'],
        'finance'     => ['icon'=>'💳','color'=>'#F59E0B','tone'=>'warning'],
    ];

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Icon + tone for a bill row.
     * Merges category icon with status overlay (status takes precedence for color/tone).
     */
    public static function forBill(array $bill): array
    {
        $cat    = $bill['category'] ?? 'general';
        $status = $bill['status']   ?? 'pending';
        $today  = date('Y-m-d');
        $due    = $bill['due_date'] ?? null;

        $base  = self::$BILL_CATEGORY[$cat] ?? self::$BILL_CATEGORY['general'];
        $state = $status === 'paid' ? self::$BILL_STATUS['paid']
               : ($status === 'overdue' || ($due && $due < $today) ? self::$BILL_STATUS['overdue']
               : ($due && $due === $today ? self::$BILL_STATUS['due_today']
               : self::$BILL_STATUS['pending']));

        return [
            'icon'   => $base['icon'],           // category icon (never changes)
            'status_icon' => $state['icon'],      // state icon (paid/overdue/etc)
            'label'  => $base['label'],
            'color'  => $state['color'],          // state-driven colour
            'bg'     => $state['bg'],
            'tone'   => $state['tone'],
            'class'  => 'ip-bill-' . str_replace('_','-',$cat),
            'cat_color' => $base['color'],        // original category colour
            'cat_bg'    => $base['bg'],
        ];
    }

    /**
     * Icon + tone for a task row.
     * Computes temporal state from due_date / is_completed / status.
     */
    public static function forTask(array $task): array
    {
        $today    = date('Y-m-d');
        $due      = $task['due_date'] ?? null;
        $done     = !empty($task['is_completed']) && (int)$task['is_completed'];
        $status   = $task['status'] ?? 'todo';
        $priority = $task['priority'] ?? 'medium';

        if ($done) {
            $state = self::$TASK_STATE['completed'];
        } elseif ($due && $due < $today) {
            $state = self::$TASK_STATE['overdue'];
        } elseif ($due && $due === $today) {
            $state = self::$TASK_STATE['due_today'];
        } elseif ($due && $due <= date('Y-m-d', strtotime('+7 days'))) {
            $state = self::$TASK_STATE['due_week'];
        } elseif ($status === 'in_progress') {
            $state = self::$TASK_STATE['in_progress'];
        } else {
            $state = self::$TASK_STATE['upcoming'];
        }

        // Priority amplifier
        $priorityColor = match($priority) {
            'urgent' => '#EF4444',
            'high'   => '#F97316',
            'medium' => '#F59E0B',
            default  => '#94A3B8',
        };

        return array_merge($state, [
            'priority'       => $priority,
            'priority_color' => $priorityColor,
            'class'          => 'ip-task-' . $state['tone'],
        ]);
    }

    /**
     * Icon + tone for a team member risk level.
     */
    public static function forUserRisk(string $riskLevel): array
    {
        $base = self::$RISK[$riskLevel] ?? self::$RISK['stable'];
        return array_merge($base, ['class' => 'ip-risk-' . $riskLevel]);
    }

    /**
     * Icon + tone for business health.
     * Health is derived from overdue bill count + overdue task count.
     */
    public static function forBusinessHealth(int $overdueCount, int $overdueTasks = 0): array
    {
        $total = $overdueCount + $overdueTasks;
        if ($total === 0) $level = 'healthy';
        elseif ($total <= 2) $level = 'watch';
        elseif ($total <= 5) $level = 'at_risk';
        else $level = 'critical';

        $base = self::$BIZ_HEALTH[$level];
        return array_merge($base, [
            'level' => $level,
            'class' => 'ip-biz-' . str_replace('_','-',$level),
        ]);
    }

    /**
     * Icon + tone for a smart suggestion item.
     */
    public static function forSuggestion(string $type): array
    {
        $base = self::$SUGGESTION[$type] ?? self::$SUGGESTION['insight'];
        return array_merge($base, ['class' => 'ip-sug-' . $type]);
    }

    /**
     * Convenience: render an inline chip/badge HTML string.
     * Usage: echo IconPresenter::chip(IconPresenter::forUserRisk('critical'));
     */
    public static function chip(array $ip, string $text = ''): string
    {
        $label = $text ?: ($ip['label'] ?? '');
        return sprintf(
            '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:%s;color:%s">%s %s</span>',
            $ip['bg'], $ip['color'], $ip['icon'], htmlspecialchars($label, ENT_QUOTES, 'UTF-8')
        );
    }

    /**
     * Convenience: CSS border-left shorthand for risk/status card emphasis.
     */
    public static function borderAccent(array $ip): string
    {
        return 'border-left: 3px solid ' . $ip['color'] . ';';
    }
}
