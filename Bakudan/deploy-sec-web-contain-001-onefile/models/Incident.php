<?php
/**
 * Incident Model - Incident Management System
 * 
 * Manages incidents with workflow states:
 * - open → acknowledged → investigating → resolved → closed
 * - Can escalate to critical at any point
 */
class Incident
{
    private $db;
    
    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }
    
    private function ensureSchema(): void
    {
        if (!$this->db->tableExists('incidents')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS incidents (
                    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    title           VARCHAR(255) NOT NULL,
                    description     TEXT DEFAULT NULL,
                    store_id        INT UNSIGNED DEFAULT NULL,
                    reported_by     INT UNSIGNED DEFAULT NULL,
                    assigned_to     INT UNSIGNED DEFAULT NULL,
                    severity        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
                    status          ENUM('open','acknowledged','investigating','resolved','closed','cancelled') NOT NULL DEFAULT 'open',
                    category        VARCHAR(100) DEFAULT NULL,
                    priority        INT DEFAULT 50,
                    resolved_at     DATETIME DEFAULT NULL,
                    closed_at       DATETIME DEFAULT NULL,
                    impact          VARCHAR(100) DEFAULT NULL,
                    root_cause      TEXT DEFAULT NULL,
                    corrective_action TEXT DEFAULT NULL,
                    escalation_level INT DEFAULT 0,
                    parent_incident_id INT UNSIGNED DEFAULT NULL,
                    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_incidents_status (status),
                    INDEX idx_incidents_severity (severity),
                    INDEX idx_incidents_store (store_id),
                    INDEX idx_incidents_assigned (assigned_to),
                    INDEX idx_incidents_created (created_at),
                    CONSTRAINT fk_incidents_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
                    CONSTRAINT fk_incidents_reporter FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
                    CONSTRAINT fk_incidents_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        
        if (!$this->db->tableExists('incident_timeline')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS incident_timeline (
                    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    incident_id   INT UNSIGNED NOT NULL,
                    user_id       INT UNSIGNED DEFAULT NULL,
                    action        VARCHAR(100) NOT NULL,
                    description   TEXT DEFAULT NULL,
                    metadata      JSON DEFAULT NULL,
                    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_timeline_incident (incident_id),
                    CONSTRAINT fk_timeline_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        
        if (!$this->db->tableExists('incident_attachments')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS incident_attachments (
                    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    incident_id   INT UNSIGNED NOT NULL,
                    filename      VARCHAR(255) NOT NULL,
                    filepath      VARCHAR(500) NOT NULL,
                    file_type     VARCHAR(100) DEFAULT NULL,
                    uploaded_by   INT UNSIGNED DEFAULT NULL,
                    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_attachment_incident (incident_id),
                    CONSTRAINT fk_attachment_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }
    
    public function create(array $data): int
    {
        $this->db->execute("
            INSERT INTO incidents (title, description, store_id, reported_by, assigned_to, severity, category, impact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ", [
            $data['title'] ?? '',
            $data['description'] ?? null,
            $data['store_id'] ?? null,
            $data['reported_by'] ?? null,
            $data['assigned_to'] ?? null,
            $data['severity'] ?? 'medium',
            $data['category'] ?? null,
            $data['impact'] ?? null
        ]);
        
        $incidentId = $this->db->getConnection()->lastInsertId();
        
        // Log creation
        $this->logTimeline($incidentId, 'created', 'Incident created', [
            'severity' => $data['severity'] ?? 'medium',
            'reported_by' => $data['reported_by'] ?? null
        ]);
        
        return $incidentId;
    }
    
    public function findById(int $id): ?array
    {
        $incident = $this->db->fetch("
            SELECT i.*, 
                   s.name as store_name,
                   u1.name as reported_by_name,
                   u2.name as assigned_to_name
            FROM incidents i
            LEFT JOIN stores s ON i.store_id = s.id
                   LEFT JOIN users u1 ON i.reported_by = u1.id
                   LEFT JOIN users u2 ON i.assigned_to = u2.id
                   WHERE i.id = ?
        ", [$id]);
        
        return $incident ?: null;
    }
    
    public function getAll(array $filters = [], int $limit = 50, int $offset = 0): array
    {
        $where = ['1=1'];
        $params = [];
        
        if (!empty($filters['status'])) {
            $where[] = 'i.status = ?';
            $params[] = $filters['status'];
        }
        
        if (!empty($filters['severity'])) {
            $where[] = 'i.severity = ?';
            $params[] = $filters['severity'];
        }
        
        if (!empty($filters['store_id'])) {
            $where[] = 'i.store_id = ?';
            $params[] = $filters['store_id'];
        }
        
        if (!empty($filters['assigned_to'])) {
            $where[] = 'i.assigned_to = ?';
            $params[] = $filters['assigned_to'];
        }
        
        if (!empty($filters['search'])) {
            $where[] = '(i.title LIKE ? OR i.description LIKE ?)';
            $params[] = '%' . $filters['search'] . '%';
            $params[] = '%' . $filters['search'] . '%';
        }
        
        if (!empty($filters['from_date'])) {
            $where[] = 'i.created_at >= ?';
            $params[] = $filters['from_date'];
        }
        
        if (!empty($filters['to_date'])) {
            $where[] = 'i.created_at <= ?';
            $params[] = $filters['to_date'];
        }
        
        $sql = "
            SELECT i.*, 
                   s.name as store_name,
                   u1.name as reported_by_name,
                   u2.name as assigned_to_name,
                   (SELECT COUNT(*) FROM incident_timeline WHERE incident_id = i.id) as timeline_count
            FROM incidents i
            LEFT JOIN stores s ON i.store_id = s.id
            LEFT JOIN users u1 ON i.reported_by = u1.id
            LEFT JOIN users u2 ON i.assigned_to = u2.id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY 
                CASE i.severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                i.created_at DESC
            LIMIT ? OFFSET ?
        ";
        
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
        
        if (!empty($filters['severity'])) {
            $where[] = 'severity = ?';
            $params[] = $filters['severity'];
        }
        
        if (!empty($filters['store_id'])) {
            $where[] = 'store_id = ?';
            $params[] = $filters['store_id'];
        }
        
        $row = $this->db->fetch("SELECT COUNT(*) as cnt FROM incidents WHERE " . implode(' AND ', $where), $params);
        return (int)($row['cnt'] ?? 0);
    }
    
    public function update(int $id, array $data): bool
    {
        $allowed = ['title', 'description', 'store_id', 'assigned_to', 'severity', 'status', 'category', 'priority', 'impact', 'root_cause', 'corrective_action'];
        $updates = [];
        $params = [];
        
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $updates[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
        
        if (empty($updates)) return false;
        
        $params[] = $id;
        return $this->db->execute("UPDATE incidents SET " . implode(', ', $updates) . " WHERE id = ?", $params) > 0;
    }
    
    public function acknowledge(int $id, int $userId): bool
    {
        return $this->transition($id, 'acknowledged', $userId, 'Incident acknowledged');
    }
    
    public function investigate(int $id, int $userId): bool
    {
        return $this->transition($id, 'investigating', $userId, 'Investigation started');
    }
    
    public function resolve(int $id, int $userId, ?string $rootCause = null, ?string $correctiveAction = null): bool
    {
        $data = [
            'status' => 'resolved',
            'resolved_at' => date('Y-m-d H:i:s')
        ];
        
        if ($rootCause) $data['root_cause'] = $rootCause;
        if ($correctiveAction) $data['corrective_action'] = $correctiveAction;
        
        $this->update($id, $data);
        $this->logTimeline($id, 'resolved', 'Incident resolved', [
            'root_cause' => $rootCause,
            'corrective_action' => $correctiveAction,
            'resolved_by' => $userId
        ]);
        
        return true;
    }
    
    public function close(int $id, int $userId): bool
    {
        $this->update($id, [
            'status' => 'closed',
            'closed_at' => date('Y-m-d H:i:s')
        ]);
        return $this->logTimeline($id, 'closed', 'Incident closed', ['closed_by' => $userId]);
    }
    
    public function cancel(int $id, int $userId, string $reason): bool
    {
        $this->update($id, ['status' => 'cancelled']);
        return $this->logTimeline($id, 'cancelled', 'Incident cancelled', [
            'reason' => $reason,
            'cancelled_by' => $userId
        ]);
    }
    
    public function escalate(int $id, int $userId, int $newLevel, ?string $reason = null): bool
    {
        $incident = $this->findById($id);
        if (!$incident) return false;
        
        // Increase severity if escalating
        $severityMap = ['low' => 'medium', 'medium' => 'high', 'high' => 'critical'];
        $newSeverity = $severityMap[$incident['severity']] ?? $incident['severity'];
        
        if ($newSeverity === 'critical' && $incident['severity'] !== 'critical') {
            $this->update($id, [
                'severity' => 'critical',
                'escalation_level' => $newLevel
            ]);
            $this->logTimeline($id, 'escalated', 'Incident escalated to critical', [
                'previous_level' => $incident['escalation_level'],
                'new_level' => $newLevel,
                'reason' => $reason,
                'escalated_by' => $userId
            ]);
        } else {
            $this->update($id, ['escalation_level' => $newLevel]);
            $this->logTimeline($id, 'escalated', "Escalation level increased to $newLevel", [
                'reason' => $reason,
                'escalated_by' => $userId
            ]);
        }
        
        return true;
    }
    
    public function assign(int $id, int $assignTo, int $assignedBy): bool
    {
        $incident = $this->findById($id);
        if (!$incident) return false;
        
        $this->update($id, ['assigned_to' => $assignTo]);
        return $this->logTimeline($id, 'assigned', 'Incident assigned', [
            'previous_assignee' => $incident['assigned_to'],
            'new_assignee' => $assignTo,
            'assigned_by' => $assignedBy
        ]);
    }
    
    public function addComment(int $id, int $userId, string $comment): bool
    {
        return $this->logTimeline($id, 'comment', $comment, ['user_id' => $userId]);
    }
    
    private function transition(int $id, string $newStatus, int $userId, string $description): bool
    {
        $incident = $this->findById($id);
        if (!$incident) return false;
        
        $this->update($id, ['status' => $newStatus]);
        return $this->logTimeline($id, 'status_change', $description, [
            'previous_status' => $incident['status'],
            'new_status' => $newStatus,
            'changed_by' => $userId
        ]);
    }
    
    private function logTimeline(int $incidentId, string $action, string $description, ?array $metadata = null): bool
    {
        return $this->db->execute("
            INSERT INTO incident_timeline (incident_id, action, description, metadata)
            VALUES (?, ?, ?, ?)
        ", [
            $incidentId,
            $action,
            $description,
            $metadata ? json_encode($metadata) : null
        ]) > 0;
    }
    
    public function getTimeline(int $incidentId): array
    {
        return $this->db->fetchAll("
            SELECT t.*, u.name as user_name
            FROM incident_timeline t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.incident_id = ?
            ORDER BY t.created_at DESC
        ", [$incidentId]);
    }
    
    public function addAttachment(int $incidentId, array $data): int
    {
        $this->db->execute("
            INSERT INTO incident_attachments (incident_id, filename, filepath, file_type, uploaded_by)
            VALUES (?, ?, ?, ?, ?)
        ", [
            $incidentId,
            $data['filename'] ?? '',
            $data['filepath'] ?? '',
            $data['file_type'] ?? null,
            $data['uploaded_by'] ?? null
        ]);
        
        return (int)$this->db->getConnection()->lastInsertId();
    }
    
    public function getAttachments(int $incidentId): array
    {
        return $this->db->fetchAll("
            SELECT a.*, u.name as uploaded_by_name
            FROM incident_attachments a
            LEFT JOIN users u ON a.uploaded_by = u.id
            WHERE a.incident_id = ?
            ORDER BY a.created_at DESC
        ", [$incidentId]);
    }
    
    public function deleteAttachment(int $id): bool
    {
        return $this->db->execute("DELETE FROM incident_attachments WHERE id = ?", [$id]) > 0;
    }
    
    public function getStats(): array
    {
        $today = date('Y-m-d');
        $weekAgo = date('Y-m-d', strtotime('-7 days'));
        $monthStart = date('Y-m-01');
        
        return [
            'total' => $this->countAll(),
            'open' => $this->countAll(['status' => 'open']),
            'acknowledged' => $this->countAll(['status' => 'acknowledged']),
            'investigating' => $this->countAll(['status' => 'investigating']),
            'resolved' => $this->countAll(['status' => 'resolved']),
            'critical' => $this->countAll(['severity' => 'critical']),
            'high' => $this->countAll(['severity' => 'high']),
            'created_today' => $this->countAll(['from_date' => $today]),
            'created_this_week' => $this->countAll(['from_date' => $weekAgo]),
            'created_this_month' => $this->countAll(['from_date' => $monthStart]),
            'avg_resolution_time' => $this->getAverageResolutionTime()
        ];
    }
    
    private function getAverageResolutionTime(): ?float
    {
        $row = $this->db->fetch("
            SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours
            FROM incidents
            WHERE resolved_at IS NOT NULL
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        
        return $row ? (float)$row['avg_hours'] : null;
    }
    
    public function getByStore(int $storeId, int $limit = 20): array
    {
        return $this->db->fetchAll("
            SELECT * FROM incidents
            WHERE store_id = ?
            ORDER BY 
                CASE severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                created_at DESC
            LIMIT ?
        ", [$storeId, $limit]);
    }
    
    public function getOpenByAssignee(int $userId): array
    {
        return $this->db->fetchAll("
            SELECT * FROM incidents
            WHERE assigned_to = ?
            AND status NOT IN ('resolved', 'closed', 'cancelled')
            ORDER BY 
                CASE severity 
                    WHEN 'critical' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                created_at DESC
        ", [$userId]);
    }
    
    public function canUserAccess(int $incidentId, int $userId, string $role): bool
    {
        if ($role === 'admin' || $role === 'ceo') return true;
        
        $incident = $this->findById($incidentId);
        if (!$incident) return false;
        
        // Check if user is assigned or reported
        if ((int)$incident['assigned_to'] === $userId) return true;
        if ((int)$incident['reported_by'] === $userId) return true;
        
        // Check if user is store manager
        if ($incident['store_id']) {
            $store = (new Store())->find($incident['store_id']);
            if ($store && (int)$store['manager_id'] === $userId) return true;
        }
        
        return false;
    }
}
