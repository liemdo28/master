<?php
/**
 * TaskAudit — admin-facing audit layer on top of tasks.
 *
 * Surfaces two signals admins can't otherwise see at a glance:
 *   1. "no_evidence"      — task marked complete with zero attachments uploaded
 *   2. "broken_followup"  — recurring task completed but no next occurrence
 *                           was ever spawned (chain silently died)
 *
 * Admins flag a task (with a note), optionally attach their own evidence
 * file to the flag (separate from the task's own attachments — this is
 * the auditor's proof, not the assignee's), then resolve it once handled.
 */
class TaskAudit {
    private $db;

    private const ALLOWED_EXT = ['jpg','jpeg','png','gif','webp','pdf','doc','docx','xls','xlsx','txt'];
    private const ALLOWED_MIME = [
        'image/jpeg','image/png','image/gif','image/webp',
        'application/pdf',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
    ];

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if (!$this->db->tableExists('task_audit_flags')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS task_audit_flags (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    task_id       INT           NOT NULL,
                    flag_type     VARCHAR(30)   NOT NULL,
                    status        VARCHAR(20)   NOT NULL DEFAULT 'open',
                    note          TEXT          NULL,
                    flagged_by    INT           NOT NULL,
                    resolved_by   INT           NULL,
                    resolved_note TEXT          NULL,
                    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    resolved_at   DATETIME      NULL,
                    FOREIGN KEY (task_id)     REFERENCES tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY (flagged_by)  REFERENCES users(id),
                    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $this->db->invalidateSchemaCache('task_audit_flags');
        }

        if (!$this->db->tableExists('task_audit_evidence')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS task_audit_evidence (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    flag_id       INT           NOT NULL,
                    uploaded_by   INT           NOT NULL,
                    filename      VARCHAR(255)  NOT NULL,
                    original_name VARCHAR(255)  NOT NULL,
                    file_size     INT           NOT NULL,
                    mime_type     VARCHAR(100)  NULL,
                    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (flag_id)     REFERENCES task_audit_flags(id) ON DELETE CASCADE,
                    FOREIGN KEY (uploaded_by) REFERENCES users(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $this->db->invalidateSchemaCache('task_audit_evidence');
        }
    }

    // ── Detection ──────────────────────────────────────────────────────────────

    /**
     * Completed tasks with zero uploaded attachments — a proxy signal for
     * "marked done but no proof of work", not a definitive fraud verdict.
     * Excludes tasks that already have an OPEN flag of this type.
     */
    public function getSuspiciousCompletions(int $limit = 100): array {
        return $this->db->fetchAll("
            SELECT t.id, t.title, t.due_date, t.completed_at, t.assignee_id,
                   u.name AS assignee_name,
                   p.name AS project_name, s.name AS store_name
            FROM tasks t
            LEFT JOIN users    u ON u.id = t.assignee_id
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN stores   s ON s.id = p.store_id
            WHERE t.is_completed = 1
              AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.task_id = t.id)
              AND NOT EXISTS (
                  SELECT 1 FROM task_audit_flags f
                  WHERE f.task_id = t.id AND f.flag_type = 'no_evidence' AND f.status = 'open'
              )
            ORDER BY t.completed_at DESC
            LIMIT " . (int)$limit
        );
    }

    /**
     * Recurring tasks (repeat_type != 'none') that are completed but never
     * spawned a successor occurrence (no task points back via parent_task_id).
     * This is the "didn't create a task to follow up the work" case.
     */
    public function getBrokenFollowups(int $limit = 100): array {
        return $this->db->fetchAll("
            SELECT t.id, t.title, t.due_date, t.completed_at, t.repeat_type, t.assignee_id,
                   u.name AS assignee_name,
                   p.name AS project_name, s.name AS store_name
            FROM tasks t
            LEFT JOIN users    u ON u.id = t.assignee_id
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN stores   s ON s.id = p.store_id
            WHERE t.is_completed = 1
              AND t.repeat_type IS NOT NULL AND t.repeat_type != 'none'
              AND NOT EXISTS (SELECT 1 FROM tasks nxt WHERE nxt.parent_task_id = t.id)
              AND NOT EXISTS (
                  SELECT 1 FROM task_audit_flags f
                  WHERE f.task_id = t.id AND f.flag_type = 'broken_followup' AND f.status = 'open'
              )
            ORDER BY t.completed_at DESC
            LIMIT " . (int)$limit
        );
    }

    // ── Flags ──────────────────────────────────────────────────────────────────

    public function flagTask(int $taskId, string $type, string $note, int $adminId): int {
        $type = in_array($type, ['no_evidence', 'broken_followup', 'other'], true) ? $type : 'other';
        return (int)$this->db->insert(
            "INSERT INTO task_audit_flags (task_id, flag_type, status, note, flagged_by, created_at)
             VALUES (?, ?, 'open', ?, ?, NOW())",
            [$taskId, $type, $note, $adminId]
        );
    }

    public function resolveFlag(int $flagId, int $adminId, string $note = ''): bool {
        $this->db->execute(
            "UPDATE task_audit_flags
             SET status = 'resolved', resolved_by = ?, resolved_note = ?, resolved_at = NOW()
             WHERE id = ?",
            [$adminId, $note, $flagId]
        );
        return true;
    }

    public function getFlags(?string $status = null): array {
        $where  = 'WHERE 1=1';
        $params = [];
        if ($status) { $where .= ' AND f.status = ?'; $params[] = $status; }

        return $this->db->fetchAll("
            SELECT f.*, t.title AS task_title, t.due_date, t.completed_at,
                   fu.name AS flagged_by_name, ru.name AS resolved_by_name,
                   (SELECT COUNT(*) FROM task_audit_evidence e WHERE e.flag_id = f.id) AS evidence_count
            FROM task_audit_flags f
            JOIN tasks t        ON t.id = f.task_id
            JOIN users fu       ON fu.id = f.flagged_by
            LEFT JOIN users ru  ON ru.id = f.resolved_by
            $where
            ORDER BY f.created_at DESC
        ", $params);
    }

    public function getFlagById(int $flagId): ?array {
        return $this->db->fetch("
            SELECT f.*, t.title AS task_title
            FROM task_audit_flags f
            JOIN tasks t ON t.id = f.task_id
            WHERE f.id = ?
        ", [$flagId]) ?: null;
    }

    public function getEvidenceForFlag(int $flagId): array {
        return $this->db->fetchAll("
            SELECT e.*, u.name AS uploaded_by_name
            FROM task_audit_evidence e
            JOIN users u ON u.id = e.uploaded_by
            WHERE e.flag_id = ?
            ORDER BY e.created_at ASC
        ", [$flagId]);
    }

    public function findEvidence(int $evidenceId): ?array {
        return $this->db->fetch("SELECT * FROM task_audit_evidence WHERE id = ?", [$evidenceId]) ?: null;
    }

    // ── Evidence upload (mirrors TaskController::upload security checks) ──────

    public function isAllowedUpload(array $file): array {
        if ($file['size'] > MAX_UPLOAD_SIZE) {
            return [false, 'File quá lớn (tối đa 10MB).'];
        }
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED_EXT, true)) {
            return [false, 'Định dạng file không được hỗ trợ.'];
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->file($file['tmp_name']);
        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            return [false, 'Định dạng file không được hỗ trợ.'];
        }
        return [true, $mime];
    }

    public function storeEvidenceFile(array $file, string $mime): ?string {
        $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
        $safeName = substr($safeName, 0, 80);

        $dir = rtrim(UPLOAD_DIR, '/\\') . '/audit-evidence/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $filename = uniqid() . '_' . time() . '_' . $safeName . '.' . $ext;
        return move_uploaded_file($file['tmp_name'], $dir . $filename) ? ('audit-evidence/' . $filename) : null;
    }

    public function addEvidence(int $flagId, array $file, int $adminId): int {
        return (int)$this->db->insert(
            "INSERT INTO task_audit_evidence (flag_id, uploaded_by, filename, original_name, file_size, mime_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [$flagId, $adminId, $file['filename'], $file['original_name'], $file['file_size'], $file['mime_type']]
        );
    }
}
