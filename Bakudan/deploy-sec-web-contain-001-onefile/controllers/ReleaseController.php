<?php
/**
 * ReleaseController — Admin Release Management Center
 * 
 * Handles the full release lifecycle:
 * Draft → Preview → Review → Approval → Schedule → Publish
 */
class ReleaseController
{
    private Release $release;

    public function __construct()
    {
        $this->release = new Release();
    }

    // ── List all releases (/admin/releases) ──────────────────────────────────

    public function index(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');

        $filters = [];
        if (!empty($_GET['status'])) $filters['status'] = $_GET['status'];
        if (!empty($_GET['search'])) $filters['search'] = $_GET['search'];

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;

        $releases = $this->release->getAll($filters, $limit, $offset);
        $total = $this->release->countAll($filters);
        $stats = $this->release->getStats();
        $freezes = $this->release->getActiveFreezes();

        require __DIR__ . '/../views/releases/index.php';
    }

    // ── Show single release detail (/admin/releases/{id}) ────────────────────

    public function show(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');

        $release = $this->release->findById($id);
        if (!$release) { http_response_code(404); echo '<h1>Release not found</h1>'; return; }

        $reviews = $this->release->getReviews($id);
        $links = $this->release->getLinks($id);
        $auditLog = $this->release->getAuditLog($id);
        $publishCheck = $this->release->canPublish($id);
        $user = currentUser();

        require __DIR__ . '/../views/releases/show.php';
    }

    // ── Create new draft release ─────────────────────────────────────────────

    public function create(): void
    {
        if (!isLoggedIn()) redirect('login');

        $user = currentUser();
        if (!$this->release->canUserCreateDraft($user)) {
            flash('error', 'You do not have permission to create releases.');
            redirect('admin/releases');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!verify_csrf($_POST['csrf_token'] ?? '')) {
                flash('error', 'Invalid CSRF token.');
                redirect('admin/releases/create');
            }

            $id = $this->release->create([
                'name'          => trim($_POST['name'] ?? ''),
                'version'       => trim($_POST['version'] ?? ''),
                'title'         => trim($_POST['title'] ?? '') ?: null,
                'summary'       => trim($_POST['summary'] ?? '') ?: null,
                'branch'        => trim($_POST['branch'] ?? '') ?: null,
                'commit_hash'   => trim($_POST['commit_hash'] ?? '') ?: null,
                'owner_id'      => $_SESSION['user_id'],
                'preview_url'   => trim($_POST['preview_url'] ?? '') ?: null,
                'release_notes' => trim($_POST['release_notes'] ?? '') ?: null,
                'change_log'    => trim($_POST['change_log'] ?? '') ?: null,
                'bug_fixes'     => trim($_POST['bug_fixes'] ?? '') ?: null,
                'known_issues'  => trim($_POST['known_issues'] ?? '') ?: null,
                'risk_notes'    => trim($_POST['risk_notes'] ?? '') ?: null,
                'rollback_notes'=> trim($_POST['rollback_notes'] ?? '') ?: null,
                'rollback_contact'     => trim($_POST['rollback_contact'] ?? '') ?: null,
                'release_window_notes' => trim($_POST['release_window_notes'] ?? '') ?: null,
            ]);

            $this->release->logAudit($id, 'created', $_SESSION['user_id']);
            flash('success', 'Release draft created successfully.');
            redirect('admin/releases/' . $id);
        }

        require __DIR__ . '/../views/releases/create.php';
    }

    // ── Update release details ───────────────────────────────────────────────

    public function update(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            flash('error', 'Invalid CSRF token.');
            redirect('admin/releases/' . $id);
        }

        $release = $this->release->findById($id);
        if (!$release) { flash('error', 'Release not found.'); redirect('admin/releases'); return; }

        $data = [];
        if (isset($_POST['name'])) $data['name'] = trim($_POST['name']);
        if (isset($_POST['version'])) $data['version'] = trim($_POST['version']);
        if (isset($_POST['branch'])) $data['branch'] = trim($_POST['branch']) ?: null;
        if (isset($_POST['commit_hash'])) $data['commit_hash'] = trim($_POST['commit_hash']) ?: null;
        if (isset($_POST['preview_url'])) $data['preview_url'] = trim($_POST['preview_url']) ?: null;
        if (isset($_POST['release_notes'])) $data['release_notes'] = trim($_POST['release_notes']) ?: null;
        if (isset($_POST['title'])) $data['title'] = trim($_POST['title']) ?: null;
        if (isset($_POST['summary'])) $data['summary'] = trim($_POST['summary']) ?: null;
        if (isset($_POST['change_log'])) $data['change_log'] = trim($_POST['change_log']) ?: null;
        if (isset($_POST['bug_fixes'])) $data['bug_fixes'] = trim($_POST['bug_fixes']) ?: null;
        if (isset($_POST['known_issues'])) $data['known_issues'] = trim($_POST['known_issues']) ?: null;
        if (isset($_POST['risk_notes'])) $data['risk_notes'] = trim($_POST['risk_notes']) ?: null;
        if (isset($_POST['rollback_notes'])) $data['rollback_notes'] = trim($_POST['rollback_notes']) ?: null;
        if (isset($_POST['rollback_contact'])) $data['rollback_contact'] = trim($_POST['rollback_contact']) ?: null;
        if (isset($_POST['release_window_notes'])) $data['release_window_notes'] = trim($_POST['release_window_notes']) ?: null;
        if (isset($_POST['qa_score'])) $data['qa_score'] = (float)$_POST['qa_score'];
        if (isset($_POST['confidence_score'])) $data['confidence_score'] = (float)$_POST['confidence_score'];

        $this->release->update($id, $data);
        $this->release->logAudit($id, 'updated', $_SESSION['user_id'], $data);
        flash('success', 'Release updated.');
        redirect('admin/releases/' . $id);
    }

    // ── Transition release status ────────────────────────────────────────────

    public function transition(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $newStatus = $_POST['status'] ?? '';
        $reason = trim($_POST['reason'] ?? '') ?: null;
        $user = currentUser();

        // Permission checks based on target status
        if (in_array($newStatus, ['published']) && !$this->release->canUserPublish($user)) {
            json_response(['error' => 'Insufficient permissions to publish'], 403);
        }
        if (in_array($newStatus, ['approved']) && !$this->release->canUserApprove($user)) {
            json_response(['error' => 'Insufficient permissions to approve'], 403);
        }
        if ($newStatus === 'rolled_back' && !$this->release->canUserRollback($user)) {
            json_response(['error' => 'Insufficient permissions to rollback'], 403);
        }

        // Production protection check for publish
        if ($newStatus === 'published') {
            $check = $this->release->canPublish($id);
            if (!$check['allowed']) {
                json_response([
                    'error' => 'Cannot publish — protection checks failed',
                    'reasons' => $check['reasons'],
                ], 422);
            }
        }

        $success = $this->release->transition($id, $newStatus, $_SESSION['user_id'], $reason);

        if ($success) {
            json_response(['success' => true, 'status' => $newStatus]);
        } else {
            json_response(['error' => 'Invalid state transition'], 422);
        }
    }

    // ── Schedule release ─────────────────────────────────────────────────────

    public function schedule(int $id): void
    {
        if (!isLoggedIn()) redirect('login');

        $user = currentUser();
        if (!$this->release->canUserSchedule($user)) {
            json_response(['error' => 'Insufficient permissions'], 403);
        }

        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $scheduledAt = $_POST['scheduled_at'] ?? '';
        $timezone = $_POST['timezone'] ?? 'Asia/Ho_Chi_Minh';

        if (empty($scheduledAt)) {
            json_response(['error' => 'Scheduled time is required'], 422);
        }

        $success = $this->release->schedule($id, $scheduledAt, $timezone, $_SESSION['user_id']);

        if ($success) {
            json_response(['success' => true, 'scheduled_at' => $scheduledAt]);
        } else {
            json_response(['error' => 'Cannot schedule — release must be approved first'], 422);
        }
    }

    // ── Cancel schedule ──────────────────────────────────────────────────────

    public function cancelSchedule(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!$this->release->canUserSchedule(currentUser())) {
            json_response(['error' => 'Insufficient permissions'], 403);
        }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $success = $this->release->cancelSchedule($id, $_SESSION['user_id']);
        json_response(['success' => $success]);
    }

    // ── Add review (comment/approval/changes_requested) ──────────────────────

    public function addReview(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $user = currentUser();
        $type = $_POST['type'] ?? 'comment';
        $body = trim($_POST['body'] ?? '') ?: null;

        // Permission check for approvals
        if ($type === 'approval' && !$this->release->canUserApproveReview($user)) {
            json_response(['error' => 'Insufficient permissions to approve'], 403);
        }

        $validTypes = ['comment', 'approval', 'changes_requested', 'rejection'];
        if (!in_array($type, $validTypes)) {
            json_response(['error' => 'Invalid review type'], 422);
        }

        $reviewId = $this->release->addReview($id, $_SESSION['user_id'], $type, $body);
        json_response(['success' => true, 'review_id' => $reviewId]);
    }

    // ── Create shareable link ────────────────────────────────────────────────

    public function createLink(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canAdmin()) {
            json_response(['error' => 'Only admins can create review links'], 403);
        }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $type = $_POST['type'] ?? 'view_only';
        $label = trim($_POST['label'] ?? '') ?: null;
        $expiry = $_POST['expiry'] ?? null;

        $expiresAt = null;
        if ($expiry) {
            switch ($expiry) {
                case '24h': $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours')); break;
                case '3d':  $expiresAt = date('Y-m-d H:i:s', strtotime('+3 days')); break;
                case '7d':  $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days')); break;
                default:
                    if (strtotime($expiry)) $expiresAt = date('Y-m-d H:i:s', strtotime($expiry));
            }
        }

        $link = $this->release->createLink($id, $_SESSION['user_id'], $type, $label, $expiresAt);
        $url = rtrim(APP_URL, '/') . '/release/review/' . $link['token'];

        json_response(['success' => true, 'url' => $url, 'token' => $link['token']]);
    }

    // ── Deactivate link ──────────────────────────────────────────────────────

    public function deactivateLink(int $linkId): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canAdmin()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $this->release->deactivateLink($linkId, $_SESSION['user_id']);
        json_response(['success' => true]);
    }

    // ── Public review page (via token) ───────────────────────────────────────

    public function publicReview(string $token): void
    {
        $data = $this->release->findByToken($token);
        if (!$data) {
            http_response_code(404);
            echo '<!DOCTYPE html><html><head><title>Link Expired</title>
            <style>body{font-family:system-ui;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
            .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px;text-align:center}
            h1{color:#f87171}</style></head>
            <body><div class="card"><h1>Link Expired or Invalid</h1><p>This review link is no longer active.</p></div></body></html>';
            return;
        }

        $release = $this->release->findById($data['release_id']);
        $reviews = $this->release->getReviews($data['release_id']);
        $linkType = $data['type']; // 'internal_review' or 'view_only'
        $isViewOnly = ($linkType === 'view_only');

        require __DIR__ . '/../views/releases/public_review.php';
    }

    // ── Update walkthrough status ────────────────────────────────────────────

    public function updateWalkthrough(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $role = $_POST['role'] ?? '';
        $status = $_POST['status'] ?? '';

        $success = $this->release->updateWalkthrough($id, $role, $status, $_SESSION['user_id']);
        json_response(['success' => $success]);
    }

    // ── Update QA/Confidence scores ──────────────────────────────────────────

    public function updateScores(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $data = [];
        if (isset($_POST['qa_score'])) {
            $data['qa_score'] = (float)$_POST['qa_score'];
            $data['qa_pass'] = ((float)$_POST['qa_score'] >= 80) ? 1 : 0;
        }
        if (isset($_POST['confidence_score'])) {
            $data['confidence_score'] = (float)$_POST['confidence_score'];
            $data['confidence_pass'] = ((float)$_POST['confidence_score'] >= 70) ? 1 : 0;
        }

        $this->release->update($id, $data);
        $this->release->logAudit($id, 'scores_updated', $_SESSION['user_id'], $data);
        json_response(['success' => true]);
    }

    // ── Deploy Freeze management ─────────────────────────────────────────────

    public function createFreeze(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canAdmin()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $reason = trim($_POST['reason'] ?? '');
        $endsAt = !empty($_POST['ends_at']) ? $_POST['ends_at'] : null;

        if (empty($reason)) {
            json_response(['error' => 'Reason is required'], 422);
        }

        $id = $this->release->createFreeze($reason, $_SESSION['user_id'], $endsAt);
        json_response(['success' => true, 'freeze_id' => $id]);
    }

    public function endFreeze(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canAdmin()) {
            json_response(['error' => 'Forbidden'], 403);
        }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) {
            json_response(['error' => 'Invalid CSRF token'], 403);
        }

        $this->release->endFreeze($id);
        json_response(['success' => true]);
    }

    // ── API: Get release stats (for dashboard widget) ────────────────────────

    public function apiStats(): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);

        $stats = $this->release->getStats();
        $upcoming = $this->release->getUpcoming(5);
        $freezes = $this->release->getActiveFreezes();

        json_response([
            'stats' => $stats,
            'upcoming' => $upcoming,
            'has_freeze' => !empty($freezes),
        ]);
    }

    // ── API: Publish scheduled releases (cron endpoint) ──────────────────────

    public function processScheduled(): void
    {
        $cronSecret = defined('CRON_SECRET') ? CRON_SECRET : (getenv('CRON_SECRET') ?: '');
        if ($cronSecret && ($_GET['secret'] ?? '') !== $cronSecret) {
            json_response(['error' => 'Forbidden'], 403);
        }

        $due = $this->release->getDueForPublish();
        $published = [];

        foreach ($due as $release) {
            $check = $this->release->canPublish($release['id']);
            if ($check['allowed']) {
                $this->release->transition($release['id'], 'published', null, 'Auto-published by scheduler');
                $published[] = $release['id'];
            }
        }

        json_response([
            'processed' => count($due),
            'published' => $published,
        ]);
    }

    // ── CEO Review Mode (Phase 11.7) ──────────────────────────────────────────
    // Route: /admin/releases/{id}/review

    public function ceoReview(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');

        $release  = $this->release->findById($id);
        $reviews  = [];
        $auditLog = [];

        if (!$release) {
            http_response_code(404);
            $release = null; // view checks this
        } else {
            $reviews  = $this->release->getReviews($id);
            $auditLog = $this->release->getAuditLog($id);
        }

        // Standalone HTML page (no layout wrapper)
        require __DIR__ . '/../views/admin/releases/ceo-review.php';
    }
}
