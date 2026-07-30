<?php
class PenaltyController {
    private Penalty     $model;
    private User        $userModel;
    private PenaltyRule $ruleModel;

    public function __construct() {
        $this->model     = new Penalty();
        $this->userModel = new User();
        $this->ruleModel = new PenaltyRule();
    }

    // ── Admin: management page ────────────────────────────────────────────────

    public function adminIndex(): void {
        if (!isAdmin()) { redirect('overview'); return; }

        $summaries    = $this->model->getAllSummaries();
        $allMembers   = $this->userModel->getAll();
        $penalizedIds = array_column($summaries, 'user_id');

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($_SESSION['user_id']);
        $projects      = (new Project())->getByUser($_SESSION['user_id'], true);

        require __DIR__ . '/../views/admin/penalty_config.php';
    }

    // ── Admin: add or re-enable a member ─────────────────────────────────────

    public function adminAdd(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $userId = (int)($_POST['user_id'] ?? 0);
        $amount = (float)($_POST['amount'] ?? 0);
        $note   = trim($_POST['note'] ?? '');

        if ($userId <= 0 || $amount < 0) {
            json_response(['error' => 'Invalid input'], 422);
            return;
        }

        $ok = $this->model->addUser($userId, $amount, (int)$_SESSION['user_id'], $note);
        if ($ok) {
            json_response(['ok' => true, 'message' => 'Đã thêm thành viên vào danh sách phạt.']);
        } else {
            json_response(['error' => 'Lỗi khi lưu cấu hình.'], 500);
        }
    }

    // ── Admin: update penalty amount ─────────────────────────────────────────

    public function adminUpdate(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $userId = (int)($_POST['user_id'] ?? 0);
        $amount = (float)($_POST['amount'] ?? 0);

        if ($userId <= 0 || $amount < 0) {
            json_response(['error' => 'Invalid input'], 422);
            return;
        }

        $this->model->updateAmount($userId, $amount);
        json_response(['ok' => true, 'message' => 'Đã cập nhật mức phạt.']);
    }

    // ── Admin: disable (soft-remove) a member ────────────────────────────────

    public function adminRemove(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $userId = (int)($_POST['user_id'] ?? 0);
        if ($userId <= 0) { json_response(['error' => 'Invalid user'], 422); return; }

        $this->model->removeUser($userId);
        json_response(['ok' => true, 'message' => 'Đã tắt phạt cho thành viên (lịch sử được giữ lại).']);
    }

    // ── Admin: toggle active/inactive ────────────────────────────────────────

    public function adminToggle(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $userId = (int)($_POST['user_id'] ?? 0);
        $active = (bool)(int)($_POST['active'] ?? 0);
        if ($userId <= 0) { json_response(['error' => 'Invalid user'], 422); return; }

        $this->model->toggleUser($userId, $active);
        json_response(['ok' => true]);
    }

    // ── Admin API: detail breakdown for one member ────────────────────────────

    public function adminDetail(int $userId): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }

        $detail = $this->model->getUserDetail($userId);
        if (empty($detail)) { json_response(['error' => 'Not found'], 404); return; }

        json_response(['ok' => true, 'data' => $detail]);
    }

    // ── Admin API: all summaries (JSON) ───────────────────────────────────────

    public function adminSummaryApi(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }

        $summaries = $this->model->getAllSummaries();
        json_response(['ok' => true, 'data' => $summaries]);
    }

    // ── Member API: own penalty summary ──────────────────────────────────────

    public function mySummaryApi(): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }

        $userId = (int)$_SESSION['user_id'];
        if (!$this->model->isUserPenalized($userId)) {
            json_response(['ok' => true, 'penalized' => false]);
            return;
        }

        $detail = $this->model->getUserDetail($userId);
        json_response([
            'ok'        => true,
            'penalized' => true,
            'summary'   => [
                'total_amount'    => $detail['total_amount'],
                'late_count'      => $detail['late_count'],
                'amount_per_task' => $detail['config']['amount_per_late_task'],
            ],
        ]);
    }

    // ── Admin penalties dashboard ─────────────────────────────────────────────

    public function adminDashboard(): void {
        if (!isAdmin()) { redirect('overview'); return; }

        $filters = [
            'period'    => $_GET['period']    ?? 'month',
            'sort'      => $_GET['sort']      ?? 'created_at',
            'dir'       => $_GET['dir']       ?? 'desc',
            'user_id'   => (int)($_GET['user_id'] ?? 0),
            'date_from' => $_GET['date_from'] ?? '',
            'date_to'   => $_GET['date_to']   ?? '',
        ];

        $tab     = $_GET['tab'] ?? 'log';
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $perPage = 25;

        $summary  = $this->model->getAdminKpis();
        $config   = $this->ruleModel->getDefaultRule();
        $config   = ['penalty_amount' => $config['suggested_amount'], 'currency' => $config['currency']];
        $allRules = $this->ruleModel->getAll();

        $paged      = $this->model->getPaginatedLog($filters, $page, $perPage);
        $penalties  = $paged['rows'];
        $total      = $paged['total'];
        $totalPages = (int)ceil($total / $perPage);

        $byUser    = $this->model->getByUser($filters);
        $byProject = $this->model->getByProject($filters);
        $byStore   = $this->model->getByStore($filters);
        $appeals   = $this->ruleModel->getAllPendingAppeals();

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($_SESSION['user_id']);
        $projects      = (new Project())->getByUser($_SESSION['user_id'], true);

        require __DIR__ . '/../views/admin/penalties/index.php';
    }

    // ── Admin penalties: update global config ─────────────────────────────────

    public function adminDashboardConfig(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $amount   = (float)($_POST['penalty_amount'] ?? 500000);
        $currency = in_array($_POST['currency'] ?? 'VND', ['VND', 'USD']) ? $_POST['currency'] : 'VND';

        $existing = Database::getInstance()->fetch(
            "SELECT id FROM penalty_rules WHERE rule_type='task_overdue' ORDER BY id LIMIT 1"
        );
        if ($existing) {
            Database::getInstance()->execute(
                "UPDATE penalty_rules SET suggested_amount=?, currency=?, updated_at=NOW() WHERE id=?",
                [$amount, $currency, (int)$existing['id']]
            );
        }

        set_flash('success', 'Penalty config saved.');
        redirect('admin/penalties');
    }

    // ── Admin: penalty rules management ──────────────────────────────────────

    public function adminRulesIndex(): void {
        if (!isAdmin()) { redirect('overview'); return; }

        $rules  = $this->ruleModel->getAll();
        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($_SESSION['user_id']);
        $projects      = (new Project())->getByUser($_SESSION['user_id'], true);

        require __DIR__ . '/../views/admin/penalty_rules.php';
    }

    public function adminRuleSave(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $data = [
            'id'              => (int)($_POST['id'] ?? 0),
            'name'            => trim($_POST['name'] ?? ''),
            'description'     => trim($_POST['description'] ?? ''),
            'rule_type'       => $_POST['rule_type'] ?? 'custom',
            'suggested_amount'=> (float)($_POST['suggested_amount'] ?? 500000),
            'currency'        => in_array($_POST['currency'] ?? 'VND', ['VND','USD']) ? $_POST['currency'] : 'VND',
            'is_active'       => (int)(bool)($_POST['is_active'] ?? 1),
            'effective_date'  => $_POST['effective_date'] ?? date('Y-m-d'),
        ];

        if (empty($data['name'])) { json_response(['error' => 'Name required'], 422); return; }

        $id = $this->ruleModel->save($data, (int)$_SESSION['user_id']);
        json_response(['ok' => true, 'id' => $id, 'message' => 'Rule saved.']);
    }

    public function adminRuleToggle(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $id     = (int)($_POST['id'] ?? 0);
        $active = (bool)(int)($_POST['active'] ?? 0);
        if ($id <= 0) { json_response(['error' => 'Invalid id'], 422); return; }

        $this->ruleModel->toggle($id, $active);
        json_response(['ok' => true]);
    }

    public function adminRuleDelete(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $id = (int)($_POST['id'] ?? 0);
        if ($id <= 0) { json_response(['error' => 'Invalid id'], 422); return; }
        $this->ruleModel->delete($id);
        json_response(['ok' => true]);
    }

    // ── User: my penalties page ───────────────────────────────────────────────

    public function userMyPenalties(): void {
        if (!isLoggedIn()) { redirect('login'); return; }

        $userId  = (int)$_SESSION['user_id'];
        $data    = $this->model->getMyPenaltySummary($userId);
        $appeals = $this->ruleModel->getAppealsForUser($userId);

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($userId);
        $projects      = (new Project())->getByUser($userId, true);

        require __DIR__ . '/../views/penalties/my_penalties.php';
    }

    // ── User: submit appeal ───────────────────────────────────────────────────

    public function submitAppeal(): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $logId  = (int)($_POST['penalty_log_id'] ?? 0);
        $reason = trim($_POST['reason'] ?? '');
        $userId = (int)$_SESSION['user_id'];

        if ($logId <= 0 || empty($reason)) {
            json_response(['error' => 'Missing required fields'], 422);
            return;
        }

        $ok = $this->ruleModel->submitAppeal($logId, $userId, $reason);
        if ($ok) json_response(['ok' => true, 'message' => 'Appeal submitted.']);
        else     json_response(['error' => 'Could not submit appeal (may already exist).'], 409);
    }

    // ── Admin: review appeal ──────────────────────────────────────────────────

    public function adminReviewAppeal(): void {
        if (!isAdmin()) { json_response(['error' => 'Unauthorized'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $id     = (int)($_POST['appeal_id'] ?? 0);
        $status = in_array($_POST['status'] ?? '', ['approved','rejected']) ? $_POST['status'] : null;
        $note   = trim($_POST['admin_note'] ?? '');

        if ($id <= 0 || !$status) { json_response(['error' => 'Invalid input'], 422); return; }

        $this->ruleModel->reviewAppeal($id, $status, (int)$_SESSION['user_id'], $note);
        json_response(['ok' => true, 'message' => 'Appeal reviewed.']);
    }

    // ── Manager: team penalty dashboard ──────────────────────────────────────

    public function managerDashboard(): void {
        if (!isManager()) { redirect('overview'); return; }

        $userId  = (int)$_SESSION['user_id'];
        $data    = $this->model->getManagerDashboard($userId);
        $appeals = $this->ruleModel->getAllPendingAppeals();

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($userId);
        $projects      = (new Project())->getByUser($userId, true);

        require __DIR__ . '/../views/manager/penalties.php';
    }

    // ── CEO: read-only penalty summary ────────────────────────────────────────

    public function ceoSummary(): void {
        if (!isCeo() && !isAdmin()) { redirect('overview'); return; }

        $summaries   = $this->model->getAllSummaries();
        $total       = array_sum(array_column($summaries, 'total_amount'));
        $penalized   = count($summaries);
        $pageTitle   = 'Penalty Overview';
        $currentPage = 'ceo-penalties';

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount((int)$_SESSION['user_id']);
        $projects      = (new Project())->getByUser((int)$_SESSION['user_id'], canAdmin());

        ob_start();
        require __DIR__ . '/../views/admin/penalties/ceo_summary.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }
}
