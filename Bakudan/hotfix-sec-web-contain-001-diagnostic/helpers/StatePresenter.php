<?php
/**
 * StatePresenter — Visual Emphasis System
 *
 * Computes the full visual state for any entity:
 * card tone, badge style, CTA prominence, border weight.
 *
 * Works alongside IconPresenter — IconPresenter gives you the icon+colour,
 * StatePresenter gives you the layout emphasis (how BIG and LOUD the signal is).
 */
class StatePresenter
{
    // Emphasis levels (drive CSS class selection)
    const EMPHASIS_NONE     = 0;  // muted, low priority
    const EMPHASIS_LOW      = 1;  // subtle accent
    const EMPHASIS_MEDIUM   = 2;  // visible but not alarming
    const EMPHASIS_HIGH     = 3;  // clear warning
    const EMPHASIS_CRITICAL = 4;  // full alert

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Full visual state for a bill row.
     * Drives: card border, badge colour, CTA button style, amount display.
     */
    public static function forBill(array $bill): array
    {
        $today    = date('Y-m-d');
        $due      = $bill['due_date'] ?? null;
        $status   = $bill['status'] ?? 'pending';
        $amount   = (float)($bill['amount'] ?? 0);

        if ($status === 'paid') {
            return self::build(self::EMPHASIS_NONE, '#22C55E', 'paid', 'btn-success-muted', false);
        }

        $overdue = $due && $due < $today;
        $dueToday = $due && $due === $today;
        $dueSoon  = $due && $due <= date('Y-m-d', strtotime('+3 days')) && !$overdue;

        if ($overdue && $amount > 5000) {
            return self::build(self::EMPHASIS_CRITICAL, '#EF4444', 'overdue-high-amount', 'btn-danger-strong', true);
        }
        if ($overdue) {
            return self::build(self::EMPHASIS_HIGH, '#EF4444', 'overdue', 'btn-danger', true);
        }
        if ($dueToday) {
            return self::build(self::EMPHASIS_HIGH, '#F97316', 'due-today', 'btn-warning-strong', true);
        }
        if ($dueSoon) {
            return self::build(self::EMPHASIS_MEDIUM, '#F59E0B', 'due-soon', 'btn-warning', false);
        }
        return self::build(self::EMPHASIS_LOW, '#3B82F6', 'upcoming', 'btn-default', false);
    }

    /**
     * Full visual state for a task row.
     */
    public static function forTask(array $task): array
    {
        $today    = date('Y-m-d');
        $due      = $task['due_date'] ?? null;
        $done     = (int)($task['is_completed'] ?? 0);
        $priority = $task['priority'] ?? 'medium';
        $status   = $task['status'] ?? 'todo';

        if ($done) {
            return self::build(self::EMPHASIS_NONE, '#22C55E', 'completed', 'btn-success-muted', false);
        }

        $overdue = $due && $due < $today;
        $urgent  = in_array($priority, ['urgent','high']);

        if ($overdue && $urgent) {
            return self::build(self::EMPHASIS_CRITICAL, '#EF4444', 'overdue-urgent', 'btn-danger-strong', true);
        }
        if ($overdue) {
            return self::build(self::EMPHASIS_HIGH, '#EF4444', 'overdue', 'btn-danger', true);
        }
        if ($due === $today) {
            return self::build(self::EMPHASIS_HIGH, '#F97316', 'due-today', 'btn-warning-strong', true);
        }
        if ($urgent) {
            return self::build(self::EMPHASIS_MEDIUM, '#F59E0B', 'urgent', 'btn-warning', false);
        }
        if ($status === 'in_progress') {
            return self::build(self::EMPHASIS_LOW, '#3B82F6', 'in-progress', 'btn-info', false);
        }
        return self::build(self::EMPHASIS_NONE, '#94A3B8', 'upcoming', 'btn-default', false);
    }

    /**
     * Full visual state for a team member based on risk level and overdue count.
     */
    public static function forMember(array $member): array
    {
        $risk    = $member['risk'] ?? 'stable';
        $overdue = (int)($member['overdue'] ?? 0);

        $emphasis = match(true) {
            $risk === 'critical' || $overdue > 5 => self::EMPHASIS_CRITICAL,
            $risk === 'behind'   || $overdue > 2 => self::EMPHASIS_HIGH,
            $risk === 'watch'    || $overdue > 0 => self::EMPHASIS_MEDIUM,
            default                              => self::EMPHASIS_NONE,
        };

        $color = match($risk) {
            'critical' => '#EF4444',
            'behind'   => '#F97316',
            'watch'    => '#F59E0B',
            default    => '#22C55E',
        };

        $cta = match(true) {
            $emphasis >= self::EMPHASIS_HIGH     => 'btn-danger',
            $emphasis === self::EMPHASIS_MEDIUM  => 'btn-warning',
            default                              => 'btn-default',
        };

        return self::build($emphasis, $color, $risk, $cta, $emphasis >= self::EMPHASIS_HIGH);
    }

    /**
     * Full visual state for business health.
     */
    public static function forBusiness(int $overdueCount): array
    {
        if ($overdueCount === 0) {
            return self::build(self::EMPHASIS_NONE, '#22C55E', 'healthy', 'btn-default', false);
        }
        if ($overdueCount <= 2) {
            return self::build(self::EMPHASIS_LOW, '#F59E0B', 'watch', 'btn-warning', false);
        }
        if ($overdueCount <= 5) {
            return self::build(self::EMPHASIS_HIGH, '#F97316', 'at-risk', 'btn-warning-strong', true);
        }
        return self::build(self::EMPHASIS_CRITICAL, '#EF4444', 'critical', 'btn-danger-strong', true);
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a standardised state array.
     */
    private static function build(int $emphasis, string $color, string $state, string $ctaClass, bool $highlight): array
    {
        $alpha = match($emphasis) {
            self::EMPHASIS_CRITICAL => '.18',
            self::EMPHASIS_HIGH     => '.14',
            self::EMPHASIS_MEDIUM   => '.10',
            self::EMPHASIS_LOW      => '.07',
            default                 => '.04',
        };

        $borderWidth = match($emphasis) {
            self::EMPHASIS_CRITICAL => '4px',
            self::EMPHASIS_HIGH     => '3px',
            self::EMPHASIS_MEDIUM   => '2px',
            default                 => '1px',
        };

        // Parse hex to rgb for rgba()
        $hex = ltrim($color, '#');
        $r = hexdec(substr($hex,0,2));
        $g = hexdec(substr($hex,2,2));
        $b = hexdec(substr($hex,4,2));

        return [
            'emphasis'      => $emphasis,
            'color'         => $color,
            'bg'            => "rgba({$r},{$g},{$b},{$alpha})",
            'border_color'  => $color,
            'border_width'  => $borderWidth,
            'border_style'  => "border-left: {$borderWidth} solid {$color};",
            'state'         => $state,
            'cta_class'     => $ctaClass,
            'highlight'     => $highlight,
            'glow'          => $highlight ? "box-shadow: 0 0 0 1px {$color}33;" : '',
            'row_bg'        => $highlight ? "background: rgba({$r},{$g},{$b},.03);" : '',
        ];
    }

    // ── CSS utility ──────────────────────────────────────────────────────────

    /**
     * Inline style string for a card/row with full emphasis treatment.
     */
    public static function cardStyle(array $state): string
    {
        return $state['border_style'] . ' ' . $state['row_bg'] . ' ' . $state['glow'];
    }

    /**
     * CSS class list for a CTA button based on state.
     * Maps internal class names to app button classes.
     */
    public static function ctaClass(array $state): string
    {
        return match($state['cta_class']) {
            'btn-danger-strong' => 'btn btn-danger fw-700',
            'btn-danger'        => 'btn btn-danger',
            'btn-warning-strong'=> 'btn btn-warning fw-700',
            'btn-warning'       => 'btn btn-warning',
            'btn-info'          => 'btn btn-info',
            'btn-success-muted' => 'btn btn-success btn-muted',
            default             => 'btn btn-secondary',
        };
    }
}
