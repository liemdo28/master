<?php
/**
 * Decision Engine V3 — Configuration
 *
 * Controls how problems are detected, scored, and ranked.
 * All weights should sum to 1.0 within each group.
 */
return [

    // ── Plan comparison dimension weights ─────────────────────────────────────
    // Used by SmartEngine::comparePlans() to produce a single total_score.
    'plan_weights' => [
        'risk_reduction' => 0.35,   // How much does this plan reduce overdue/risk?
        'safety'         => 0.25,   // Does it overload anyone downstream?
        'speed'          => 0.15,   // How quickly can it be actioned?
        'simplicity'     => 0.10,   // One action vs many — simpler wins on trust
        'confidence'     => 0.15,   // How strong is the evidence?
    ],

    // ── Problem ranking weights ───────────────────────────────────────────────
    // Used by SmartEngine::rankProblems() to sort detected problems.
    'rank_weights' => [
        'impact_score'  => 0.40,   // Raw calculated impact (overdue count × multiplier)
        'urgency'       => 0.35,   // How time-sensitive?  immediate > today > week
        'business_scope'=> 0.25,   // How many businesses/stores are affected?
    ],

    // ── Urgency → numeric score mapping ──────────────────────────────────────
    'urgency_scores' => [
        'immediate' => 100,
        'today'     => 70,
        'week'      => 40,
        'monitor'   => 10,
    ],

    // ── Risk level → numeric score mapping ───────────────────────────────────
    'risk_scores' => [
        'critical' => 100,
        'high'     => 70,
        'medium'   => 40,
        'low'      => 10,
    ],

    // ── Problem detection thresholds ─────────────────────────────────────────
    'thresholds' => [
        // overload: flag a user as overloaded when…
        'overload_overdue_min'  => 2,    // …they have ≥ N overdue tasks
        'overload_open_min'     => 10,   // …OR ≥ N open tasks total
        'overload_both_min'     => 1,    // …OR ≥ N overdue AND load_score ≥ threshold

        // store risk: flag a store when…
        'store_overdue_min'     => 2,    // …it has ≥ N overdue tasks

        // throughput: flag team velocity when…
        'throughput_pct_max'    => 50,   // …on-time rate drops below N%
        'throughput_sample_min' => 5,    // …with at least N completed tasks (avoid noise)

        // impact multipliers per problem type
        'impact_overload_ov'    => 12,   // overdue × this
        'impact_overload_open'  => 3,    // open × this
        'impact_overload_store' => 5,    // stores_affected × this
        'impact_store_ov'       => 10,   // store overdue × this
        'impact_store_proj'     => 5,    // store projects × this
        'impact_bill_ov'        => 15,   // overdue bills × this
        'impact_bill_amount'    => 0.01, // amount × this (cents → points)
        'impact_throughput'     => 2,    // (50 - pct) × this
    ],

];
