<?php
/**
 * SmartEngine V2 — Adaptive Scoring, Workload Balancing & Action Intelligence
 *
 * Converts raw DB data into ranked, role-aware action items with confidence
 * scores, reassignment intelligence, and chained next-best-action guidance.
 *
 * Architecture sections:
 *   1. Constructor / Config
 *   2. Public API (compute, topActions, brief, nextBestAction, nextBestActionChain)
 *   3. Scoring  (calculateScore, urgencyBucket, taskScore, billScore)
 *   4. Load Score Engine  (memberLoadScore, businessRiskScore)
 *   5. Workload Balancer  (reassignmentCandidates, bestDestinationUser, previewRebalance)
 *   6. Action Intelligence (nextActions, quickWins, staffQueue, teamSummary, teamInsights)
 *   7. Confidence Scoring
 *   8. Adaptive Weights
 *   9. Data Fetching (fetchItems, fetchBills, fetchTasks)
 *  10. Insight + Suggestion Generation
 *  11. Decision Intelligence (detectProblems, rankProblems, comparePlans, quickWin)
 *
 * Usage:
 *   $engine = new SmartEngine($userId, $role);
 *   $engine->adaptWeightsToContext();            // optional: boost weights for current crisis
 *   $result = $engine->compute();                // ['actions','insights','suggestions','groups']
 *   $chain  = $engine->nextBestActionChain(3);   // top-3 with reason + confidence
 *   $team   = $engine->teamSummary();            // structured team risk overview
 */
class SmartEngine
{
    private $db;
    private int $userId;
    private string $role;
    private string $today;
    private string $weekEnd;
    private array  $cfg;           // full config from smart_engine.php
    private array  $weights;       // merged base+role weights (mutable for adapt)
    private ?array $computed = null;

    // =========================================================================
    // 1. CONSTRUCTOR / CONFIG
    // =========================================================================

    public function __construct(int $userId, string $role = 'staff')
    {
        $this->db      = Database::getInstance();
        $this->userId  = $userId;
        $this->role    = in_array($role, ['admin','manager','staff']) ? $role : 'staff';
        $this->today   = app_today();
        $this->weekEnd = date('Y-m-d', strtotime($this->today . ' +7 days'));

        // Load config
        $cfgPath = __DIR__ . '/../config/smart_engine.php';
        $this->cfg = file_exists($cfgPath) ? require $cfgPath : [];
        $this->weights = $this->buildWeights($this->role);
    }

    /** Merge base weights with role overrides */
    private function buildWeights(string $role): array
    {
        $base = $this->cfg['base'] ?? [];
        $over = $this->cfg['role'][$role] ?? [];
        return array_merge($base, $over);
    }

    // =========================================================================
    // 2. PUBLIC API
    // =========================================================================

    /** Returns ['actions','insights','suggestions','groups'] */
    public function compute(): array
    {
        if ($this->computed !== null) return $this->computed;

        $rawItems    = $this->fetchItems();
        $scored      = $this->scoreAll($rawItems);
        $insights    = $this->generateInsights($scored, $rawItems);
        $suggestions = $this->generateSuggestions($insights);

        $this->computed = [
            'actions'     => $scored,
            'insights'    => $insights,
            'suggestions' => $suggestions,
            'groups'      => $this->groupByUrgency($scored),
        ];
        return $this->computed;
    }

    /** Top N action items */
    public function topActions(int $n = 5): array
    {
        return array_slice($this->compute()['actions'], 0, $n);
    }

    /** One-sentence brief for dashboard header */
    public function brief(): string
    {
        $data    = $this->compute();
        $actions = $data['actions'];
        $overdue = array_filter($actions, fn($a) => $a['urgency'] === 'overdue');
        $today_  = array_filter($actions, fn($a) => $a['urgency'] === 'today');
        $total   = count($actions);

        if (empty($actions)) return 'All clear — no urgent items today.';

        $parts = [];
        if (count($overdue) > 0) {
            $amt = array_sum(array_column(
                array_filter($overdue, fn($a) => $a['type'] === 'bill'),
                'amount'
            ));
            $parts[] = count($overdue) . ' overdue' . ($amt > 0 ? ' ($' . number_format($amt, 0) . ' unpaid)' : '');
        }
        if (count($today_) > 0) $parts[] = count($today_) . ' due today';
        if (empty($parts) && $total > 0)
            $parts[] = $total . ' item' . ($total > 1 ? 's' : '') . ' need attention';

        return 'You have ' . implode(', ', $parts) . '.';
    }

    /** Single highest-impact item */
    public function nextBestAction(): ?array
    {
        $data = $this->compute();
        return $data['actions'][0] ?? null;
    }

    /**
     * Action chain — top N sequential actions with "why" context + confidence.
     */
    public function nextBestActionChain(int $n = 3): array
    {
        $actions = array_slice($this->compute()['actions'], 0, $n);
        $chain   = [];
        $step    = 1;

        foreach ($actions as $a) {
            $reason = $this->buildReason($a);
            $conf   = $this->confidenceScore($a);

            $chain[] = [
                'step'        => $step++,
                'type'        => $a['type'],
                'title'       => $a['title'],
                'reason'      => $reason,
                'url'         => $a['url'],
                'action_text' => $a['action_text'],
                'urgency'     => $a['urgency'],
                'score'       => $a['score'],
                'confidence'  => $conf,
                'conf_label'  => $this->confidenceLabel($conf),
                'business'    => $a['business_name'] ?? '',
                'amount'      => (float)($a['amount'] ?? 0),
                'icon'        => $this->itemIcon($a),
                'color'       => $this->itemColor($a),
            ];
        }

        return $chain;
    }

    /**
     * Post-action next steps — call after completing an action to get refreshed chain.
     * $context: ['type' => 'bill_paid'|'task_done'|'reassigned', 'id' => ...]
     */
    public function nextActions(array $context = []): array
    {
        $this->computed = null; // force re-compute with fresh data
        $chain = $this->nextBestActionChain(3);

        // Add context-aware framing
        $intro = '';
        switch ($context['type'] ?? '') {
            case 'bill_paid':
                $intro = 'Bill paid. Here is what remains:';
                break;
            case 'task_done':
                $intro = 'Task complete. Next priorities:';
                break;
            case 'reassigned':
                $intro = 'Tasks reassigned. Check remaining risk:';
                break;
            default:
                $intro = 'Next recommended actions:';
        }

        return ['intro' => $intro, 'actions' => $chain];
    }

    // =========================================================================
    // 3. SCORING
    // =========================================================================

    private function scoreAll(array $items): array
    {
        foreach ($items as &$item) {
            $item['score'] = $this->calculateScore($item);
        }
        unset($item);
        usort($items, fn($a, $b) => $b['score'] - $a['score']);
        return $items;
    }

    private function calculateScore(array $item): int
    {
        $w     = $this->weights;
        $score = 0;
        $d     = $item['due_date'] ? substr($item['due_date'], 0, 10) : null;

        // Overdue — amplified by days late
        if ($item['urgency'] === 'overdue') {
            $daysLate  = $d ? max(0, (int)((strtotime($this->today) - strtotime($d)) / 86400)) : 0;
            $perDay    = (float)($w['overdue_per_day'] ?? 0.10);
            $cap       = (float)($w['overdue_day_cap'] ?? 2.0);
            $amplifier = min($cap, 1.0 + ($daysLate * $perDay));
            $score    += (int)(($w['overdue'] ?? 100) * $amplifier);
        }

        if ($d === $this->today)                                        $score += (int)($w['due_today']  ?? 70);
        elseif ($d && $d <= date('Y-m-d', strtotime('+3 days')))       $score += (int)($w['due_3_days'] ?? 50);
        elseif ($d && $d <= $this->weekEnd)                            $score += (int)($w['due_7_days'] ?? 20);

        if ($item['type'] === 'bill')                                   $score += (int)($w['is_bill']       ?? 25);
        if ((float)($item['amount'] ?? 0) > 5000)                      $score += (int)($w['amount_gt_5000'] ?? 25);
        elseif ((float)($item['amount'] ?? 0) > 1000)                  $score += (int)($w['amount_gt_1000'] ?? 15);
        if (!empty($item['biz_critical']))                              $score += (int)($w['biz_critical']   ?? 25);
        if (!empty($item['user_overloaded']))                           $score += (int)($w['overload_user']  ?? 15);
        if (!empty($item['recurring']))                                 $score += (int)($w['recurring']      ?? 5);
        if (!empty($item['blocking']))                                  $score += (int)($w['blocking']       ?? 20);
        if (!empty($item['quick_win']))                                 $score += (int)($w['quick_win']      ?? 15);

        // Business priority bonus
        $bizBonus = $this->businessPriorityBonus($item['business_name'] ?? '', $item['biz_critical'] ?? false);
        $score += $bizBonus;

        // Priority multiplier
        $prio       = $item['priority'] ?? 'medium';
        $multiplier = (float)($w['priority_' . $prio] ?? 1.0);
        $score      = (int)($score * $multiplier);

        return max(0, $score);
    }

    /** Public: score a single task for a given role */
    public function taskScore(array $task, string $role = ''): int
    {
        if ($role && $role !== $this->role) {
            $oldRole = $this->role;
            $this->role    = $role;
            $this->weights = $this->buildWeights($role);
            $task['type']     = 'task';
            $task['urgency']  = $this->urgencyBucket($task);
            $s = $this->calculateScore($task);
            $this->role    = $oldRole;
            $this->weights = $this->buildWeights($oldRole);
            return $s;
        }
        $task['type']    = $task['type'] ?? 'task';
        $task['urgency'] = $this->urgencyBucket($task);
        return $this->calculateScore($task);
    }

    /** Public: score a single bill for a given role */
    public function billScore(array $bill, string $role = ''): int
    {
        if ($role && $role !== $this->role) {
            $oldRole = $this->role;
            $this->role    = $role;
            $this->weights = $this->buildWeights($role);
            $bill['type']     = 'bill';
            $bill['urgency']  = $this->urgencyBucket($bill);
            $s = $this->calculateScore($bill);
            $this->role    = $oldRole;
            $this->weights = $this->buildWeights($oldRole);
            return $s;
        }
        $bill['type']    = $bill['type'] ?? 'bill';
        $bill['urgency'] = $this->urgencyBucket($bill);
        return $this->calculateScore($bill);
    }

    private function urgencyBucket(array $item): string
    {
        $d = $item['due_date'] ? substr($item['due_date'], 0, 10) : null;
        if (!$d || ($item['status'] ?? '') === 'paid' || !empty($item['is_completed'])) return 'clear';
        if ($d < $this->today)    return 'overdue';
        if ($d === $this->today)  return 'today';
        if ($d <= $this->weekEnd) return 'week';
        return 'upcoming';
    }

    private function groupByUrgency(array $items): array
    {
        $groups = ['overdue' => [], 'today' => [], 'week' => [], 'upcoming' => []];
        foreach ($items as $item) {
            $u = $item['urgency'];
            if (isset($groups[$u])) $groups[$u][] = $item;
        }
        return $groups;
    }

    private function businessPriorityBonus(string $bizName, bool $isCritical): int
    {
        $bcfg = $this->cfg['business'] ?? [];
        if ($isCritical) return (int)($bcfg['critical_bonus'] ?? 35);
        $patterns = $bcfg['priority_store_names'] ?? [];
        foreach ($patterns as $p) {
            if ($p && stripos($bizName, $p) !== false)
                return (int)($bcfg['high_priority_bonus'] ?? 20);
        }
        return 0;
    }

    // =========================================================================
    // 4. LOAD SCORE ENGINE
    // =========================================================================

    /**
     * Compute a load score and band for a member data array.
     * Expected keys: open, overdue, due_week, on_time_pct, urgent (optional), biz_count (optional)
     */
    public function memberLoadScore(array $member): array
    {
        $lc  = $this->cfg['load'] ?? [];
        $wO  = (int)($lc['open_task_weight']    ?? 2);
        $wOv = (int)($lc['overdue_weight']       ?? 10);
        $wDw = (int)($lc['due_week_weight']      ?? 4);
        $wUr = (int)($lc['urgent_weight']        ?? 6);
        $wBi = (int)($lc['biz_impact_weight']    ?? 12);
        $div = max(1, (int)($lc['on_time_divisor'] ?? 5));

        $score  = (int)($member['open']     ?? 0) * $wO;
        $score += (int)($member['overdue']  ?? 0) * $wOv;
        $score += (int)($member['due_week'] ?? 0) * $wDw;
        $score += (int)($member['urgent']   ?? 0) * $wUr;
        $score += (int)($member['biz_count']?? 0) * $wBi;
        $score -= (int)($member['on_time_pct'] ?? 0) / $div;
        $score  = max(0, (int)$score);

        $bands = [
            'critical' => (int)($lc['band_critical'] ?? 75),
            'behind'   => (int)($lc['band_behind']   ?? 50),
            'watch'    => (int)($lc['band_watch']     ?? 25),
        ];

        if ($score >= $bands['critical'])     { $band = 'critical'; $color = '#EF4444'; $icon = '🔥'; }
        elseif ($score >= $bands['behind'])   { $band = 'behind';   $color = '#F97316'; $icon = '⚠️'; }
        elseif ($score >= $bands['watch'])    { $band = 'watch';    $color = '#F59E0B'; $icon = '👀'; }
        else                                  { $band = 'stable';   $color = '#22C55E'; $icon = '✅'; }

        return [
            'load_score' => $score,
            'band'       => $band,
            'label'      => ucfirst($band),
            'color'      => $color,
            'icon'       => $icon,
        ];
    }

    /**
     * Compute a risk score and level for a business/store.
     * Expected keys: overdue_bills, overdue_tasks, unpaid_amount, overloaded_members
     */
    public function businessRiskScore(array $business): array
    {
        $bc  = $this->cfg['business_risk'] ?? [];
        $score  = (int)($business['overdue_bills']      ?? 0) * (int)($bc['overdue_bill_weight']      ?? 15);
        $score += (int)($business['overdue_tasks']      ?? 0) * (int)($bc['overdue_task_weight']      ?? 10);
        $score += (int)($business['overloaded_members'] ?? 0) * (int)($bc['overloaded_member_weight'] ?? 12);

        // Amount contribution
        $div     = max(1, (int)($bc['unpaid_amount_divisor'] ?? 1000));
        $amtCap  = (int)($bc['unpaid_amount_cap'] ?? 30);
        $amtPts  = min($amtCap, (int)((float)($business['unpaid_amount'] ?? 0) / $div));
        $score  += $amtPts;
        $score   = max(0, $score);

        $bands = [
            'critical' => (int)($bc['band_critical'] ?? 70),
            'high'     => (int)($bc['band_high']     ?? 45),
            'watch'    => (int)($bc['band_watch']    ?? 20),
        ];

        if ($score >= $bands['critical'])  { $level = 'critical'; $color = '#EF4444'; $icon = '🚨'; }
        elseif ($score >= $bands['high'])  { $level = 'high';     $color = '#F97316'; $icon = '⚠️'; }
        elseif ($score >= $bands['watch']) { $level = 'watch';    $color = '#F59E0B'; $icon = '👀'; }
        else                               { $level = 'low';      $color = '#22C55E'; $icon = '✅'; }

        return [
            'risk_score' => $score,
            'level'      => $level,
            'label'      => ucfirst($level),
            'color'      => $color,
            'icon'       => $icon,
        ];
    }

    // =========================================================================
    // 5. WORKLOAD BALANCER
    // =========================================================================

    /**
     * Returns members who are overloaded and should have tasks reassigned,
     * each with a suggested destination user and specific task_ids.
     */
    public function reassignmentCandidates(): array
    {
        $bc   = $this->cfg['balancer'] ?? [];
        $minOv = (int)($bc['overload_overdue_threshold'] ?? 3);
        $minLs = (int)($bc['overload_load_threshold']    ?? 50);

        // Get all active members with stats
        $members = $this->db->fetchAll(
            "SELECT u.id, u.name, u.role,
                    COUNT(t.id) AS total,
                    SUM(CASE WHEN t.is_completed=0 THEN 1 ELSE 0 END) AS open,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date BETWEEN ? AND DATE_ADD(?,INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_week,
                    SUM(CASE WHEN t.is_completed=1 AND t.due_date >= DATE_SUB(?,INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS recent_done
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             WHERE u.is_active = 1
             GROUP BY u.id, u.name, u.role
             ORDER BY overdue DESC, open DESC",
            [$this->today, $this->today, $this->today, $this->today]
        );

        $results = [];
        foreach ($members as $m) {
            $ls   = $this->memberLoadScore($m);
            $ov   = (int)($m['overdue'] ?? 0);

            if ($ov < $minOv && $ls['load_score'] < $minLs) continue;

            // Get top 5 overdue tasks for this member
            $tasks = $this->db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.priority, p.store_id,
                        s.name AS store_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 WHERE t.assignee_id = ? AND t.is_completed = 0 AND t.due_date < ?
                 ORDER BY t.due_date ASC, FIELD(t.priority,'urgent','high','medium','low')
                 LIMIT 5",
                [(int)$m['id'], $this->today]
            );

            $dest = $this->bestDestinationUser((int)$m['id'], $members, $ls['load_score']);

            $results[] = [
                'member'          => $m,
                'load'            => $ls,
                'overdue_tasks'   => $tasks,
                'task_ids'        => array_column($tasks, 'id'),
                'destination'     => $dest,
                'confidence'      => $this->rebalanceConfidence($ov, $ls['load_score']),
                'recommendation'  => $this->rebalanceText($m, $dest, count($tasks)),
            ];
        }

        return $results;
    }

    /**
     * Find the best destination user for reassignment from $fromUserId.
     * Ranks by lowest load + business familiarity.
     */
    public function bestDestinationUser(int $fromUserId, array $allMembers = [], int $fromLoad = 999): array
    {
        $bc       = $this->cfg['balancer'] ?? [];
        $headroom = (int)($bc['destination_headroom'] ?? 15);
        $famBonus = (int)($bc['familiarity_bonus']    ?? 20);

        if (empty($allMembers)) {
            $allMembers = $this->db->fetchAll(
                "SELECT u.id, u.name, u.role,
                        SUM(CASE WHEN t.is_completed=0 THEN 1 ELSE 0 END) AS open,
                        SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                        SUM(CASE WHEN t.is_completed=0 AND t.due_date BETWEEN ? AND DATE_ADD(?,INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_week,
                        0 AS recent_done
                 FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
                 WHERE u.is_active = 1
                 GROUP BY u.id, u.name, u.role",
                [$this->today, $this->today, $this->today]
            );
        }

        // Businesses the source user is active in
        $sourceBiz = $this->db->fetchAll(
            "SELECT DISTINCT p.store_id FROM tasks t
             JOIN projects p ON p.id = t.project_id
             WHERE t.assignee_id = ? AND t.is_completed = 0 AND p.store_id IS NOT NULL",
            [$fromUserId]
        );
        $sourceBizIds = array_column($sourceBiz, 'store_id');

        $ranked = [];
        foreach ($allMembers as $m) {
            if ((int)$m['id'] === $fromUserId) continue;

            $ls = $this->memberLoadScore($m);
            if ($ls['load_score'] >= $fromLoad - $headroom) continue; // too close or higher

            $score = 100 - $ls['load_score']; // prefer lower load

            // Familiarity bonus
            $destBiz = $this->db->fetchAll(
                "SELECT DISTINCT p.store_id FROM tasks t
                 JOIN projects p ON p.id = t.project_id
                 WHERE t.assignee_id = ? AND p.store_id IS NOT NULL",
                [(int)$m['id']]
            );
            $overlap  = array_intersect($sourceBizIds, array_column($destBiz, 'store_id'));
            $hasFam   = !empty($overlap);
            if ($hasFam) $score += $famBonus;

            $ranked[] = ['member' => $m, 'load' => $ls, 'rank_score' => $score, 'has_familiarity' => $hasFam];
        }

        if (empty($ranked)) return [];
        usort($ranked, fn($a, $b) => $b['rank_score'] - $a['rank_score']);
        return $ranked[0];
    }

    /**
     * Simulate a reassignment and return before/after load for both users.
     * Read-only — no DB writes.
     */
    public function previewRebalance(int $fromUserId, int $toUserId, array $taskIds = []): array
    {
        $bc       = $this->cfg['balancer'] ?? [];
        $maxMove  = (int)($bc['max_task_move_per_action'] ?? 5);
        $taskIds  = array_slice(array_map('intval', $taskIds), 0, $maxMove);

        // Fetch moving tasks
        if (empty($taskIds)) {
            $rows = $this->db->fetchAll(
                "SELECT id FROM tasks WHERE assignee_id=? AND is_completed=0 AND due_date < ?
                 ORDER BY due_date ASC LIMIT {$maxMove}",
                [$fromUserId, $this->today]
            );
            $taskIds = array_column($rows, 'id');
        }

        $movingCount = count($taskIds);

        // Stats for both users
        $fromStats = $this->userStats($fromUserId);
        $toStats   = $this->userStats($toUserId);

        // Compute task breakdown
        $urgent = $overdue = 0;
        if (!empty($taskIds)) {
            $inList = implode(',', $taskIds);
            $rows   = $this->db->fetchAll(
                "SELECT id, title, due_date, priority FROM tasks WHERE id IN ({$inList})"
            );
            foreach ($rows as $r) {
                if ($r['due_date'] && $r['due_date'] < $this->today) $overdue++;
                if ($r['priority'] === 'urgent') $urgent++;
            }
        } else {
            $rows = [];
        }

        // Simulated after stats
        $fromAfter = [
            'open'      => max(0, (int)$fromStats['open']    - $movingCount),
            'overdue'   => max(0, (int)$fromStats['overdue'] - $overdue),
            'due_week'  => (int)$fromStats['due_week'],
            'on_time_pct' => (int)$fromStats['on_time_pct'],
        ];
        $toAfter = [
            'open'      => (int)$toStats['open']    + $movingCount,
            'overdue'   => (int)$toStats['overdue'] + $overdue,
            'due_week'  => (int)$toStats['due_week'],
            'on_time_pct' => (int)$toStats['on_time_pct'],
        ];

        $fromLoadBefore = $this->memberLoadScore($fromStats);
        $fromLoadAfter  = $this->memberLoadScore($fromAfter);
        $toLoadBefore   = $this->memberLoadScore($toStats);
        $toLoadAfter    = $this->memberLoadScore($toAfter);

        $warnings = [];
        if ($toLoadAfter['load_score'] > ($fromLoadBefore['load_score'] - 10)) {
            $warnings[] = 'Destination user may become overloaded after transfer.';
        }
        if ($movingCount === 0) {
            $warnings[] = 'No tasks selected for transfer.';
        }

        return [
            'moving_count' => $movingCount,
            'urgent_count' => $urgent,
            'overdue_count'=> $overdue,
            'tasks'        => array_values($rows ?? []),
            'warnings'     => $warnings,
            'from_user'    => [
                'id'          => $fromUserId,
                'name'        => $fromStats['name'] ?? '',
                'before'      => $fromStats['open'] ?? 0,
                'after'       => $fromAfter['open'],
                'load_before' => $fromLoadBefore,
                'load_after'  => $fromLoadAfter,
            ],
            'to_user'      => [
                'id'          => $toUserId,
                'name'        => $toStats['name'] ?? '',
                'before'      => $toStats['open'] ?? 0,
                'after'       => $toAfter['open'],
                'load_before' => $toLoadBefore,
                'load_after'  => $toLoadAfter,
            ],
        ];
    }

    /**
     * Generate a full rebalance plan from all overloaded members.
     * Calls reassignmentCandidates() and returns the Safe plan (backward-compat shim).
     */
    public function rebalancePlan(string $mode = 'safe'): array
    {
        $candidates = $this->reassignmentCandidates();
        if (empty($candidates)) {
            return ['has_plan' => false, 'reason' => 'No overloaded members detected at current thresholds.', 'candidates' => 0];
        }
        return $this->buildPlanFromCandidates($candidates, $mode);
    }

    /**
     * Generate both Safe and Aggressive plans sharing one candidate fetch.
     * Returns: { has_plan, plans: { safe, aggressive }, recommended }
     */
    public function rebalancePlanBoth(): array
    {
        $candidates = $this->reassignmentCandidates();
        if (empty($candidates)) {
            return [
                'has_plan'    => false,
                'reason'      => 'No overloaded members detected at current thresholds.',
                'candidates'  => 0,
                'plans'       => ['safe' => ['has_plan' => false], 'aggressive' => ['has_plan' => false]],
                'recommended' => null,
            ];
        }

        $safe       = $this->buildPlanFromCandidates($candidates, 'safe');
        $aggressive = $this->buildPlanFromCandidates($candidates, 'aggressive');

        // Recommend aggressive only if it removes 50 %+ more overdue tasks AND destinations stay safe
        $recommended = 'safe';
        if ($aggressive['has_plan'] && $safe['has_plan']
            && $aggressive['overdue_reduced'] >= $safe['overdue_reduced'] * 1.5
            && (bool)($aggressive['risk_reduction']['destinations_safe'] ?? false)) {
            $recommended = 'aggressive';
        }

        return [
            'has_plan'    => $safe['has_plan'] || $aggressive['has_plan'],
            'plans'       => ['safe' => $safe, 'aggressive' => $aggressive],
            'recommended' => $recommended,
        ];
    }

    /**
     * Core plan builder — shared by rebalancePlan() and rebalancePlanBoth().
     * Mode 'safe'       → overdue-first, max $maxBase tasks, due_date required.
     * Mode 'aggressive' → overdue + due-week + high-priority, max $maxBase×2, no due-date filter.
     */
    private function buildPlanFromCandidates(array $candidates, string $mode): array
    {
        $bc      = $this->cfg['balancer'] ?? [];
        $maxBase = (int)($bc['max_task_move_per_action'] ?? 5);
        $maxMove = $mode === 'aggressive' ? $maxBase * 2 : $maxBase;

        $actions        = [];
        $totalMoving    = 0;
        $overdueReduced = 0;
        $famCount       = 0;

        foreach ($candidates as $cand) {
            $dest = $cand['destination'];
            if (empty($dest) || empty($dest['member'])) continue;

            $fromUser = $cand['member'];
            $toMember = $dest['member'];

            if ($mode === 'aggressive') {
                // Aggressive: include overdue + due-week + high-priority, no due-date filter
                $taskRows = $this->db->fetchAll(
                    "SELECT t.id, t.title, t.due_date, t.priority,
                            p.name AS project_name, s.name AS store_name
                     FROM tasks t
                     LEFT JOIN projects p ON p.id = t.project_id
                     LEFT JOIN stores s ON s.id = p.store_id
                     WHERE t.assignee_id = ? AND t.is_completed = 0
                     ORDER BY
                       CASE WHEN t.due_date < ? THEN 0
                            WHEN t.due_date = ? THEN 1
                            WHEN t.due_date <= DATE_ADD(?, INTERVAL 7 DAY) THEN 2
                            WHEN t.priority IN ('urgent','high') THEN 3
                            ELSE 4 END,
                       t.due_date ASC,
                       FIELD(t.priority,'urgent','high','medium','low')
                     LIMIT ?",
                    [(int)$fromUser['id'], $this->today, $this->today, $this->today, $maxMove]
                );
            } else {
                // Safe: overdue-first + today + high-priority, due_date required
                $taskRows = $this->db->fetchAll(
                    "SELECT t.id, t.title, t.due_date, t.priority,
                            p.name AS project_name, s.name AS store_name
                     FROM tasks t
                     LEFT JOIN projects p ON p.id = t.project_id
                     LEFT JOIN stores s ON s.id = p.store_id
                     WHERE t.assignee_id = ? AND t.is_completed = 0
                       AND t.due_date IS NOT NULL
                     ORDER BY
                       CASE WHEN t.due_date < ? THEN 0
                            WHEN t.due_date = ? THEN 1
                            WHEN t.priority IN ('urgent','high') THEN 2
                            ELSE 3 END,
                       t.due_date ASC,
                       FIELD(t.priority,'urgent','high','medium','low')
                     LIMIT ?",
                    [(int)$fromUser['id'], $this->today, $this->today, $maxMove]
                );
            }

            if (empty($taskRows)) continue;

            $taskIds = array_column($taskRows, 'id');
            $movOv   = count(array_filter($taskRows, fn($t) => ($t['due_date'] ?? '') < $this->today && $t['due_date']));
            $totalMoving    += count($taskIds);
            $overdueReduced += $movOv;

            $toLs   = $dest['load'] ?? [];
            $hasFam = (bool)($dest['has_familiarity'] ?? false);
            if ($hasFam) $famCount++;

            $reason = $toMember['name'] . ' has capacity ('
                    . (int)($toMember['open'] ?? 0) . ' open, '
                    . ($toLs['band'] ?? 'stable') . ' load)'
                    . ($hasFam ? ' · familiar with same stores' : '');

            $actions[] = [
                'from_user_id'     => (int)$fromUser['id'],
                'from_user_name'   => $fromUser['name'],
                'from_load_before' => $cand['load'],
                'to_user_id'       => (int)$toMember['id'],
                'to_user_name'     => $toMember['name'],
                'to_load_before'   => $toLs,
                'task_ids'         => $taskIds,
                'tasks'            => $taskRows,
                'task_count'       => count($taskIds),
                'overdue_count'    => $movOv,
                'reason'           => $reason,
                'has_familiarity'  => $hasFam,
            ];
        }

        if (empty($actions)) {
            return ['has_plan' => false, 'reason' => 'No suitable destination users found.', 'candidates' => count($candidates)];
        }

        // ── Aggregate confidence ──
        $confScores  = array_column($candidates, 'confidence');
        $avgConf     = array_sum($confScores) / count($confScores);
        $conf        = round($avgConf, 2);
        if ($mode === 'aggressive') $conf = round(max(0.10, $conf - 0.10), 2); // aggressive = slightly less certain
        $confLabel   = $conf >= 0.75 ? 'High' : ($conf >= 0.50 ? 'Medium' : 'Low');

        // ── Confidence breakdown (3 named signals) ──
        $critBands = count(array_filter($candidates, fn($c) => in_array($c['load']['band'] ?? '', ['critical', 'behind'])));
        $destScores = array_map(fn($a) => max(0.0, 1.0 - (($a['to_load_before']['load_score'] ?? 50) / 100)), $actions);
        $avgCap     = count($destScores) > 0 ? array_sum($destScores) / count($destScores) : 0;
        $allDestSafe = count(array_filter($actions, fn($a) => in_array($a['to_load_before']['band'] ?? 'stable', ['stable','watch']))) === count($actions);
        $famRatio   = count($actions) > 0 ? round($famCount / count($actions), 2) : 0.0;
        $famNote    = $famCount > 0
            ? $famCount . ' of ' . count($actions) . ' destination' . (count($actions) !== 1 ? 's' : '') . ' already work in the same stores as the source'
            : 'No store overlap detected — assignments are cross-business';

        $confidenceBreakdown = [
            [
                'signal' => 'Overload severity',
                'score'  => round(min(1.0, array_sum($confScores) / count($confScores)), 2),
                'note'   => $critBands . ' member' . ($critBands !== 1 ? 's' : '')
                          . ' in critical/behind band — strong signal for redistribution',
            ],
            [
                'signal' => 'Destination capacity',
                'score'  => round($avgCap, 2),
                'note'   => $allDestSafe
                    ? 'All destination members have headroom — safe to absorb tasks without secondary overload'
                    : 'Some destinations are near capacity — monitor workload after applying',
            ],
            [
                'signal' => 'Business familiarity',
                'score'  => $famRatio,
                'note'   => $famNote,
            ],
        ];

        // ── Summary ──
        $parts = [];
        foreach ($actions as $a) {
            $parts[] = 'Move ' . $a['task_count'] . ' task' . ($a['task_count'] !== 1 ? 's' : '')
                     . ' from ' . $a['from_user_name'] . ' to ' . $a['to_user_name'];
        }

        $rr = $this->planRiskReduction($candidates, $actions);

        return [
            'has_plan'             => true,
            'plan_id'              => 'rp_' . date('Ymd_His') . '_' . $mode[0],
            'mode'                 => $mode,
            'summary'              => implode(' · ', $parts),
            'confidence'           => $conf,
            'confidence_label'     => $confLabel,
            'confidence_breakdown' => $confidenceBreakdown,
            'total_moving'         => $totalMoving,
            'overdue_reduced'      => $overdueReduced,
            'sources'              => count($candidates),
            'actions'              => $actions,
            'risk_reduction'       => $rr,
            'generated_at'         => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Simulate before/after risk for a plan.
     * Returns source risk change and whether destinations stay safe.
     */
    private function planRiskReduction(array $candidates, array $actions): array
    {
        $topCand   = $candidates[0] ?? null;
        $topAction = $actions[0]    ?? null;

        $sourceBefore = $topCand ? ($topCand['load']['band'] ?? 'unknown') : 'unknown';
        $sourceAfter  = $sourceBefore;

        if ($topCand && $topAction) {
            $simOv   = max(0, (int)($topCand['member']['overdue'] ?? 0) - $topAction['overdue_count']);
            $simOpen = max(0, (int)($topCand['member']['open']    ?? 0) - $topAction['task_count']);
            $simStats = [
                'open'     => $simOpen,
                'overdue'  => $simOv,
                'due_week' => (int)($topCand['member']['due_week'] ?? 0),
            ];
            $simLoad    = $this->memberLoadScore($simStats);
            $sourceAfter = $simLoad['band'];
        }

        $destsSafe = true;
        foreach ($actions as $a) {
            if ((int)(($a['to_load_before']['load_score'] ?? 0)) > 65) {
                $destsSafe = false;
                break;
            }
        }

        $totalOdReduced = array_sum(array_column($actions, 'overdue_count'));

        return [
            'source_risk_before'      => $sourceBefore,
            'source_risk_after'       => $sourceAfter,
            'overdue_tasks_reduced'   => $totalOdReduced,
            'destinations_safe'       => $destsSafe,
            'business_risk_reduction' => $totalOdReduced >= 3 ? 'high' : ($totalOdReduced >= 1 ? 'medium' : 'none'),
        ];
    }

    // =========================================================================
    // 6. ACTION INTELLIGENCE
    // =========================================================================

    /** Quick win detection — easy high-value items */
    public function quickWins(int $limit = 5): array
    {
        $qc  = $this->cfg['quick_wins'] ?? [];
        $maxOD = (int)($qc['max_overdue_days'] ?? 3);
        $within = (int)($qc['due_within_days'] ?? 7);
        $cutoff = date('Y-m-d', strtotime("+{$within} days"));
        $lim    = (int)($qc['limit'] ?? 5);
        $lim    = min($lim, $limit);

        $userFilter = '';
        $params     = [$this->today, $cutoff];
        if ($this->role === 'staff') {
            $userFilter = ' AND t.assignee_id = ?';
            $params[]   = $this->userId;
        }

        $rows = $this->db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority, t.is_completed,
                    u.name AS assignee_name, s.name AS store_name
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             WHERE t.is_completed = 0
               AND (t.due_date IS NULL OR t.due_date <= ?)
               AND (t.due_date IS NULL OR t.due_date >= DATE_SUB(?,INTERVAL {$maxOD} DAY))
               AND t.priority IN ('medium','high')
               {$userFilter}
             ORDER BY t.due_date ASC, FIELD(t.priority,'high','medium')
             LIMIT {$lim}",
            $params
        );

        foreach ($rows as &$r) {
            $r['urgency']    = $this->urgencyBucket($r);
            $r['score']      = $this->taskScore($r);
            $r['quick_win']  = true;
            $r['type']       = 'task';
            $r['url']        = APP_URL . '/tasks/' . (int)$r['id'];
            $r['action_text']= 'Complete →';
        }
        return $rows;
    }

    /** Staff-specific queue: focus item + quick wins + due today */
    public function staffQueue(): array
    {
        $data     = $this->compute();
        $actions  = $data['actions'];
        $overdue  = array_values(array_filter($actions, fn($a) => $a['urgency'] === 'overdue'));
        $today    = array_values(array_filter($actions, fn($a) => $a['urgency'] === 'today'));
        $focus    = $actions[0] ?? null;

        return [
            'focus_item' => $focus,
            'due_today'  => array_slice($today, 0, 5),
            'quick_wins' => $this->quickWins(3),
            'overdue'    => array_slice($overdue, 0, 5),
            'brief'      => $this->brief(),
        ];
    }

    /**
     * Structured team summary for /team and CEO dashboard.
     */
    public function teamSummary(): array
    {
        if ($this->role === 'staff') return [];

        $today = $this->today;

        // Team-level KPIs
        $totals = $this->db->fetch(
            "SELECT
                SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS total_overdue,
                COUNT(DISTINCT CASE WHEN t.is_completed=0 AND t.due_date < ? THEN t.assignee_id END) AS members_with_overdue,
                COUNT(DISTINCT CASE WHEN t.is_completed=0 AND t.due_date < ? AND u.id IS NOT NULL THEN p.store_id END) AS biz_impacted
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             LEFT JOIN projects p ON p.id = t.project_id
             WHERE u.is_active = 1 OR u.id IS NULL",
            [$today, $today, $today]
        );

        // Members with overdue >= 3
        $overloadedCount = (int)$this->db->fetch(
            "SELECT COUNT(*) AS cnt FROM (
                SELECT assignee_id FROM tasks
                WHERE is_completed=0 AND due_date < ? AND assignee_id IS NOT NULL
                GROUP BY assignee_id HAVING COUNT(*) >= 3
             ) x",
            [$today]
        )['cnt'];

        // On-time rate
        $onTime = $this->db->fetch(
            "SELECT
                SUM(CASE WHEN is_completed=1 THEN 1 ELSE 0 END) AS done,
                SUM(CASE WHEN is_completed=1 AND (due_date IS NULL OR updated_at <= due_date) THEN 1 ELSE 0 END) AS on_time
             FROM tasks WHERE updated_at >= DATE_SUB(?, INTERVAL 30 DAY)",
            [$today]
        );
        $onTimePct = (int)$onTime['done'] > 0
            ? (int)round((int)$onTime['on_time'] / (int)$onTime['done'] * 100)
            : 100;

        $candidates = $this->reassignmentCandidates();
        $insights   = $this->teamInsights();

        return [
            'kpi' => [
                'overloaded'    => $overloadedCount,
                'total_overdue' => (int)($totals['total_overdue'] ?? 0),
                'biz_impact'    => (int)($totals['biz_impacted'] ?? 0),
                'rebalance'     => count($candidates),
                'on_time_pct'   => $onTimePct,
            ],
            'suggestions'            => $insights,
            'reassignment_candidates'=> array_slice($candidates, 0, 3),
            'brief'                  => $this->brief(),
        ];
    }

    /**
     * Team-specific insights for manager / CEO role.
     */
    public function teamInsights(): array
    {
        if ($this->role === 'staff') return [];

        $today   = $this->today;
        $results = [];

        // Overloaded members
        $overloaded = $this->db->fetchAll(
            "SELECT u.id, u.name, COUNT(t.id) AS overdue_cnt
             FROM tasks t JOIN users u ON u.id = t.assignee_id
             WHERE t.is_completed = 0 AND t.due_date < ? AND u.is_active = 1
             GROUP BY u.id, u.name
             HAVING overdue_cnt >= 3
             ORDER BY overdue_cnt DESC LIMIT 5",
            [$today]
        );

        foreach ($overloaded as $m) {
            $ov = (int)$m['overdue_cnt'];
            $results[] = [
                'type'         => 'overload',
                'priority'     => $ov >= 5 ? 'critical' : 'high',
                'icon'         => $ov >= 5 ? '🔥' : '⚠️',
                'color'        => $ov >= 5 ? '#EF4444' : '#F97316',
                'title'        => $m['name'] . ' is falling behind — ' . $ov . ' overdue tasks',
                'reason'       => 'Recommend immediate reassignment or support',
                'action'       => 'reassign',
                'from_user_id' => (int)$m['id'],
                'label'        => '⇄ Reassign',
                'confidence'   => $this->rebalanceConfidence($ov, $ov * 10),
            ];
        }

        // Businesses most impacted
        $bizImpact = $this->db->fetchAll(
            "SELECT s.id AS store_id, s.name AS store_name, COUNT(t.id) AS cnt
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             JOIN stores s ON s.id = p.store_id
             WHERE t.is_completed = 0 AND t.due_date < ?
             GROUP BY s.id ORDER BY cnt DESC LIMIT 3",
            [$today]
        );

        foreach ($bizImpact as $biz) {
            if ((int)$biz['cnt'] < 2) continue;
            $cnt = (int)$biz['cnt'];
            $results[] = [
                'type'     => 'biz_risk',
                'priority' => $cnt >= 5 ? 'critical' : 'high',
                'icon'     => '🏪',
                'color'    => $cnt >= 5 ? '#EF4444' : '#F97316',
                'title'    => $biz['store_name'] . ' impacted by ' . $cnt . ' overdue tasks',
                'reason'   => 'Operations at risk — review immediately',
                'action'   => 'overview',
                'label'    => '🏢 View',
                'confidence'=> min(1.0, 0.60 + ($cnt * 0.05)),
            ];
        }

        return array_slice($results, 0, 5);
    }

    /** Throughput stats for a user (recent completions) */
    public function throughputStats(int $userId): array
    {
        $tc   = $this->cfg['throughput'] ?? [];
        $days = (int)($tc['lookback_days']  ?? 7);
        $slow = (int)($tc['slow_threshold'] ?? 2);
        $fast = (int)($tc['fast_threshold'] ?? 10);

        $r = $this->db->fetch(
            "SELECT
                COUNT(*) AS completed,
                AVG(DATEDIFF(updated_at, created_at)) AS avg_days
             FROM tasks
             WHERE assignee_id = ? AND is_completed = 1
               AND updated_at >= DATE_SUB(?, INTERVAL {$days} DAY)",
            [$userId, $this->today]
        );

        $cnt = (int)($r['completed'] ?? 0);
        $avg = (float)($r['avg_days'] ?? 0);
        $pace = $cnt >= $fast ? 'fast' : ($cnt <= $slow ? 'slow' : 'normal');

        return [
            'completed_7d' => $cnt,
            'avg_days'     => round($avg, 1),
            'pace'         => $pace,
            'pace_label'   => ucfirst($pace),
            'pace_color'   => $pace === 'fast' ? '#22C55E' : ($pace === 'slow' ? '#EF4444' : '#F59E0B'),
        ];
    }

    // =========================================================================
    // 11. DECISION INTELLIGENCE LAYER  (V3)
    //
    //  detectProblems()  — scan all risk types → normalized Problem objects
    //  rankProblems()    — unified ranking by impact + urgency + business scope
    //  comparePlans()    — cross-problem 5-dimension scoring ("what first?")
    //  quickWin()        — smallest effort / highest single-action impact
    // =========================================================================

    /**
     * Detect all current problems across 4 risk categories.
     * Returns an array of normalized Problem objects (unsorted).
     *
     * Problem types:  overload | store_risk | bill_overdue | low_throughput
     */
    public function detectProblems(): array
    {
        $today    = $this->today;
        $db       = $this->db;
        $dcCfg    = $this->decisionConfig();
        $th       = $dcCfg['thresholds'] ?? [];
        $problems = [];

        // ── 1. OVERLOAD — users with too many overdue / open tasks ──────────
        // One reassignmentCandidates() call supplies the destination info for free
        $candidates = $this->reassignmentCandidates();
        $candidateByUserId = [];
        foreach ($candidates as $c) {
            $uid = (int)($c['member']['id'] ?? 0);
            $candidateByUserId[$uid] = $c;
        }

        $overloaded = $db->fetchAll(
            "SELECT u.id, u.name,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                    SUM(CASE WHEN t.is_completed=0 THEN 1 ELSE 0 END) AS open,
                    COUNT(DISTINCT p.store_id) AS stores
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             LEFT JOIN projects p ON p.id = t.project_id
             WHERE u.is_active = 1
             GROUP BY u.id, u.name
             HAVING overdue >= ? OR (overdue >= ? AND open >= ?)
             ORDER BY overdue DESC, open DESC",
            [
                $today,
                (int)($th['overload_overdue_min'] ?? 2),
                (int)($th['overload_both_min']    ?? 1),
                (int)($th['overload_open_min']    ?? 10),
            ]
        );

        foreach ($overloaded as $m) {
            $ov     = (int)$m['overdue'];
            $open   = (int)$m['open'];
            $stores = (int)$m['stores'];
            $uid    = (int)$m['id'];

            $impact = $ov   * (int)($th['impact_overload_ov']    ?? 12)
                    + $open * (int)($th['impact_overload_open']   ?? 3)
                    + $stores * (int)($th['impact_overload_store'] ?? 5);

            // Plan hint: which member is the best destination?
            $planHint = null;
            if (isset($candidateByUserId[$uid])) {
                $cand = $candidateByUserId[$uid];
                $destMember = $cand['destination']['member'] ?? null;
                $maxMove    = (int)($this->cfg['balancer']['max_task_move_per_action'] ?? 5);
                if ($destMember) {
                    $moveable   = min($ov, $maxMove);
                    $planHint = [
                        'summary'     => 'Move ' . $moveable . ' overdue task' . ($moveable !== 1 ? 's' : '') . ' to ' . $destMember['name'],
                        'to_user'     => $destMember['name'],
                        'to_user_id'  => (int)$destMember['id'],
                        'task_count'  => $moveable,
                        'confidence'  => round($cand['confidence'], 2),
                    ];
                }
            }

            $problems[] = [
                'problem_type'        => 'overload',
                'entity_type'         => 'user',
                'entity_id'           => $uid,
                'icon'                => $ov >= 5 ? 'gauge' : 'alert-triangle',
                'title'               => $m['name'] . ' Overloaded',
                'description'         => $ov . ' overdue · ' . $open . ' open · ' . $stores . ' store' . ($stores !== 1 ? 's' : ''),
                'risk_level'          => $ov >= 5 ? 'critical' : 'high',
                'color'               => $ov >= 5 ? '#EF4444' : '#F97316',
                'urgency'             => $ov >= 5 ? 'immediate' : 'today',
                'businesses_affected' => $stores,
                'impact_score'        => $impact,
                'overdue_count'       => $ov,
                'recommended_action'  => 'rebalance',
                'action_label'        => 'Review AI Plan',
                'action_url'          => APP_URL . '/team',
                'confidence'          => min(1.0, 0.50 + $ov * 0.06 + ($open / 100) * 0.10),
                'plan_hint'           => $planHint,
            ];
        }

        // ── 2. STORE RISK — stores with clustered overdue tasks ──────────────
        $storeRisk = $db->fetchAll(
            "SELECT s.id, s.name,
                    COUNT(t.id) AS overdue,
                    COUNT(DISTINCT p.id) AS projects
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             JOIN stores s ON s.id = p.store_id
             WHERE t.is_completed = 0 AND t.due_date < ?
             GROUP BY s.id, s.name
             HAVING overdue >= ?
             ORDER BY overdue DESC",
            [$today, (int)($th['store_overdue_min'] ?? 2)]
        );

        // Collect store IDs already surfaced via overload (same-store check for dedup)
        // We do NOT dedup — store risk and user overload are different signals.
        foreach ($storeRisk as $sr) {
            $ov  = (int)$sr['overdue'];
            $prj = (int)$sr['projects'];
            $impact = $ov * (int)($th['impact_store_ov']   ?? 10)
                    + $prj * (int)($th['impact_store_proj'] ?? 5);
            $problems[] = [
                'problem_type'        => 'store_risk',
                'entity_type'         => 'store',
                'entity_id'           => (int)$sr['id'],
                'icon'                => $ov >= 5 ? 'shield-alert' : 'building',
                'title'               => $sr['name'],
                'description'         => $ov . ' overdue task' . ($ov !== 1 ? 's' : '') . ' across ' . $prj . ' project' . ($prj !== 1 ? 's' : ''),
                'risk_level'          => $ov >= 5 ? 'critical' : 'high',
                'color'               => $ov >= 5 ? '#EF4444' : '#F97316',
                'urgency'             => $ov >= 5 ? 'immediate' : 'today',
                'businesses_affected' => 1,
                'impact_score'        => $impact,
                'overdue_count'       => $ov,
                'recommended_action'  => 'review',
                'action_label'        => 'Fix Now',
                'action_url'          => APP_URL . '/overview/store/' . (int)$sr['id'],
                'confidence'          => min(1.0, 0.55 + $ov * 0.04),
                'plan_hint'           => null,
            ];
        }

        // ── 3. BILL OVERDUE ─────────────────────────────────────────────────
        $bills = $db->fetch(
            "SELECT COUNT(*) AS overdue_count,
                    COALESCE(SUM(amount), 0) AS overdue_amount
             FROM bills
             WHERE status = 'overdue' OR (status = 'pending' AND due_date < ?)",
            [$today]
        );
        $ovBills = (int)($bills['overdue_count'] ?? 0);
        if ($ovBills > 0) {
            $amount = (float)($bills['overdue_amount'] ?? 0);
            $impact = $ovBills * (int)($th['impact_bill_ov'] ?? 15)
                    + (int)($amount * (float)($th['impact_bill_amount'] ?? 0.01));
            $desc   = $amount > 0
                ? 'Unpaid balance: $' . number_format($amount, 0, ',', '.')
                : 'Immediate payment required';
            $problems[] = [
                'problem_type'        => 'bill_overdue',
                'entity_type'         => 'finance',
                'entity_id'           => 0,
                'icon'                => 'wallet',
                'title'               => $ovBills . ' Overdue Bill' . ($ovBills !== 1 ? 's' : ''),
                'description'         => $desc,
                'risk_level'          => $ovBills >= 3 ? 'critical' : 'high',
                'color'               => '#F59E0B',
                'urgency'             => 'immediate',
                'businesses_affected' => 0,
                'impact_score'        => $impact,
                'overdue_count'       => $ovBills,
                'recommended_action'  => 'pay',
                'action_label'        => 'Pay Now',
                'action_url'          => APP_URL . '/bills?status=overdue',
                'confidence'          => 0.97,   // bills are always factual
                'plan_hint'           => null,
            ];
        }

        // ── 4. LOW THROUGHPUT — team on-time rate below threshold ───────────
        $perf = $db->fetch(
            "SELECT
                SUM(CASE WHEN is_completed=1 THEN 1 ELSE 0 END) AS done,
                SUM(CASE WHEN is_completed=1
                          AND (due_date IS NULL OR updated_at <= due_date) THEN 1 ELSE 0 END) AS on_time
             FROM tasks WHERE updated_at >= DATE_SUB(?, INTERVAL 30 DAY)",
            [$today]
        );
        $done      = (int)($perf['done'] ?? 0);
        $onTimePct = ($done >= (int)($th['throughput_sample_min'] ?? 5))
            ? (int)round((int)$perf['on_time'] / $done * 100) : null;

        if ($onTimePct !== null && $onTimePct < (int)($th['throughput_pct_max'] ?? 50)) {
            $impact = (50 - $onTimePct) * (int)($th['impact_throughput'] ?? 2);
            $problems[] = [
                'problem_type'        => 'low_throughput',
                'entity_type'         => 'team',
                'entity_id'           => 0,
                'icon'                => 'trending-down',
                'title'               => 'Team Velocity Low',
                'description'         => $onTimePct . '% on-time rate (last 30 days, ' . $done . ' tasks completed)',
                'risk_level'          => $onTimePct < 30 ? 'critical' : 'medium',
                'color'               => $onTimePct < 30 ? '#EF4444' : '#F59E0B',
                'urgency'             => 'week',
                'businesses_affected' => 0,
                'impact_score'        => $impact,
                'overdue_count'       => 0,
                'recommended_action'  => 'review',
                'action_label'        => 'View Team',
                'action_url'          => APP_URL . '/team',
                'confidence'          => 0.70,
                'plan_hint'           => null,
            ];
        }

        return $problems;
    }

    /**
     * Rank an array of Problem objects by a weighted composite score.
     * Returns the array sorted highest-score-first with 'rank' and 'rank_score' added.
     */
    public function rankProblems(array $problems): array
    {
        $dcCfg    = $this->decisionConfig();
        $rw       = $dcCfg['rank_weights']    ?? ['impact_score' => 0.40, 'urgency' => 0.35, 'business_scope' => 0.25];
        $urgMap   = $dcCfg['urgency_scores']  ?? ['immediate' => 100, 'today' => 70, 'week' => 40, 'monitor' => 10];

        foreach ($problems as &$p) {
            $us  = (int)($urgMap[$p['urgency']] ?? 40);
            $bs  = min(100, (int)($p['businesses_affected'] ?? 0) * 20 + 10);
            $p['rank_score'] = (int)round(
                ($p['impact_score']  ?? 0) * (float)($rw['impact_score']   ?? 0.40)
              + $us                        * (float)($rw['urgency']         ?? 0.35)
              + $bs                        * (float)($rw['business_scope']  ?? 0.25)
            );
        }
        unset($p);

        usort($problems, fn($a, $b) => $b['rank_score'] - $a['rank_score']);

        foreach ($problems as $i => &$p) { $p['rank'] = $i + 1; }
        unset($p);

        return $problems;
    }

    /**
     * Return the single highest-value / lowest-effort action available right now.
     * Uses reassignment candidates — picks the easiest overloaded member to fix.
     */
    public function quickWin(): ?array
    {
        $candidates = $this->reassignmentCandidates();
        if (empty($candidates)) return null;

        // "Easiest" = fewest overdue tasks AND has a clear destination
        $easiest = null;
        foreach ($candidates as $c) {
            if (empty($c['destination']['member'])) continue;
            if ($easiest === null
                || (int)$c['member']['overdue'] < (int)$easiest['member']['overdue']) {
                $easiest = $c;
            }
        }
        if (!$easiest) return null;

        $ov      = (int)$easiest['member']['overdue'];
        $maxMove = (int)($this->cfg['balancer']['max_task_move_per_action'] ?? 5);
        $move    = min($ov, $maxMove);
        $dest    = $easiest['destination']['member']['name'] ?? 'available member';
        $conf    = round($easiest['confidence'] * 100);

        return [
            'title'   => 'Move ' . $move . ' overdue task' . ($move !== 1 ? 's' : '') . ' from ' . $easiest['member']['name'] . ' to ' . $dest,
            'effort'  => $move <= 2 ? 'low' : 'medium',
            'impact'  => $ov >= 3 ? 'high' : 'medium',
            'type'    => 'rebalance',
            'url'     => APP_URL . '/team',
            'confidence_pct' => $conf,
        ];
    }

    /**
     * Cross-problem comparison — "What should I do first?"
     *
     * Takes an array of Problem objects (from rankProblems) and scores each on
     * 5 independent dimensions, producing a total_score and priority order.
     * Unlike plan A/B comparison (which ranks strategies for ONE problem), this
     * compares DIFFERENT problem types against each other.
     *
     * Dimensions (weights from decision_engine.php → plan_weights):
     *   risk_reduction  0.35 — how much total risk does fixing this remove?
     *   safety          0.25 — can it be done without creating new risk?
     *   speed           0.15 — how quickly can it be actioned?
     *   simplicity      0.10 — one action vs complex multi-step?
     *   confidence      0.15 — how strong is the evidence?
     *
     * @param  array $problems  Already-ranked Problem objects (output of rankProblems)
     * @return array            Each element gains: total_score, dimensions[], priority_order,
     *                          action_desc, recommendation label; sorted by total_score desc
     */
    public function comparePlans(array $problems): array
    {
        if (empty($problems)) return [];

        $dcCfg = $this->decisionConfig();
        $pw    = $dcCfg['plan_weights'] ?? [
            'risk_reduction' => 0.35,
            'safety'         => 0.25,
            'speed'          => 0.15,
            'simplicity'     => 0.10,
            'confidence'     => 0.15,
        ];

        // Normalize impact scores for risk_reduction (relative to group maximum)
        $maxImpact = max(1, max(array_column($problems, 'impact_score')));

        $scored = [];
        foreach ($problems as $p) {
            $type      = $p['problem_type'] ?? 'unknown';
            $hasHint   = !empty($p['plan_hint']);

            // ── 1. Risk Reduction ──────────────────────────────────────────
            // Proportion of max impact this problem represents.
            // Bills get a 25% boost because financial/legal obligations are harder risk.
            $riskRed = min(1.0, ($p['impact_score'] ?? 0) / $maxImpact);
            if ($type === 'bill_overdue') $riskRed = min(1.0, $riskRed * 1.25);

            // ── 2. Safety ─────────────────────────────────────────────────
            // Can this be actioned without creating new downstream risk?
            $safety = match($type) {
                'bill_overdue'   => 0.95,   // pure payment — no side-effects
                'store_risk'     => 0.85,   // review only, no reassignment
                'low_throughput' => 0.80,   // retrospective, no operational change
                'overload'       => $hasHint ? 0.82 : 0.58,  // safe when AI has a dest
                default          => 0.65,
            };

            // ── 3. Speed ──────────────────────────────────────────────────
            // How many minutes to complete this action from right now?
            $speed = match($type) {
                'bill_overdue'   => 0.90,   // one-click payment
                'overload'       => $hasHint ? 0.85 : 0.55,   // AI plan ready or needs investigation
                'store_risk'     => 0.50,   // triage multiple tasks
                'low_throughput' => 0.22,   // root cause → systemic fix (days)
                default          => 0.50,
            };

            // ── 4. Simplicity ─────────────────────────────────────────────
            // Single clear action vs multi-step cognitive load
            $simplicity = match($type) {
                'bill_overdue'   => 0.92,   // one button
                'overload'       => 0.62,   // review plan + confirm (2 steps, guided)
                'store_risk'     => 0.38,   // diagnose which tasks + who to fix
                'low_throughput' => 0.22,   // diagnose + process change + track
                default          => 0.50,
            };

            // ── 5. Confidence ─────────────────────────────────────────────
            // Directly from the Problem object's evidence quality
            $confidence = min(1.0, max(0.0, (float)($p['confidence'] ?? 0.50)));

            // ── Total score (weighted sum) ────────────────────────────────
            $totalScore = round(
                $riskRed    * (float)($pw['risk_reduction'] ?? 0.35)
              + $safety      * (float)($pw['safety']         ?? 0.25)
              + $speed       * (float)($pw['speed']          ?? 0.15)
              + $simplicity  * (float)($pw['simplicity']     ?? 0.10)
              + $confidence  * (float)($pw['confidence']     ?? 0.15)
            , 3);

            // ── Human-readable action descriptor ─────────────────────────
            $ovCount = (int)($p['overdue_count'] ?? 1);
            $actionDesc = match($type) {
                'overload'       => $hasHint
                    ? $p['plan_hint']['summary']
                    : ('Review AI rebalance plan for ' . ($p['title'] ?? 'this member')),
                'store_risk'     => 'Clear ' . $ovCount . ' overdue task' . ($ovCount !== 1 ? 's' : '') . ' at ' . ($p['title'] ?? 'this store'),
                'bill_overdue'   => 'Pay ' . $ovCount . ' overdue bill' . ($ovCount !== 1 ? 's' : '') . ' now',
                'low_throughput' => 'Run team retrospective + identify bottlenecks',
                default          => $p['action_label'] ?? 'Take action',
            };

            // ── Recommendation label ──────────────────────────────────────
            $rec = match(true) {
                $totalScore >= 0.75 => ['label' => 'Do this first', 'color' => '#22C55E'],
                $totalScore >= 0.55 => ['label' => 'High priority',  'color' => '#F59E0B'],
                $totalScore >= 0.38 => ['label' => 'After above',    'color' => '#60A5FA'],
                default             => ['label' => 'Monitor',        'color' => '#94A3B8'],
            };

            $scored[] = array_merge($p, [
                'total_score'   => $totalScore,
                'dimensions'    => [
                    'risk_reduction' => round($riskRed,    2),
                    'safety'         => round($safety,     2),
                    'speed'          => round($speed,      2),
                    'simplicity'     => round($simplicity, 2),
                    'confidence'     => round($confidence, 2),
                ],
                'action_desc'         => $actionDesc,
                'recommendation'      => $rec['label'],
                'recommendation_color'=> $rec['color'],
                // priority_order filled after sort below
            ]);
        }

        // Sort by total_score descending
        usort($scored, fn($a, $b) => $b['total_score'] <=> $a['total_score']);

        // Stamp priority_order
        foreach ($scored as $i => &$s) { $s['priority_order'] = $i + 1; }
        unset($s);

        return $scored;
    }

    /** Load the decision engine config (cached after first load). */
    private function decisionConfig(): array
    {
        static $dc = null;
        if ($dc === null) {
            $path = __DIR__ . '/../config/decision_engine.php';
            $dc   = file_exists($path) ? require $path : [];
        }
        return $dc;
    }

    // =========================================================================
    // 7. CONFIDENCE SCORING
    // =========================================================================

    public function confidenceScore(array $action): float
    {
        $cc   = $this->cfg['confidence'] ?? [];
        $conf = (float)($cc['base'] ?? 0.50);

        if ($action['urgency'] === 'overdue')          $conf += (float)($cc['overdue_boost']     ?? 0.20);
        if ($action['urgency'] === 'today')            $conf += (float)($cc['today_boost']        ?? 0.15);
        if ((float)($action['amount'] ?? 0) > 1000)   $conf += (float)($cc['high_amount_boost']  ?? 0.10);
        if (!empty($action['biz_critical']))           $conf += (float)($cc['biz_critical_boost'] ?? 0.10);

        $min = (float)($cc['min'] ?? 0.10);
        $max = (float)($cc['max'] ?? 1.00);
        return round(min($max, max($min, $conf)), 2);
    }

    public function confidenceLabel(float $conf): string
    {
        if ($conf >= 0.85) return 'High confidence';
        if ($conf >= 0.65) return 'Likely helpful';
        if ($conf >= 0.45) return 'Suggested review';
        return 'Low signal';
    }

    private function rebalanceConfidence(int $overdue, int $loadScore): float
    {
        $base = 0.50;
        $base += min(0.30, $overdue * 0.06);
        $base += min(0.20, ($loadScore / 100) * 0.20);
        return round(min(1.0, $base), 2);
    }

    // =========================================================================
    // 8. ADAPTIVE WEIGHTS
    // =========================================================================

    /**
     * Adaptive weight amplification: boost weights based on current data state.
     * Call before compute() to get context-tuned scoring.
     */
    public function adaptWeightsToContext(): self
    {
        $today = $this->today;
        $ac    = $this->cfg['adaptive'] ?? [];
        $role  = $this->role;

        // Bill crisis
        $overdueBillCount = (int)($this->db->fetch(
            "SELECT COUNT(*) AS cnt FROM bills WHERE status IN ('overdue','pending') AND due_date < ?",
            [$today]
        )['cnt'] ?? 0);

        if ($overdueBillCount >= (int)($ac['bill_crisis_threshold'] ?? 5)) {
            $amp = (float)($ac['bill_amplifier'] ?? 1.5);
            $max = (int)($ac['bill_max'] ?? 50);
            $this->weights['is_bill']      = min($max, (int)($this->weights['is_bill']      * $amp));
            $this->weights['amount_gt_1000']= min($max, (int)(($this->weights['amount_gt_1000'] ?? 15) * $amp));
        }

        // Task crisis
        $overdueTaskCount = (int)($this->db->fetch(
            "SELECT COUNT(*) AS cnt FROM tasks WHERE is_completed=0 AND due_date < ?",
            [$today]
        )['cnt'] ?? 0);

        if ($overdueTaskCount >= (int)($ac['task_crisis_threshold'] ?? 10)) {
            $amp = (float)($ac['task_amplifier'] ?? 1.25);
            $max = (int)($ac['task_max'] ?? 150);
            $this->weights['overdue'] = min($max, (int)($this->weights['overdue'] * $amp));
        }

        // Team overload crisis
        if ($role === 'manager' || $role === 'admin') {
            $overloadedCount = (int)($this->db->fetch(
                "SELECT COUNT(DISTINCT t.assignee_id) AS cnt FROM (
                     SELECT assignee_id FROM tasks
                     WHERE is_completed=0 AND due_date < ? AND assignee_id IS NOT NULL
                     GROUP BY assignee_id HAVING COUNT(*) >= 5
                 ) t",
                [$today]
            )['cnt'] ?? 0);

            if ($overloadedCount >= (int)($ac['overload_count_threshold'] ?? 2)) {
                $amp = (float)($ac['overload_amplifier'] ?? 1.5);
                $max = (int)($ac['overload_max'] ?? 50);
                $this->weights['overload_user'] = min($max, (int)(($this->weights['overload_user'] ?? 15) * $amp));
            }
        }

        $this->computed = null; // clear cache
        return $this;
    }

    // =========================================================================
    // 9. DATA FETCHING
    // =========================================================================

    private function fetchItems(): array
    {
        $items = [];

        foreach ($this->fetchBills() as $b) {
            $urgency = $this->urgencyBucket($b);
            if ($urgency === 'clear') continue;
            $items[] = [
                'type'          => 'bill',
                'id'            => (int)$b['id'],
                'title'         => $b['title'] ?? '',
                'due_date'      => $b['due_date'] ?? null,
                'amount'        => (float)($b['amount'] ?? 0),
                'status'        => $b['status'] ?? 'pending',
                'business_name' => $b['store_name'] ?? '',
                'store_id'      => (int)($b['store_id'] ?? 0),
                'category'      => $b['category'] ?? 'general',
                'vendor'        => $b['vendor_label'] ?? '',
                'urgency'       => $urgency,
                'url'           => APP_URL . '/bills/' . (int)$b['id'],
                'action_text'   => $urgency === 'overdue' ? 'Pay Now →' : 'View →',
                'biz_critical'  => (bool)($b['biz_critical'] ?? false),
                'recurring'     => (bool)($b['repeat_type'] ?? false),
                'score'         => 0,
                'priority'      => 'medium',
            ];
        }

        foreach ($this->fetchTasks() as $t) {
            $urgency = $this->urgencyBucket($t);
            if ($urgency === 'clear') continue;
            $items[] = [
                'type'           => 'task',
                'id'             => (int)$t['id'],
                'title'          => $t['title'] ?? '',
                'due_date'       => $t['due_date'] ?? null,
                'amount'         => 0,
                'status'         => $t['status'] ?? '',
                'business_name'  => $t['store_name'] ?? ($t['project_name'] ?? ''),
                'store_id'       => (int)($t['store_id'] ?? 0),
                'category'       => 'task',
                'vendor'         => '',
                'urgency'        => $urgency,
                'url'            => APP_URL . '/tasks/' . (int)$t['id'],
                'action_text'    => 'Complete →',
                'biz_critical'   => (bool)($t['biz_critical'] ?? false),
                'user_overloaded'=> (bool)($t['user_overloaded'] ?? false),
                'recurring'      => false,
                'score'          => 0,
                'assignee_name'  => $t['assignee_name'] ?? '',
                'priority'       => $t['priority'] ?? 'medium',
            ];
        }

        return $items;
    }

    private function fetchBills(): array
    {
        $bizOverdue = [];
        $bizRows = $this->db->fetchAll(
            "SELECT store_id, COUNT(*) AS cnt FROM bills
             WHERE status IN ('overdue','pending') AND due_date < ?
             GROUP BY store_id HAVING cnt >= 2",
            [$this->today]
        );
        foreach ($bizRows as $r) $bizOverdue[(int)$r['store_id']] = true;

        $bills = $this->db->fetchAll(
            "SELECT b.id, b.title, b.due_date, b.amount, b.status, b.category, b.repeat_type,
                    s.id as store_id, s.name as store_name,
                    COALESCE(v.name, b.vendor) as vendor_label
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             LEFT JOIN vendors v ON b.vendor_id = v.id
             WHERE b.status IN ('overdue','pending')
               AND b.due_date <= DATE_ADD(?, INTERVAL 14 DAY)
             ORDER BY b.due_date ASC
             LIMIT 60",
            [$this->today]
        );

        foreach ($bills as &$b) {
            $b['biz_critical'] = !empty($bizOverdue[(int)$b['store_id']]);
        }
        return $bills;
    }

    private function fetchTasks(): array
    {
        $overloadedUsers = [];
        if ($this->role !== 'staff') {
            $ol = $this->db->fetchAll(
                "SELECT assignee_id, COUNT(*) AS cnt FROM tasks
                 WHERE is_completed=0 AND due_date < ? AND assignee_id IS NOT NULL
                 GROUP BY assignee_id HAVING cnt >= 5",
                [$this->today]
            );
            foreach ($ol as $r) $overloadedUsers[(int)$r['assignee_id']] = true;
        }

        // Flag businesses with critical overdue counts
        $bizCritical = [];
        $bcRows = $this->db->fetchAll(
            "SELECT p.store_id, COUNT(*) AS cnt FROM tasks t
             JOIN projects p ON p.id = t.project_id
             WHERE t.is_completed=0 AND t.due_date < ? AND p.store_id IS NOT NULL
             GROUP BY p.store_id HAVING cnt >= 5",
            [$this->today]
        );
        foreach ($bcRows as $r) $bizCritical[(int)$r['store_id']] = true;

        $userFilter = '';
        $params     = [$this->weekEnd];
        if ($this->role === 'staff') {
            $userFilter = ' AND t.assignee_id = ?';
            $params[]   = $this->userId;
        }

        $tasks = $this->db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.status, t.priority, t.is_completed,
                    t.assignee_id,
                    u.name as assignee_name,
                    s.id as store_id, s.name as store_name,
                    p.name as project_name
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             WHERE t.is_completed = 0
               AND (t.due_date IS NULL OR t.due_date <= ?)
               {$userFilter}
             ORDER BY t.due_date ASC, FIELD(t.priority,'urgent','high','medium','low')
             LIMIT 60",
            $params
        );

        foreach ($tasks as &$t) {
            $t['user_overloaded'] = !empty($overloadedUsers[(int)($t['assignee_id'] ?? 0)]);
            $t['biz_critical']    = !empty($bizCritical[(int)($t['store_id'] ?? 0)]);
        }
        return $tasks;
    }

    // =========================================================================
    // 10. INSIGHT + SUGGESTION GENERATION
    // =========================================================================

    private function generateInsights(array $scored, array $rawItems): array
    {
        $insights = [];

        $overdueBills = array_filter($scored, fn($a) => $a['type'] === 'bill' && $a['urgency'] === 'overdue');
        if (count($overdueBills) > 0) {
            $totalAmt = array_sum(array_column($overdueBills, 'amount'));
            $n = count($overdueBills);
            $insights[] = [
                'level'  => 'critical',
                'icon'   => '💳',
                'text'   => "{$n} overdue bill" . ($n > 1 ? 's' : '')
                            . ($totalAmt > 0 ? ' totaling $' . number_format($totalAmt, 0) : ''),
                'action' => 'View Bills →',
                'url'    => APP_URL . '/bills',
            ];
        }

        // Business with most overdue bills
        $bizOverdue = [];
        foreach ($overdueBills as $b) {
            $bn = $b['business_name'] ?: 'Unknown';
            $bizOverdue[$bn] = ($bizOverdue[$bn] ?? 0) + 1;
        }
        arsort($bizOverdue);
        foreach ($bizOverdue as $bname => $cnt) {
            if ($cnt >= 2) {
                $insights[] = [
                    'level'  => 'critical',
                    'icon'   => '🏢',
                    'text'   => "{$bname} is at risk — {$cnt} unpaid bills",
                    'action' => 'Review →',
                    'url'    => APP_URL . '/bills',
                ];
                break;
            }
        }

        $overdueTasks = array_filter($scored, fn($a) => $a['type'] === 'task' && $a['urgency'] === 'overdue');
        if (count($overdueTasks) > 0) {
            $n = count($overdueTasks);
            if ($this->role !== 'staff') {
                $byUser = [];
                foreach ($overdueTasks as $t) {
                    $un = $t['assignee_name'] ?? 'Unassigned';
                    $byUser[$un] = ($byUser[$un] ?? 0) + 1;
                }
                arsort($byUser);
                $topUser = array_key_first($byUser);
                $topCnt  = $byUser[$topUser];
                if ($topCnt >= 3) {
                    $insights[] = [
                        'level'  => 'warning',
                        'icon'   => '👤',
                        'text'   => "{$topUser} is falling behind — {$topCnt} overdue tasks",
                        'action' => 'View Team →',
                        'url'    => APP_URL . '/team',
                    ];
                } else {
                    $insights[] = [
                        'level'  => 'warning',
                        'icon'   => '⚡',
                        'text'   => "{$n} task" . ($n > 1 ? 's' : '') . " across the team are overdue",
                        'action' => 'View Team →',
                        'url'    => APP_URL . '/team',
                    ];
                }
            } else {
                $insights[] = [
                    'level'  => 'warning',
                    'icon'   => '⚡',
                    'text'   => "You have {$n} overdue task" . ($n > 1 ? 's' : '') . " — complete these first",
                    'action' => 'View Tasks →',
                    'url'    => APP_URL . '/my-tasks',
                ];
            }
        }

        $dueToday = array_filter($scored, fn($a) => $a['urgency'] === 'today');
        if (count($dueToday) > 0 && count($insights) < 4) {
            $n = count($dueToday);
            $insights[] = [
                'level'  => 'info',
                'icon'   => '📅',
                'text'   => "{$n} item" . ($n > 1 ? 's' : '') . " due today — keep the momentum",
                'action' => 'View →',
                'url'    => APP_URL . ($this->role === 'staff' ? '/my-tasks' : '/bills'),
            ];
        }

        if (empty($insights)) {
            $insights[] = [
                'level'  => 'ok',
                'icon'   => '✅',
                'text'   => 'No urgent items — all obligations are on track',
                'action' => 'Full Report →',
                'url'    => APP_URL . '/overview',
            ];
        }

        return array_slice($insights, 0, 5);
    }

    private function generateSuggestions(array $insights): array
    {
        $suggestions = [];
        $typeMap = [
            '💳' => ['title' => 'Clear overdue bills',                     'type' => 'bill'],
            '🏢' => ['title' => 'Review business risk',                    'type' => 'business'],
            '👤' => ['title' => 'Reassign or support overloaded member',   'type' => 'team'],
            '⚡' => ['title' => 'Complete overdue tasks',                  'type' => 'task'],
            '📅' => ['title' => 'Clear today\'s items',                   'type' => 'today'],
        ];
        foreach ($insights as $ins) {
            $map = $typeMap[$ins['icon']] ?? null;
            if (!$map) continue;
            $suggestions[] = [
                'title'      => $map['title'],
                'reason'     => $ins['text'],
                'priority'   => $ins['level'] === 'critical' ? 'high' : 'medium',
                'action_url' => $ins['url'],
                'type'       => $map['type'],
            ];
        }
        return $suggestions;
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private function buildReason(array $a): string
    {
        $reason = '';
        switch ($a['urgency']) {
            case 'overdue':
                $d       = $a['due_date'] ? substr($a['due_date'], 0, 10) : null;
                $days    = $d ? max(0, (int)((strtotime($this->today) - strtotime($d)) / 86400)) : 0;
                $reason  = $days > 0 ? "{$days}d overdue" : "Past due";
                if (!empty($a['biz_critical'])) $reason .= ' · business at risk';
                break;
            case 'today': $reason = 'Due today — do this now'; break;
            case 'week':  $reason = 'Due this week — schedule time'; break;
            default:      $reason = 'Coming up — plan ahead';
        }
        if ((float)($a['amount'] ?? 0) > 1000)
            $reason .= ' · $' . number_format((float)$a['amount'], 0) . ' at stake';
        return $reason;
    }

    private function itemIcon(array $a): string
    {
        if ($a['type'] === 'bill') {
            return $a['urgency'] === 'overdue' ? '🔴' : '💳';
        }
        return match($a['urgency']) {
            'overdue' => '🔥',
            'today'   => '⚡',
            'week'    => '📅',
            default   => '📋',
        };
    }

    private function itemColor(array $a): string
    {
        return match($a['urgency']) {
            'overdue' => '#EF4444',
            'today'   => '#F59E0B',
            'week'    => '#3B82F6',
            default   => '#94A3B8',
        };
    }

    private function rebalanceText(array $member, array $dest, int $taskCount): string
    {
        $to = !empty($dest['member']['name']) ? $dest['member']['name'] : 'another team member';
        return "Move {$taskCount} overdue task" . ($taskCount > 1 ? 's' : '')
            . " from {$member['name']} to {$to}";
    }

    private function userStats(int $userId): array
    {
        $row = $this->db->fetch(
            "SELECT u.id, u.name,
                    SUM(CASE WHEN t.is_completed=0 THEN 1 ELSE 0 END) AS open,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
                    SUM(CASE WHEN t.is_completed=0 AND t.due_date BETWEEN ? AND DATE_ADD(?,INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS due_week,
                    SUM(CASE WHEN t.is_completed=1 AND (t.due_date IS NULL OR t.updated_at <= t.due_date) THEN 1 ELSE 0 END) AS on_time_done,
                    SUM(CASE WHEN t.is_completed=1 THEN 1 ELSE 0 END) AS total_done
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id
             WHERE u.id = ?
             GROUP BY u.id, u.name",
            [$this->today, $this->today, $this->today, $userId]
        );
        if (!$row) return ['id' => $userId, 'name' => '', 'open' => 0, 'overdue' => 0, 'due_week' => 0, 'on_time_pct' => 100];
        $done = max(1, (int)$row['total_done']);
        $row['on_time_pct'] = (int)round((int)$row['on_time_done'] / $done * 100);
        return $row;
    }
}
