<?php
/**
 * Phase 13.5 — Bill & Payment Deep Audit
 * CEO P0 directive: audit all bills and payment data integrity.
 *
 * GET /api/phase13-5/bill-audit   (admin or manager only)
 */
class BillAuditController
{
    private $db;
    private string $today;

    public function __construct()
    {
        $this->db    = Database::getInstance();
        $this->today = date('Y-m-d');
    }

    public function run(): void
    {
        if (!isAdmin() && !isManager()) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            exit;
        }
        // Clear opcache so stale compiled bytecode is flushed on next request
        if (function_exists('opcache_reset')) { opcache_reset(); }
        header('Content-Type: application/json; charset=utf-8');
        set_time_limit(120);

        $result = [
            'generated_at'        => date('c'),
            'today'               => $this->today,
            'schema'              => $this->schemaProbe(),
            'ws1_duplicates'      => $this->ws1Duplicates(),
            'ws2_recurrence'      => $this->ws2Recurrence(),
            'ws3_categories'      => $this->ws3Categories(),
            'ws4_store_ownership' => $this->ws4StoreOwnership(),
            'ws5_responsibility'  => $this->ws5Responsibility(),
            'ws6_payment_status'  => $this->ws6PaymentStatus(),
            'ws7_dashboard'       => $this->ws7Dashboard(),
            'ws8_reminders'       => $this->ws8Reminders(),
            'ws9_credit_card'     => $this->ws9CreditCard(),
            'ws10_store_health'   => $this->ws10StoreHealth(),
        ];

        echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── Schema probe ───────────────────────────────────────────────────────────

    private function schemaProbe(): array
    {
        $cols   = array_column($this->db->fetchAll("SHOW COLUMNS FROM bills"), 'Field');
        $tables = $this->db->fetchAll("SHOW TABLES");
        $tableList = array_map(fn($r) => array_values($r)[0], $tables);
        $total  = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills");
        $hasArch = in_array('is_archived', $cols);
        $active = $hasArch
            ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE is_archived=0")
            : $total;
        return [
            'columns'        => $cols,
            'related_tables' => array_values(array_filter($tableList, fn($t) => str_contains($t, 'bill') || str_contains($t, 'payment') || str_contains($t, 'vendor'))),
            'total_bills'    => $total,
            'active_bills'   => $active,
            'archived_bills' => $total - $active,
        ];
    }

    // ── WS1: Duplicates ────────────────────────────────────────────────────────

    private function ws1Duplicates(): array
    {
        $hasArch   = $this->db->columnExists('bills', 'is_archived');
        $archW     = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";
        $hasFinCat = $this->db->columnExists('bills', 'finance_category');
        $catSel    = $hasFinCat ? "COALESCE(finance_category,'') AS category" : "'' AS category";

        // Exact: same title + store + amount + due_date
        $groups = $this->db->fetchAll("
            SELECT MIN(id) AS canonical_id,
                   GROUP_CONCAT(id ORDER BY id SEPARATOR ',') AS all_ids,
                   COUNT(*) AS cnt, title, store_id, amount, due_date,
                   $catSel
            FROM bills
            WHERE 1=1 $archW
            GROUP BY LOWER(TRIM(title)), store_id, amount, due_date
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC, canonical_id
        ");

        $stores = $this->storeMap();
        $exact = [];
        $totalDupes = 0;
        foreach ($groups as $g) {
            $ids    = explode(',', $g['all_ids']);
            $dupes  = array_values(array_filter($ids, fn($id) => (int)$id !== (int)$g['canonical_id']));
            $totalDupes += count($dupes);
            $exact[] = [
                'canonical_id'  => (int)$g['canonical_id'],
                'duplicate_ids' => array_map('intval', $dupes),
                'dup_count'     => count($dupes),
                'title'         => $g['title'],
                'store'         => $stores[$g['store_id']] ?? 'Store #'.$g['store_id'],
                'amount'        => (float)$g['amount'],
                'due_date'      => $g['due_date'],
                'category'      => $g['category'],
                'confidence'    => 100,
                'match_reason'  => 'Exact: title + store_id + amount + due_date',
            ];
        }

        // Fuzzy: same title+store, same month, different date
        $fuzzy = $this->db->fetchAll("
            SELECT a.id AS id_a, b.id AS id_b, a.title,
                   a.store_id, a.due_date AS date_a, b.due_date AS date_b,
                   a.amount AS amount_a, b.amount AS amount_b
            FROM bills a JOIN bills b
              ON a.id < b.id
             AND LOWER(TRIM(a.title)) = LOWER(TRIM(b.title))
             AND a.store_id = b.store_id
             AND YEAR(a.due_date)  = YEAR(b.due_date)
             AND MONTH(a.due_date) = MONTH(b.due_date)
             AND a.due_date != b.due_date
             $archW AND COALESCE(b.is_archived,0)=0
            LIMIT 100
        ");

        return [
            'exact_duplicate_groups'     => $exact,
            'exact_group_count'          => count($exact),
            'total_bills_to_archive'     => $totalDupes,
            'fuzzy_same_month_diff_date' => array_map(fn($r) => [
                'id_a'   => (int)$r['id_a'], 'id_b' => (int)$r['id_b'],
                'title'  => $r['title'],
                'store'  => $stores[$r['store_id']] ?? 'Store #'.$r['store_id'],
                'date_a' => $r['date_a'], 'date_b' => $r['date_b'],
                'confidence' => 80,
                'match_reason' => 'Same title+store, same month, different due_date',
            ], $fuzzy),
            'fuzzy_count' => count($fuzzy),
            'verdict'     => count($exact) === 0 ? 'PASS' : 'FAIL',
        ];
    }

    // ── WS2: Recurrence ────────────────────────────────────────────────────────

    private function ws2Recurrence(): array
    {
        if (!$this->db->columnExists('bills', 'frequency')) {
            return ['status' => 'SCHEMA_MISSING', 'message' => 'frequency column not found', 'verdict' => 'BLOCKED'];
        }
        $hasArch = $this->db->columnExists('bills', 'is_archived');
        $archW   = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";

        $recurring = $this->db->fetchAll("
            SELECT id, title, store_id, amount, due_date, frequency, status
            FROM bills
            WHERE frequency != 'once' $archW
            ORDER BY store_id, title, due_date DESC
        ");
        $stores = $this->storeMap();

        // Group into templates
        $tpl = [];
        foreach ($recurring as $b) {
            $k = strtolower(trim($b['title'])) . '|' . $b['store_id'];
            if (!isset($tpl[$k])) {
                $tpl[$k] = ['title'=>$b['title'],'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],
                    'frequency'=>$b['frequency'],'amount'=>$b['amount'],'occurrences'=>[]];
            }
            $tpl[$k]['occurrences'][] = ['id'=>(int)$b['id'],'due_date'=>$b['due_date'],'status'=>$b['status']];
        }

        // Detect double recurrence (same month)
        $doubles = [];
        foreach ($tpl as $k => $t) {
            $months = [];
            foreach ($t['occurrences'] as $o) { $months[substr($o['due_date'],0,7)][] = $o['id']; }
            foreach ($months as $m => $ids) {
                if (count($ids) > 1) {
                    $doubles[] = ['title'=>$t['title'],'store'=>$t['store'],'month'=>$m,'bill_ids'=>$ids,'issue'=>'DOUBLE_RECURRENCE'];
                }
            }
        }

        // Overdue recurring
        $overdueRec = array_values(array_filter($recurring, fn($b) =>
            $b['due_date'] < $this->today && $b['status'] !== 'paid'
        ));

        return [
            'total_recurring_bills'   => count($recurring),
            'template_count'          => count($tpl),
            'double_recurrence_count' => count($doubles),
            'double_recurrence'       => $doubles,
            'overdue_recurring_count' => count($overdueRec),
            'overdue_recurring'       => array_slice(array_map(fn($b) => [
                'id'=>(int)$b['id'],'title'=>$b['title'],
                'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],
                'due_date'=>$b['due_date'],'frequency'=>$b['frequency'],'status'=>$b['status'],
                'days_overdue'=>(int)((strtotime($this->today)-strtotime($b['due_date']))/86400),
            ], $overdueRec), 0, 50),
            'verdict' => count($doubles) === 0 ? 'PASS' : 'FAIL',
        ];
    }

    // ── WS3: Categories ────────────────────────────────────────────────────────

    private function ws3Categories(): array
    {
        $hasFinCat = $this->db->columnExists('bills', 'finance_category');
        $hasArch   = $this->db->columnExists('bills', 'is_archived');
        $archW     = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";
        $catCol    = $hasFinCat ? 'finance_category' : 'NULL';

        $dist = $this->db->fetchAll("
            SELECT COALESCE($catCol,'MISSING') AS category, COUNT(*) AS cnt
            FROM bills WHERE 1=1 $archW
            GROUP BY category ORDER BY cnt DESC
        ");

        $missing = $this->db->fetchAll("
            SELECT id, title, store_id, amount, due_date
            FROM bills
            WHERE ($catCol IS NULL OR $catCol = '' OR $catCol = 'other') $archW
            ORDER BY due_date DESC LIMIT 50
        ");
        $stores = $this->storeMap();

        return [
            'has_finance_category_column' => $hasFinCat,
            'distribution'               => $dist,
            'missing_or_uncategorized'   => count($missing),
            'bills_needing_category'     => array_map(fn($b) => [
                'id' => (int)$b['id'], 'title' => $b['title'],
                'store' => $stores[$b['store_id']] ?? 'Store #'.$b['store_id'],
                'amount' => (float)$b['amount'], 'due_date' => $b['due_date'],
            ], $missing),
            'verdict' => count($missing) === 0 ? 'PASS' : 'WARN',
        ];
    }

    // ── WS4: Store ownership ───────────────────────────────────────────────────

    private function ws4StoreOwnership(): array
    {
        $hasArch = $this->db->columnExists('bills', 'is_archived');
        $archW   = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";

        $noStore = $this->db->fetchAll("SELECT id,title,amount,due_date FROM bills WHERE store_id IS NULL $archW");
        $invalid = $this->db->fetchAll("
            SELECT b.id,b.title,b.store_id,b.amount,b.due_date
            FROM bills b LEFT JOIN stores s ON b.store_id=s.id
            WHERE b.store_id IS NOT NULL AND s.id IS NULL $archW
        ");
        $inactive = $this->db->fetchAll("
            SELECT b.id,b.title,b.store_id,s.name AS store_name,b.amount,b.due_date
            FROM bills b JOIN stores s ON b.store_id=s.id
            WHERE COALESCE(s.is_active,1)=0 $archW
        ");

        return [
            'no_store_id_count'     => count($noStore),
            'no_store_id'           => $noStore,
            'invalid_store_id_count'=> count($invalid),
            'invalid_store_id'      => $invalid,
            'inactive_store_count'  => count($inactive),
            'inactive_store'        => $inactive,
            'verdict'               => (count($noStore) + count($invalid)) === 0 ? 'PASS' : 'FAIL',
        ];
    }

    // ── WS5: Responsibility ────────────────────────────────────────────────────

    private function ws5Responsibility(): array
    {
        $hasResp = $this->db->columnExists('bills', 'responsible_user_id');
        $hasArch = $this->db->columnExists('bills', 'is_archived');
        $archW   = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";

        if (!$hasResp) {
            return ['status'=>'SCHEMA_MISSING','message'=>'responsible_user_id column not in bills table','verdict'=>'BLOCKED'];
        }

        $noOwner = $this->db->fetchAll("
            SELECT id,title,store_id,amount,due_date,status
            FROM bills WHERE responsible_user_id IS NULL $archW
            ORDER BY due_date LIMIT 100
        ");
        $stores = $this->storeMap();

        $noChecker  = $this->db->columnExists('bills','checker_user_id')
            ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE checker_user_id IS NULL $archW") : null;
        $noApprover = $this->db->columnExists('bills','approver_user_id')
            ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE approver_user_id IS NULL $archW") : null;
        $noVerifier = $this->db->columnExists('bills','verifier_user_id')
            ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE verifier_user_id IS NULL $archW") : null;

        return [
            'no_responsible_count' => count($noOwner),
            'no_checker_count'     => $noChecker,
            'no_approver_count'    => $noApprover,
            'no_verifier_count'    => $noVerifier,
            'bills_no_owner'       => array_map(fn($b) => [
                'id'=>(int)$b['id'],'title'=>$b['title'],
                'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],
                'due_date'=>$b['due_date'],'status'=>$b['status'],
            ], $noOwner),
            'verdict' => count($noOwner) === 0 ? 'PASS' : 'WARN',
        ];
    }

    // ── WS6: Payment status ────────────────────────────────────────────────────

    private function ws6PaymentStatus(): array
    {
        $hasArch = $this->db->columnExists('bills', 'is_archived');
        $archW   = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";

        $byStatus = $this->db->fetchAll("SELECT status, COUNT(*) AS cnt FROM bills WHERE 1=1 $archW GROUP BY status");
        $hasWS    = $this->db->columnExists('bills', 'workflow_status');
        $byWS     = $hasWS ? $this->db->fetchAll("SELECT workflow_status, COUNT(*) AS cnt FROM bills WHERE 1=1 $archW GROUP BY workflow_status") : [];

        $stuck = $this->db->fetchAll("
            SELECT id, title, store_id, amount, due_date, status,
                   DATEDIFF(NOW(), due_date) AS days_overdue
            FROM bills
            WHERE status IN ('pending','overdue')
              AND due_date < DATE_SUB(NOW(), INTERVAL 30 DAY) $archW
            ORDER BY days_overdue DESC LIMIT 50
        ");
        $stores = $this->storeMap();

        $hasPaidAt = $this->db->columnExists('bills','paid_at');
        $paidNoPaidAt = $hasPaidAt
            ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='paid' AND paid_at IS NULL $archW")
            : null;

        return [
            'by_status'            => $byStatus,
            'by_workflow_status'   => $byWS,
            'stuck_30d_count'      => count($stuck),
            'stuck_30d'            => array_map(fn($b) => [
                'id'=>(int)$b['id'],'title'=>$b['title'],
                'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],
                'due_date'=>$b['due_date'],'status'=>$b['status'],
                'days_overdue'=>(int)$b['days_overdue'],
            ], $stuck),
            'paid_without_paid_at' => $paidNoPaidAt,
            'verdict'              => count($stuck) === 0 ? 'PASS' : 'WARN',
        ];
    }

    // ── WS7: Dashboard integrity ───────────────────────────────────────────────

    private function ws7Dashboard(): array
    {
        $hasArch = $this->db->columnExists('bills', 'is_archived');
        $archW   = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";
        $t = $this->today;

        $kpis = [
            ['metric'=>'Total Active Bills',                 'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE 1=1 $archW")],
            ['metric'=>'Status = overdue',                   'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='overdue' $archW")],
            ['metric'=>'Status = pending',                   'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='pending' $archW")],
            ['metric'=>'Status = paid',                      'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='paid' $archW")],
            ['metric'=>'Past due_date AND unpaid (real overdue)', 'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date<'$t' AND status!='paid' $archW")],
            ['metric'=>'Drilldown /overdue-bills count',     'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE (status='overdue' OR (due_date<'$t' AND status NOT IN ('paid'))) $archW")],
            ['metric'=>'Due in next 7 days (unpaid)',        'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date BETWEEN '$t' AND DATE_ADD('$t',INTERVAL 7 DAY) AND status='pending' $archW")],
            ['metric'=>'Due in next 30 days (unpaid)',       'db_value'=>(int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date BETWEEN '$t' AND DATE_ADD('$t',INTERVAL 30 DAY) AND status='pending' $archW")],
            ['metric'=>'Overdue total amount ($)',           'db_value'=>(float)$this->db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE (status='overdue' OR (due_date<'$t' AND status!='paid')) $archW")],
            ['metric'=>'Pending total amount ($)',           'db_value'=>(float)$this->db->fetchColumn("SELECT COALESCE(SUM(amount),0) FROM bills WHERE status='pending' $archW")],
        ];

        $overdueByStatus = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE status='overdue' $archW");
        $overdueByDate   = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE due_date<'$t' AND status!='paid' $archW");

        return [
            'kpis'                     => $kpis,
            'status_vs_date_mismatch'  => abs($overdueByStatus - $overdueByDate),
            'verdict'                  => $overdueByStatus === $overdueByDate ? 'PASS' : 'WARN',
            'note'                     => 'Mismatch means status=overdue is not in sync with due_date. Run an overdue sync job.',
        ];
    }

    // ── WS8: Reminders ────────────────────────────────────────────────────────

    private function ws8Reminders(): array
    {
        $hasReminded = $this->db->columnExists('bills', 'reminded_at');
        $hasArch     = $this->db->columnExists('bills', 'is_archived');
        $archW       = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";
        $t           = $this->today;

        $remCol = $hasReminded ? 'reminded_at' : 'NULL AS reminded_at';

        $due7 = $this->db->fetchAll("
            SELECT id, title, store_id, amount, due_date, status, $remCol
            FROM bills
            WHERE due_date BETWEEN '$t' AND DATE_ADD('$t', INTERVAL 7 DAY)
              AND status='pending' $archW
            ORDER BY due_date
        ");

        $reminded    = array_filter($due7, fn($b) => !empty($b['reminded_at']));
        $notReminded = array_filter($due7, fn($b) => empty($b['reminded_at']));

        $overdueNeverReminded = ($hasReminded && $hasArch)
            ? $this->db->fetchAll("
                SELECT id,title,store_id,amount,due_date
                FROM bills
                WHERE due_date<'$t' AND status!='paid' AND reminded_at IS NULL $archW
                ORDER BY due_date LIMIT 50
              ")
            : [];

        $stores = $this->storeMap();

        return [
            'has_reminded_at_column'   => $hasReminded,
            'due_in_7d_total'          => count($due7),
            'due_in_7d_reminded'       => count($reminded),
            'due_in_7d_not_reminded'   => count($notReminded),
            'overdue_never_reminded'   => count($overdueNeverReminded),
            'not_reminded_bills'       => array_values(array_map(fn($b) => [
                'id'=>(int)$b['id'],'title'=>$b['title'],
                'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],
                'due_date'=>$b['due_date'],
            ], $notReminded)),
            'verdict' => count($notReminded) === 0 ? 'PASS' : 'WARN',
        ];
    }

    // ── WS9: Credit card ──────────────────────────────────────────────────────

    private function ws9CreditCard(): array
    {
        $hasFinCat = $this->db->columnExists('bills', 'finance_category');
        $hasArch   = $this->db->columnExists('bills', 'is_archived');
        $archW     = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";
        $catWhere  = $hasFinCat ? "finance_category='credit_card'" : "LOWER(title) LIKE '%credit card%'";
        $t         = $this->today;

        $cc = $this->db->fetchAll("
            SELECT id, title, store_id, amount, due_date, status
            FROM bills WHERE $catWhere $archW ORDER BY store_id, due_date DESC
        ");
        $stores = $this->storeMap();

        $ccDupes = $this->db->fetchAll("
            SELECT MIN(id) AS canonical_id,
                   GROUP_CONCAT(id ORDER BY id) AS all_ids,
                   COUNT(*) AS cnt, title, store_id, amount, due_date
            FROM bills WHERE $catWhere $archW
            GROUP BY LOWER(TRIM(title)), store_id, amount, due_date
            HAVING COUNT(*) > 1
        ");

        $paid    = count(array_filter($cc, fn($b) => $b['status'] === 'paid'));
        $overdue = count(array_filter($cc, fn($b) => $b['status'] === 'overdue' || ($b['due_date'] < $t && $b['status'] !== 'paid')));

        return [
            'total_cc_bills'   => count($cc),
            'paid'             => $paid,
            'overdue'          => $overdue,
            'pending'          => count($cc) - $paid - $overdue,
            'duplicate_groups' => count($ccDupes),
            'cc_bills'         => array_map(fn($b) => [
                'id'=>(int)$b['id'],'title'=>$b['title'],
                'store'=>$stores[$b['store_id']]??'Store #'.$b['store_id'],
                'amount'=>(float)$b['amount'],'due_date'=>$b['due_date'],'status'=>$b['status'],
            ], $cc),
            'verdict' => count($ccDupes) === 0 ? 'PASS' : 'FAIL',
        ];
    }

    // ── WS10: Store health ────────────────────────────────────────────────────

    private function ws10StoreHealth(): array
    {
        $stores    = $this->db->fetchAll("SELECT id, name FROM stores WHERE is_active=1 ORDER BY name");
        $hasFinCat = $this->db->columnExists('bills', 'finance_category');
        $hasFreq   = $this->db->columnExists('bills', 'frequency');
        $hasResp   = $this->db->columnExists('bills', 'responsible_user_id');
        $hasArch   = $this->db->columnExists('bills', 'is_archived');
        $archW     = $hasArch ? "AND COALESCE(is_archived,0)=0" : "";
        $t         = $this->today;

        $result = [];
        foreach ($stores as $s) {
            $sid      = (int)$s['id'];
            $total    = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid $archW");
            $paid     = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND status='paid' $archW");
            $overdue  = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND (status='overdue' OR (due_date<'$t' AND status!='paid')) $archW");
            $recurring = $hasFreq ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND frequency!='once' $archW") : 0;

            $dupes = (int)$this->db->fetchColumn("
                SELECT COUNT(*) FROM (
                    SELECT 1 FROM bills WHERE store_id=$sid $archW
                    GROUP BY LOWER(TRIM(title)), amount, due_date HAVING COUNT(*)>1
                ) t
            ");

            $missingCat   = $hasFinCat ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND (finance_category IS NULL OR finance_category='other') $archW") : null;
            $missingOwner = $hasResp   ? (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills WHERE store_id=$sid AND responsible_user_id IS NULL $archW") : null;

            $penalty = min(100, $overdue * 2 + $dupes * 3 + (int)($missingCat ?? 0) + (int)($missingOwner ?? 0));
            $score   = max(0, 100 - $penalty);
            $grade   = $score >= 90 ? 'A' : ($score >= 75 ? 'B' : ($score >= 60 ? 'C' : ($score >= 40 ? 'D' : 'F')));

            $result[] = [
                'store_id'        => $sid,
                'store_name'      => $s['name'],
                'total_bills'     => $total,
                'paid_bills'      => $paid,
                'overdue_bills'   => $overdue,
                'recurring_bills' => $recurring,
                'dup_groups'      => $dupes,
                'missing_category'=> $missingCat,
                'missing_owner'   => $missingOwner,
                'health_score'    => $score,
                'grade'           => $grade,
            ];
        }

        usort($result, fn($a, $b) => $a['health_score'] <=> $b['health_score']);

        return [
            'store_count' => count($result),
            'stores'      => $result,
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function storeMap(): array
    {
        static $map = null;
        if ($map === null) {
            $rows = $this->db->fetchAll("SELECT id, name FROM stores");
            $map  = [];
            foreach ($rows as $r) $map[(int)$r['id']] = $r['name'];
        }
        return $map;
    }
}
