<?php
/**
 * ObligationController — API endpoints for obligation registry,
 * dashboard widgets, reviewer workspace, and approver workspace.
 *
 * CEO Compliance & Payment Operations — Phase 3/4/5
 */
class ObligationController
{
    private $obligation;
    private $service;

    public function __construct()
    {
        $this->obligation = new Obligation();
        $this->service    = new ObligationService();
    }

    // ──────────────────────────────────────────────────────────
    // PUBLIC PAGES
    // ──────────────────────────────────────────────────────────

    /** GET /obligations — Management page */
    public function index()
    {
        requireAdmin();
        $categories = $this->obligation->getCategories(false);
        $obligations = $this->obligation->findAll([]);
        $stores = (new Store())->allActive();
        $users = (new User())->getActive();
        require __DIR__ . '/../views/obligations/index.php';
    }

    /** GET /obligations/:id — Detail page */
    public function show(int $id)
    {
        requireAdmin();
        $obl = $this->obligation->findById($id);
        if (!$obl) { flash('error', 'Obligation not found.'); redirect('obligations'); return; }
        $payments = $this->obligation->findPayments(['obligation_id' => $id, 'limit' => 50]);
        $categories = $this->obligation->getCategories();
        $stores = (new Store())->allActive();
        $users = (new User())->getActive();
        require __DIR__ . '/../views/obligations/show.php';
    }

    /** POST /obligations — Create */
    public function store()
    {
        requireAdmin();
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid token.'); redirect('obligations'); return; }

        $id = $this->obligation->create($_POST);
        if ($id) {
            flash('success', 'Obligation created.');
        } else {
            flash('error', 'Failed to create obligation.');
        }
        redirect('obligations/' . $id);
    }

    /** POST /obligations/:id — Update */
    public function update(int $id)
    {
        requireAdmin();
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid token.'); redirect('obligations/' . $id); return; }

        $ok = $this->obligation->update($id, $_POST);
        flash($ok ? 'success' : 'error', $ok ? 'Obligation updated.' : 'No changes made.');
        redirect('obligations/' . $id);
    }

    /** POST /obligations/:id/delete — Delete */
    public function delete(int $id)
    {
        requireAdmin();
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid token.'); redirect('obligations'); return; }
        $this->obligation->delete($id);
        flash('success', 'Obligation deleted.');
        redirect('obligations');
    }

    /** POST /obligations/generate — Trigger task generation */
    public function generate()
    {
        requireAdmin();
        $count = $this->service->generateDueOccurrences();
        flash('success', "Generated {$count} payment occurrence(s).");
        redirect('obligations');
    }

    // ──────────────────────────────────────────────────────────
    // DASHBOARD WIDGETS API
    // Returns JSON for AJAX loading in CEO dashboard
    // ──────────────────────────────────────────────────────────

    /** GET /api/obligations/kpis */
    public function apiKpis()
    {
        header('Content-Type: application/json');
        try {
            $kpis = $this->obligation->getDashboardKpis();
            json_response(['ok' => true, 'data' => $kpis]);
        } catch (Throwable $e) {
            json_response(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /** GET /api/obligations/widgets/:name */
    public function apiWidget(string $name)
    {
        header('Content-Type: application/json');
        try {
            $limit = max(1, (int)($_GET['limit'] ?? 20));
            $data = match ($name) {
                'upcoming'          => $this->obligation->widgetUpcoming(30, $limit),
                'overdue'           => $this->obligation->widgetOverdue($limit),
                'tax_filings'       => $this->obligation->widgetUpcomingTaxFilings(60, $limit),
                'renewals'          => $this->obligation->widgetUpcomingRenewals(60, $limit),
                'missing_evidence'  => $this->obligation->widgetMissingEvidence($limit),
                'awaiting_approval' => $this->obligation->widgetAwaitingApproval($limit),
                default             => throw new InvalidArgumentException("Unknown widget: $name"),
            };
            json_response(['ok' => true, 'data' => $data, 'count' => count($data)]);
        } catch (Throwable $e) {
            json_response(['ok' => false, 'error' => $e->getMessage()], 400);
        }
    }

    // ──────────────────────────────────────────────────────────
    // REVIEWER WORKSPACE
    // ──────────────────────────────────────────────────────────

    /** GET /obligations/reviewer — Reviewer's queue */
    public function reviewerQueue()
    {
        requireManager();
        $userId = (int)$_SESSION['user_id'];

        // Pending items assigned to this reviewer
        $pending = $this->obligation->findPayments([
            'reviewer_id' => $userId,
            'status'      => Obligation::STATUS_PENDING,
            'limit'       => 50,
        ]);

        // Items needing evidence
        $missingEvidence = $this->obligation->findPayments([
            'reviewer_id'   => $userId,
            'needs_evidence' => true,
            'limit'        => 20,
        ]);

        // Approved by reviewer, awaiting approver
        $awaitingApprover = $this->obligation->findPayments([
            'reviewer_id' => $userId,
            'status'      => Obligation::STATUS_REVIEW,
            'limit'       => 50,
        ]);

        require __DIR__ . '/../views/obligations/reviewer.php';
    }

    /** POST /api/obligations/review/:id */
    public function apiReview(int $id)
    {
        header('Content-Type: application/json');
        $userId = (int)$_SESSION['user_id'];
        if (!canManage() && $userId !== $userId) { json_response(['error' => 'Forbidden'], 403); }

        $result = trim($_POST['result'] ?? '');
        $notes  = trim($_POST['notes'] ?? '') ?: null;

        if (!in_array($result, ['approved','rejected','changes_requested'], true)) {
            json_response(['error' => 'Invalid result. Must be: approved, rejected, or changes_requested'], 400);
        }

        $ok = $this->obligation->recordReviewerResult($id, $result, $notes, $userId);
        json_response(['ok' => $ok, 'result' => $result]);
    }

    // ──────────────────────────────────────────────────────────
    // APPROVER WORKSPACE
    // ──────────────────────────────────────────────────────────

    /** GET /obligations/approver — Approver's queue */
    public function approverQueue()
    {
        requireManager();
        $userId = (int)$_SESSION['user_id'];

        // Items ready for final approval (status=review)
        $pending = $this->obligation->findPayments([
            'approver_id' => $userId,
            'status'      => Obligation::STATUS_REVIEW,
            'limit'       => 50,
        ]);

        // Rejected items
        $rejected = $this->obligation->findPayments([
            'approver_id' => $userId,
            'status'      => Obligation::STATUS_REJECTED,
            'limit'       => 20,
        ]);

        require __DIR__ . '/../views/obligations/approver.php';
    }

    /** POST /api/obligations/approve/:id */
    public function apiApprove(int $id)
    {
        header('Content-Type: application/json');
        $userId = (int)$_SESSION['user_id'];
        if (!canManage() && $userId !== $userId) { json_response(['error' => 'Forbidden'], 403); }

        $result = trim($_POST['result'] ?? '');
        $notes  = trim($_POST['notes'] ?? '') ?: null;

        if (!in_array($result, ['approved','rejected','changes_requested'], true)) {
            json_response(['error' => 'Invalid result. Must be: approved, rejected, or changes_requested'], 400);
        }

        $ok = $this->obligation->recordApproverResult($id, $result, $notes, $userId);

        // If approved, also mark as paid
        if ($ok && $result === 'approved') {
            $this->obligation->markPaid($id, null, app_today(), null);
        }

        json_response(['ok' => $ok, 'result' => $result]);
    }

    // ──────────────────────────────────────────────────────────
    // PAYMENT UPDATE
    // ──────────────────────────────────────────────────────────

    /** POST /api/obligations/payment/:id */
    public function apiPayment(int $id)
    {
        header('Content-Type: application/json');
        requireLogin();

        $data = [];
        // Evidence flags
        foreach (['evidence_invoice','evidence_receipt','evidence_bank_proof','evidence_payment_confirm','evidence_other'] as $f) {
            if (isset($_POST[$f])) $data[$f] = 1;
        }
        // Amount/status
        if (isset($_POST['amount']))          $data['amount'] = $_POST['amount'];
        if (isset($_POST['status']))           $data['status']  = $_POST['status'];
        if (isset($_POST['paid_amount']))      $data['paid_amount'] = $_POST['paid_amount'];
        if (isset($_POST['paid_date']))       $data['paid_date'] = $_POST['paid_date'];
        if (isset($_POST['payment_reference']))$data['payment_reference'] = $_POST['payment_reference'];

        $ok = $this->obligation->updatePayment($id, $data);
        json_response(['ok' => $ok]);
    }

    /** GET /obligations/payment/:id — Payment detail modal/page */
    public function paymentDetail(int $id)
    {
        $payment = $this->obligation->findPayment($id);
        if (!$payment) { flash('error', 'Payment not found.'); redirect('obligations'); return; }
        requireAdmin(); // or reviewer/approver check
        $taskAttachments = [];
        if (!empty($payment['task_id'])) {
            $taskM = new Task();
            $taskAttachments = $taskM->getAttachments((int)$payment['task_id']);
        }
        require __DIR__ . '/../views/obligations/payment_detail.php';
    }
}