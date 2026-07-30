<?php
/**
 * Release Model — Draft-First Development Architecture
 * 
 * Manages release lifecycle: Draft → Review → QA → Approve → Schedule → Publish
 */
class Release
{
    private $db;

    // All valid release states
    const STATES = [
        'draft', 'ready_for_review', 'qa_running', 'qa_passed',
        'approved', 'scheduled', 'published', 'archived',
        'rolled_back', 'changes_requested'
    ];

    // State transitions: from => [allowed targets]
    const TRANSITIONS = [
        'draft'             => ['ready_for_review', 'archived'],
        'ready_for_review'  => ['qa_running', 'changes_requested', 'draft'],
        'qa_running'        => ['qa_passed', 'changes_requested', 'draft'],
        'qa_passed'         => ['approved', 'changes_requested'],
        'approved'          => ['scheduled', 'published'],
        'scheduled'         => ['published', 'approved', 'archived'],
        'published'         => ['rolled_back', 'archived'],
        'archived'          => ['draft'],
        'rolled_back'       => ['draft', 'archived'],
        'changes_requested' => ['draft', 'ready_for_review'],
    ];

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void
    {
        if (defined('SKIP_SCHEMA_CHECKS') && SKIP_SCHEMA_CHECKS) return;

        if (!$this->db->tableExists('releases')) {
            $sql = file_get_contents(__DIR__ . '/../database/migrations/2026_05_29_release_management.sql');
            $statements = array_filter(array_map('trim', explode(';', $sql)));
            foreach ($statements as $stmt) {
                if (!empty($stmt) && $stmt !== '--') {
                    $this->db->execute($stmt);
                }
            }
        }

        if ($this->db->tableExists('releases') && !$this->db->columnExists('releases', 'walkthrough_release_qa')) {
            $this->db->execute(
                "ALTER TABLE releases
                 ADD COLUMN walkthrough_release_qa ENUM('pass','fail','pending') DEFAULT NULL AFTER walkthrough_admin"
            );
            $this->db->invalidateSchemaCache('releases', 'walkthrough_release_qa');
        }
    }

    private function insertRow(string $table, array $data): int
    {
        $columns = array_keys($data);
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $sql = sprintf(
            "INSERT INTO %s (%s) VALUES (%s)",
            $table,
            implode(', ', $columns),
            $placeholders
        );

        return (int)$this->db->insert($sql, array_values($data));
    }

    private function updateRow(string $table, array $data, string $where, array $whereParams = []): int
    {
        if (!$data) return 0;

        $sets = array_map(fn($column) => $column . ' = ?', array_keys($data));
        $sql = sprintf(
            "UPDATE %s SET %s WHERE %s",
            $table,
            implode(', ', $sets),
            $where
        );

        return $this->db->update($sql, array_merge(array_values($data), $whereParams));
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public function create(array $data): int
    {
        return $this->insertRow('releases', [
            'name'          => $data['name'],
            'version'       => $data['version'],
            'title'         => $data['title'] ?? null,
            'summary'       => $data['summary'] ?? null,
            'branch'        => $data['branch'] ?? null,
            'commit_hash'   => $data['commit_hash'] ?? null,
            'build_date'    => $data['build_date'] ?? date('Y-m-d H:i:s'),
            'owner_id'      => $data['owner_id'] ?? null,
            'status'        => 'draft',
            'preview_url'   => $data['preview_url'] ?? null,
            'release_notes' => $data['release_notes'] ?? null,
            'change_log'    => $data['change_log'] ?? null,
            'bug_fixes'     => $data['bug_fixes'] ?? null,
            'known_issues' => $data['known_issues'] ?? null,
            'risk_notes'    => $data['risk_notes'] ?? null,
            'rollback_notes'=> $data['rollback_notes'] ?? null,
            'rollback_contact'     => $data['rollback_contact'] ?? null,
            'release_window_notes' => $data['release_window_notes'] ?? null,
        ]);
    }

    public function findById(int $id): ?array
    {
        return $this->db->fetch("SELECT * FROM releases WHERE id = ?", [$id]) ?: null;
    }

    public function update(int $id, array $data): void
    {
        $this->updateRow('releases', $data, 'id = ?', [$id]);
    }

    public function delete(int $id): void
    {
        $this->db->delete("DELETE FROM releases WHERE id = ?", [$id]);
    }

    // ── Listing & Filtering ──────────────────────────────────────────────────

    public function getAll(array $filters = [], int $limit = 50, int $offset = 0): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['status'])) {
            $where[] = 'r.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['owner_id'])) {
            $where[] = 'r.owner_id = ?';
            $params[] = $filters['owner_id'];
        }
        if (!empty($filters['search'])) {
            $where[] = '(r.name LIKE ? OR r.version LIKE ? OR r.branch LIKE ?)';
            $s = '%' . $filters['search'] . '%';
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        // Defensive: only join r.published_by when the column exists
        // (preview DB may lag behind this code path; see Phase 0 SQLSTATE errors).
        $hasPublishedBy = $this->db->columnExists('releases', 'published_by');
        $publishedBySelect = $hasPublishedBy
            ? 'pu.name AS published_by_name'
            : 'NULL AS published_by_name';
        $publishedByJoin = $hasPublishedBy
            ? 'LEFT JOIN users pu ON pu.id = r.published_by'
            : '';

        $sql = "SELECT r.*, u.name AS owner_name,
                       {$publishedBySelect}
                FROM releases r
                LEFT JOIN users u ON u.id = r.owner_id
                {$publishedByJoin}
                WHERE " . implode(' AND ', $where) . "
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;

        return $this->db->fetchAll($sql, $params);
    }

    public function countAll(array $filters = []): int
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['status'])) {
            $where[] = 'status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['owner_id'])) {
            $where[] = 'owner_id = ?';
            $params[] = $filters['owner_id'];
        }

        $row = $this->db->fetch(
            "SELECT COUNT(*) AS cnt FROM releases WHERE " . implode(' AND ', $where),
            $params
        );
        return (int)($row['cnt'] ?? 0);
    }

    public function getUpcoming(int $limit = 10): array
    {
        return $this->db->fetchAll(
            "SELECT r.*, u.name AS owner_name
             FROM releases r
             LEFT JOIN users u ON u.id = r.owner_id
             WHERE r.status IN ('draft','ready_for_review','qa_running','qa_passed','approved','scheduled')
             ORDER BY FIELD(r.status, 'scheduled','approved','qa_passed','qa_running','ready_for_review','draft'), r.created_at DESC
             LIMIT ?",
            [$limit]
        );
    }

    public function getByStatus(string $status): array
    {
        return $this->db->fetchAll(
            "SELECT r.*, u.name AS owner_name
             FROM releases r
             LEFT JOIN users u ON u.id = r.owner_id
             WHERE r.status = ?
             ORDER BY r.created_at DESC",
            [$status]
        );
    }

    // ── State Machine ────────────────────────────────────────────────────────

    public function canTransition(string $from, string $to): bool
    {
        return isset(self::TRANSITIONS[$from]) && in_array($to, self::TRANSITIONS[$from], true);
    }

    public function transition(int $id, string $newStatus, ?int $userId = null, ?string $reason = null): bool
    {
        $release = $this->findById($id);
        if (!$release) return false;

        if (!$this->canTransition($release['status'], $newStatus)) {
            return false;
        }

        $updateData = ['status' => $newStatus];

        // Set timestamps for specific transitions
        if ($newStatus === 'published') {
            $updateData['published_at'] = date('Y-m-d H:i:s');
            $updateData['published_by'] = $userId;
        } elseif ($newStatus === 'rolled_back') {
            $updateData['rolled_back_at'] = date('Y-m-d H:i:s');
            if ($reason) $updateData['rollback_reason'] = $reason;
        }

        $this->update($id, $updateData);
        $this->logAudit($id, 'status_change', $userId, [
            'from' => $release['status'],
            'to' => $newStatus,
        ], $reason);

        return true;
    }

    // ── Production Protection ────────────────────────────────────────────────

    public function canPublish(int $id): array
    {
        $release = $this->findById($id);
        if (!$release) return ['allowed' => false, 'reasons' => ['Release not found']];

        $reasons = [];

        if (!$release['qa_pass']) {
            $reasons[] = 'QA has not passed';
        }
        if (!$release['walkthrough_pass']) {
            $reasons[] = 'Walkthrough has not passed';
        }
        if (!$release['confidence_pass']) {
            $reasons[] = 'Confidence score below threshold';
        }
        if (!$release['approval_complete']) {
            $reasons[] = 'Approval not complete';
        }
        if ($this->hasActiveFreeze()) {
            $reasons[] = 'Active deploy freeze in effect';
        }

        return [
            'allowed' => empty($reasons),
            'reasons' => $reasons,
        ];
    }

    public function canSchedule(int $id): array
    {
        $release = $this->findById($id);
        if (!$release) return ['allowed' => false, 'reasons' => ['Release not found']];

        $reasons = [];

        if (!in_array($release['status'], ['approved', 'scheduled'])) {
            $reasons[] = 'Release must be approved before scheduling';
        }
        if (!$release['qa_pass']) {
            $reasons[] = 'QA has not passed';
        }
        if (!$release['walkthrough_pass']) {
            $reasons[] = 'Walkthrough has not passed';
        }

        return [
            'allowed' => empty($reasons),
            'reasons' => $reasons,
        ];
    }

    public function hasActiveFreeze(): bool
    {
        if (!$this->db->tableExists('deploy_freezes')) return false;

        $now = date('Y-m-d H:i:s');
        $row = $this->db->fetch(
            "SELECT COUNT(*) AS cnt FROM deploy_freezes
             WHERE is_active = 1 AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)",
            [$now, $now]
        );
        return (int)($row['cnt'] ?? 0) > 0;
    }

    // ── Scheduling ───────────────────────────────────────────────────────────

    public function schedule(int $id, string $scheduledAt, string $timezone = 'Asia/Ho_Chi_Minh', ?int $userId = null): bool
    {
        $release = $this->findById($id);
        if (!$release) return false;

        if (!in_array($release['status'], ['approved', 'scheduled'])) {
            return false;
        }

        $this->update($id, [
            'status' => 'scheduled',
            'scheduled_at' => $scheduledAt,
            'scheduled_timezone' => $timezone,
        ]);

        $this->logAudit($id, 'scheduled', $userId, [
            'scheduled_at' => $scheduledAt,
            'timezone' => $timezone,
        ]);

        return true;
    }

    public function cancelSchedule(int $id, ?int $userId = null): bool
    {
        $release = $this->findById($id);
        if (!$release || $release['status'] !== 'scheduled') return false;

        $this->update($id, [
            'status' => 'approved',
            'scheduled_at' => null,
        ]);

        $this->logAudit($id, 'schedule_cancelled', $userId);
        return true;
    }

    public function getDueForPublish(): array
    {
        $now = date('Y-m-d H:i:s');
        return $this->db->fetchAll(
            "SELECT * FROM releases WHERE status = 'scheduled' AND scheduled_at <= ?",
            [$now]
        );
    }

    // ── Walkthroughs ─────────────────────────────────────────────────────────

    public function updateWalkthrough(int $id, string $role, string $status, ?int $userId = null): bool
    {
        $validRoles = ['ceo', 'manager', 'member', 'admin'];
        if (!in_array($role, $validRoles)) return false;
        if (!in_array($status, ['pass', 'fail', 'pending'])) return false;

        $col = 'walkthrough_' . $role;
        $this->update($id, [$col => $status]);

        // Check if all walkthroughs pass
        $release = $this->findById($id);
        $allPass = $release['walkthrough_ceo'] === 'pass'
            && $release['walkthrough_manager'] === 'pass'
            && $release['walkthrough_member'] === 'pass'
            && $release['walkthrough_admin'] === 'pass';

        if ($allPass) {
            $this->update($id, ['walkthrough_pass' => 1]);
        }

        $this->logAudit($id, 'walkthrough_updated', $userId, [
            'role' => $role,
            'status' => $status,
        ]);

        return true;
    }

    // ── Reviews ──────────────────────────────────────────────────────────────

    public function addReview(int $releaseId, int $userId, string $type, ?string $body = null): int
    {
        $id = $this->insertRow('release_reviews', [
            'release_id' => $releaseId,
            'user_id'    => $userId,
            'type'       => $type,
            'body'       => $body,
        ]);

        $this->logAudit($releaseId, 'review_' . $type, $userId, ['body' => $body]);

        // If approval, check if all required approvals are met
        if ($type === 'approval') {
            $this->update($releaseId, ['approval_complete' => 1]);
        }

        // If changes requested, transition status
        if ($type === 'changes_requested') {
            $this->transition($releaseId, 'changes_requested', $userId, $body);
        }

        return $id;
    }

    public function getReviews(int $releaseId): array
    {
        return $this->db->fetchAll(
            "SELECT rr.*, u.name AS user_name, u.role AS user_role
             FROM release_reviews rr
             LEFT JOIN users u ON u.id = rr.user_id
             WHERE rr.release_id = ?
             ORDER BY rr.created_at DESC",
            [$releaseId]
        );
    }

    // ── Shareable Links ──────────────────────────────────────────────────────

    public function createLink(int $releaseId, int $createdBy, string $type = 'view_only', ?string $label = null, ?string $expiresAt = null): array
    {
        $token = bin2hex(random_bytes(32));

        $this->insertRow('release_links', [
            'release_id' => $releaseId,
            'token'      => $token,
            'type'       => $type,
            'label'      => $label,
            'created_by' => $createdBy,
            'expires_at' => $expiresAt,
        ]);

        $this->logAudit($releaseId, 'link_created', $createdBy, [
            'type' => $type,
            'label' => $label,
            'expires_at' => $expiresAt,
        ]);

        return ['token' => $token, 'type' => $type];
    }

    public function findByToken(string $token): ?array
    {
        $link = $this->db->fetch(
            "SELECT rl.*, r.* FROM release_links rl
             JOIN releases r ON r.id = rl.release_id
             WHERE rl.token = ? AND rl.is_active = 1",
            [$token]
        );

        if (!$link) return null;

        // Check expiry
        if ($link['expires_at'] && strtotime($link['expires_at']) < time()) {
            return null;
        }

        // Increment use count
        $this->db->execute(
            "UPDATE release_links SET use_count = use_count + 1 WHERE token = ?",
            [$token]
        );

        return $link;
    }

    public function getLinks(int $releaseId): array
    {
        return $this->db->fetchAll(
            "SELECT rl.*, u.name AS created_by_name
             FROM release_links rl
             LEFT JOIN users u ON u.id = rl.created_by
             WHERE rl.release_id = ?
             ORDER BY rl.created_at DESC",
            [$releaseId]
        );
    }

    public function deactivateLink(int $linkId, ?int $userId = null): void
    {
        $this->updateRow('release_links', ['is_active' => 0], 'id = ?', [$linkId]);
    }

    // ── Audit Log ────────────────────────────────────────────────────────────

    public function logAudit(int $releaseId, string $action, ?int $userId = null, ?array $details = null, ?string $reason = null): void
    {
        $this->insertRow('release_audit_log', [
            'release_id' => $releaseId,
            'user_id'    => $userId,
            'action'     => $action,
            'details'    => $details ? json_encode($details) : null,
            'reason'     => $reason,
        ]);
    }

    public function getAuditLog(int $releaseId, int $limit = 50): array
    {
        return $this->db->fetchAll(
            "SELECT ral.*, u.name AS user_name
             FROM release_audit_log ral
             LEFT JOIN users u ON u.id = ral.user_id
             WHERE ral.release_id = ?
             ORDER BY ral.created_at DESC
             LIMIT ?",
            [$releaseId, $limit]
        );
    }

    // ── Deploy Freeze ────────────────────────────────────────────────────────

    public function createFreeze(string $reason, int $startedBy, ?string $endsAt = null): int
    {
        return $this->insertRow('deploy_freezes', [
            'reason'     => $reason,
            'started_by' => $startedBy,
            'ends_at'    => $endsAt,
        ]);
    }

    public function endFreeze(int $freezeId): void
    {
        $this->updateRow('deploy_freezes', ['is_active' => 0], 'id = ?', [$freezeId]);
    }

    public function getActiveFreezes(): array
    {
        if (!$this->db->tableExists('deploy_freezes')) return [];

        $now = date('Y-m-d H:i:s');
        return $this->db->fetchAll(
            "SELECT df.*, u.name AS started_by_name
             FROM deploy_freezes df
             LEFT JOIN users u ON u.id = df.started_by
             WHERE df.is_active = 1 AND df.starts_at <= ? AND (df.ends_at IS NULL OR df.ends_at > ?)
             ORDER BY df.starts_at DESC",
            [$now, $now]
        );
    }

    // ── Stats for Dashboard ──────────────────────────────────────────────────

    public function getStats(): array
    {
        $row = $this->db->fetch(
            "SELECT
                SUM(status = 'draft') AS drafts,
                SUM(status = 'ready_for_review') AS awaiting_review,
                SUM(status IN ('qa_running','qa_passed')) AS in_qa,
                SUM(status = 'approved') AS approved,
                SUM(status = 'scheduled') AS scheduled,
                SUM(status = 'published') AS published,
                SUM(status = 'rolled_back') AS rolled_back
             FROM releases"
        );

        return [
            'drafts'          => (int)($row['drafts'] ?? 0),
            'awaiting_review' => (int)($row['awaiting_review'] ?? 0),
            'in_qa'           => (int)($row['in_qa'] ?? 0),
            'approved'        => (int)($row['approved'] ?? 0),
            'scheduled'       => (int)($row['scheduled'] ?? 0),
            'published'       => (int)($row['published'] ?? 0),
            'rolled_back'     => (int)($row['rolled_back'] ?? 0),
        ];
    }

    // ── Permission Helpers ───────────────────────────────────────────────────

    public function canUserPublish(array $user): bool
    {
        return ($user['role'] ?? '') === 'admin';
    }

    public function canUserSchedule(array $user): bool
    {
        return ($user['role'] ?? '') === 'admin';
    }

    public function canUserApprove(array $user): bool
    {
        return ($user['role'] ?? '') === 'admin';
    }

    public function canUserApproveReview(array $user): bool
    {
        return in_array($user['role'] ?? '', ['admin', 'ceo'], true);
    }

    public function canUserReview(array $user): bool
    {
        return in_array($user['role'], ['admin', 'ceo', 'manager']);
    }

    public function canUserCreateDraft(array $user): bool
    {
        // All roles can create drafts (developers deploy to draft)
        return true;
    }

    public function canUserRollback(array $user): bool
    {
        return ($user['role'] ?? '') === 'admin';
    }

    // ── Current Live Version ─────────────────────────────────────────────────

    public function getCurrentLiveVersion(): ?array
    {
        $hasPublishedBy = $this->db->columnExists('releases', 'published_by');
        $publisherSelect = $hasPublishedBy
            ? 'u.name AS published_by_name, u.email AS published_by_email'
            : 'NULL AS published_by_name, NULL AS published_by_email';
        $publisherJoin = $hasPublishedBy
            ? 'LEFT JOIN users u ON u.id = r.published_by'
            : '';

        $row = $this->db->fetch(
            "SELECT r.*, {$publisherSelect}
             FROM releases r
             {$publisherJoin}
             WHERE r.status = 'published'
             ORDER BY r.published_at DESC
             LIMIT 1"
        );
        return $row ?: null;
    }

    public function getPublishedByName(?int $userId): string
    {
        if (!$userId) return 'System';
        $row = $this->db->fetch("SELECT name FROM users WHERE id = ?", [$userId]);
        return $row['name'] ?? 'Unknown';
    }

    // ── Timeline ────────────────────────────────────────────────────────────

    public function getTimeline(int $releaseId): array
    {
        $log = $this->getAuditLog($releaseId, 100);

        $eventOrder = [
            'created'            => ['label' => 'Draft Created',           'icon' => 'D', 'color' => '#a78bfa'],
            'updated'            => ['label' => 'Updated',               'icon' => 'E', 'color' => '#a78bfa'],
            'ready_for_review'   => ['label' => 'Sent for Review',        'icon' => 'R', 'color' => '#fbbf24'],
            'qa_started'         => ['label' => 'QA Started',             'icon' => 'Q', 'color' => '#60a5fa'],
            'qa_passed'         => ['label' => 'QA Passed',              'icon' => 'Q', 'color' => '#34d399'],
            'review_approval'    => ['label' => 'Reviewed & Approved',    'icon' => 'A', 'color' => '#10b981'],
            'scheduled'         => ['label' => 'Scheduled',              'icon' => 'S', 'color' => '#93c5fd'],
            'published'         => ['label' => 'Published to Production','icon' => 'P', 'color' => '#4ade80'],
            'rolled_back'       => ['label' => 'Rolled Back',            'icon' => 'X', 'color' => '#fca5a5'],
            'archived'          => ['label' => 'Archived',               'icon' => 'Z', 'color' => '#71717a'],
            'changes_requested' => ['label' => 'Changes Requested',      'icon' => 'C', 'color' => '#fb923c'],
            'schedule_cancelled'=> ['label' => 'Schedule Cancelled',     'icon' => 'X', 'color' => '#71717a'],
        ];

        $timeline = [];
        foreach ($log as $entry) {
            $action = $entry['action'];
            $info = $eventOrder[$action] ?? ['label' => ucwords(str_replace('_', ' ', $action)), 'icon' => 'O', 'color' => '#71717a'];
            $details = $entry['details'] ? json_decode($entry['details'], true) : [];

            $timeline[] = [
                'icon'   => $info['icon'],
                'label'  => $info['label'],
                'color'  => $info['color'],
                'user'   => $entry['user_name'] ?? 'System',
                'time'   => $entry['created_at'],
                'reason' => $entry['reason'] ?? null,
                'details'=> $details,
            ];
        }

        return $timeline;
    }

    // ── Enhanced Update (structured version notes) ─────────────────────────

    public function updateFull(int $id, array $data): void
    {
        $allowed = [
            'name', 'version', 'title', 'summary', 'change_log',
            'bug_fixes', 'known_issues', 'risk_notes',
            'rollback_notes', 'rollback_contact', 'release_window_notes',
            'branch', 'commit_hash', 'preview_url', 'release_notes',
            'qa_score', 'confidence_score', 'confidence_letter',
        ];

        $filtered = array_intersect_key($data, array_flip($allowed));

        if (!empty($filtered)) {
            $this->update($id, $filtered);
        }
    }

    // ── Confidence Letter ──────────────────────────────────────────────────

    public function computeConfidenceLetter(?float $score): ?string
    {
        if ($score === null) return null;
        if ($score >= 95) return 'S';
        if ($score >= 85) return 'A';
        if ($score >= 75) return 'B';
        if ($score >= 60) return 'C';
        return 'D';
    }

    // ── Dashboard Summary ──────────────────────────────────────────────────

    public function getDashboardSummary(): array
    {
        $live = $this->getCurrentLiveVersion();
        $stats = $this->getStats();
        $upcoming = $this->getUpcoming(3);
        $freezes = $this->getActiveFreezes();

        return [
            'live'       => $live,
            'stats'      => $stats,
            'upcoming'   => $upcoming,
            'has_freeze' => !empty($freezes),
            'freeze'     => $freezes[0] ?? null,
        ];
    }
}
