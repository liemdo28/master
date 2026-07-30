<?php
/**
 * Autonomy Engine V5 — Policy Configuration
 *
 * Controls exactly when the system may execute autonomously,
 * when it must ask for human approval, and when it must block.
 *
 * All thresholds are tunable here — no code change needed.
 */
return [

    // ── Confidence thresholds ─────────────────────────────────────────────────
    'thresholds' => [
        'auto_confidence_min'           => 0.85,  // auto-execute above this
        'approval_confidence_min'       => 0.60,  // approval required above this
        // below approval_confidence_min → BLOCK

        'max_auto_tasks_moved'          => 2,     // max tasks moved without approval
        'max_auto_risk_reduction_delta' => 0.30,  // max risk delta for auto (30%)
        'max_auto_financial_amount'     => 0,     // no financial auto-execution (0 = disabled)

        'destination_max_risk_for_auto' => 'stable', // destination must be stable for auto
        // 'watch' or better for approval; anything worse → block
    ],

    // ── Category rules ────────────────────────────────────────────────────────
    // false = category always requires approval (never auto)
    'rules' => [
        'allow_auto_rebalance'           => true,   // task reassignment (low scope only)
        'allow_auto_finance'             => false,  // NEVER auto-execute financial actions
        'allow_auto_cross_business'      => false,  // NEVER auto-execute cross-business moves
        'allow_auto_if_destination_watch'=> false,  // destination must be stable, not watch
        'require_approval_all_finance'   => true,   // all finance decisions need human approval
        'block_if_no_safe_destination'   => true,   // block rebalance if no clear destination
        'block_if_prediction_missing'    => true,   // block if prediction data is absent
        'notify_after_auto_action'       => true,   // notify CEO after every auto action
    ],

    // ── Business hours gate (optional) ────────────────────────────────────────
    // If enabled, auto-execution only happens during business hours.
    'business_hours' => [
        'enabled'    => false,          // set true to restrict auto to business hours
        'start_hour' => 8,              // 08:00 local time
        'end_hour'   => 18,             // 18:00 local time
        'timezone'   => 'America/Los_Angeles',
    ],

    // ── Non-negotiable hard blocks (never auto, always blocked or approval) ───
    'hard_blocks' => [
        'payments',         // any bill payment action
        'payroll',          // any payroll-related action
        'vendor_contract',  // vendor relationship changes
        'cross_business_high_impact', // large cross-business moves
    ],
];
