<?php
/**
 * SmartEngine V2 — Configurable Weights & Scoring Parameters
 *
 * Tune these values without touching engine logic.
 * All weights are additive integer points unless noted.
 */
return [

    // ──────────────────────────────────────────────────────────────
    // BASE ITEM SCORES — applied before role multipliers
    // ──────────────────────────────────────────────────────────────
    'base' => [
        'overdue'           => 100,   // item is past due_date
        'overdue_per_day'   => 0.10,  // amplifier: +10% per day late (cap: 2.0×)
        'overdue_day_cap'   => 2.0,   // max multiplier for overdue amplification
        'due_today'         => 70,
        'due_3_days'        => 50,
        'due_7_days'        => 20,
        'is_bill'           => 25,    // any bill item gets this bonus
        'amount_gt_1000'    => 15,    // bill/payment amount > $1000
        'amount_gt_5000'    => 25,    // bill/payment amount > $5000
        'biz_critical'      => 25,    // business flagged as critical
        'overload_user'     => 15,    // assignee has ≥5 overdue tasks
        'recurring'         => 5,     // recurring bill/task
        'priority_urgent'   => 1.20,  // urgency multiplier (×)
        'priority_high'     => 1.10,
        'priority_medium'   => 1.00,
        'priority_low'      => 0.90,
        'blocking'          => 20,    // task blocks other tasks
        'quick_win'         => 15,    // task is a quick win
    ],

    // ──────────────────────────────────────────────────────────────
    // ROLE OVERRIDES — replace specific base weights for each role
    // Keys must exist in 'base'. Omit key to inherit base value.
    // ──────────────────────────────────────────────────────────────
    'role' => [
        'admin' => [
            'is_bill'       => 25,
            'amount_gt_1000'=> 20,
            'biz_critical'  => 30,
            'overload_user' => 15,
        ],
        'manager' => [
            'is_bill'       => 15,
            'amount_gt_1000'=> 10,
            'biz_critical'  => 20,
            'overload_user' => 30,   // managers care more about team overload
        ],
        'staff' => [
            'is_bill'       => 5,
            'amount_gt_1000'=> 5,
            'biz_critical'  => 10,
            'overload_user' => 0,    // staff don't see team-level overload items
        ],
    ],

    // ──────────────────────────────────────────────────────────────
    // BUSINESS PRIORITY WEIGHTS — boosts items belonging to priority stores
    // Set store name patterns → bonus points
    // ──────────────────────────────────────────────────────────────
    'business' => [
        'high_priority_bonus'   => 20,
        'critical_bonus'        => 35,
        // Stores matching these patterns get high_priority_bonus
        'priority_store_names'  => [],   // e.g. ['Bakudan Bandera', 'Raw Stockton']
    ],

    // ──────────────────────────────────────────────────────────────
    // LOAD SCORE ENGINE
    // ──────────────────────────────────────────────────────────────
    'load' => [
        'open_task_weight'    => 2,
        'overdue_weight'      => 10,
        'due_week_weight'     => 4,
        'on_time_divisor'     => 5,    // subtract on_time_pct / this value
        'urgent_weight'       => 6,    // urgent open tasks
        'biz_impact_weight'   => 12,   // each impacted business adds this
        // Load band thresholds
        'band_watch'          => 25,   // load_score >= this → 'watch'
        'band_behind'         => 50,   // load_score >= this → 'behind'
        'band_critical'       => 75,   // load_score >= this → 'critical'
    ],

    // ──────────────────────────────────────────────────────────────
    // BUSINESS RISK SCORE
    // ──────────────────────────────────────────────────────────────
    'business_risk' => [
        'overdue_bill_weight'       => 15,
        'overdue_task_weight'       => 10,
        'unpaid_amount_divisor'     => 1000,  // $1000 unpaid = +1 point
        'unpaid_amount_cap'         => 30,    // max points from amount
        'overloaded_member_weight'  => 12,
        // Risk band thresholds
        'band_watch'                => 20,
        'band_high'                 => 45,
        'band_critical'             => 70,
    ],

    // ──────────────────────────────────────────────────────────────
    // WORKLOAD BALANCER
    // ──────────────────────────────────────────────────────────────
    'balancer' => [
        'overload_overdue_threshold' => 3,    // member becomes candidate if overdue >= this
        'overload_load_threshold'    => 50,   // OR load_score >= this
        'destination_headroom'       => 15,   // destination load_score must stay below (source - this)
        'familiarity_bonus'          => 20,   // same business → destination preference bonus
        'same_type_bonus'            => 10,   // same task category
        'max_task_move_per_action'   => 5,    // max tasks to move in single recommendation
    ],

    // ──────────────────────────────────────────────────────────────
    // CONFIDENCE SCORING
    // ──────────────────────────────────────────────────────────────
    'confidence' => [
        'base'                => 0.50,
        'overdue_boost'       => 0.20,   // each overdue item
        'high_amount_boost'   => 0.10,
        'biz_critical_boost'  => 0.10,
        'today_boost'         => 0.15,
        'max'                 => 1.00,
        'min'                 => 0.10,
    ],

    // ──────────────────────────────────────────────────────────────
    // QUICK WINS — criteria for "easy high-value" detection
    // ──────────────────────────────────────────────────────────────
    'quick_wins' => [
        'max_overdue_days'  => 3,    // not deeply overdue
        'min_priority'      => 'medium',
        'due_within_days'   => 7,
        'limit'             => 5,
    ],

    // ──────────────────────────────────────────────────────────────
    // THROUGHPUT AWARENESS
    // ──────────────────────────────────────────────────────────────
    'throughput' => [
        'lookback_days'     => 7,
        'slow_threshold'    => 2,    // completed < this in lookback → "slow"
        'fast_threshold'    => 10,   // completed >= this → "fast"
    ],

    // ──────────────────────────────────────────────────────────────
    // ADAPTIVE WEIGHT AMPLIFICATION triggers
    // ──────────────────────────────────────────────────────────────
    'adaptive' => [
        'bill_crisis_threshold'     => 5,    // overdue bills >= this → amplify bill weights
        'bill_amplifier'            => 1.5,
        'bill_max'                  => 50,
        'task_crisis_threshold'     => 10,   // overdue tasks >= this → amplify overdue weight
        'task_amplifier'            => 1.25,
        'task_max'                  => 150,
        'overload_count_threshold'  => 2,    // overloaded users >= this → amplify overload weight
        'overload_amplifier'        => 1.5,
        'overload_max'              => 50,
    ],

];
