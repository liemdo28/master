<?php
/**
 * Phase 8 — Module 3: Operational Recommendation Engine
 * 
 * Generates actionable recommendations based on entity health scores,
 * predictions, and operational data. Goes beyond showing problems to
 * prescribing specific improvement actions.
 */
class RecommendationEngine
{
    private $db;
    private string $today;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
        $this->today = function_exists('app_today') ? app_today() : date('Y-m-d');
    }

    /**
     * Generate recommendations for a store based on its health
     */
    public function generateStoreRecommendations(int $storeId): array
    {
        $recommendations = [];

        // Analyze overdue tasks
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as overdue FROM tasks 
            WHERE store_id = ? AND status NOT IN ('done','cancelled') AND due_date < ?
        ");
        $stmt->execute([$storeId, $this->today]);
        $overdue = (int)$stmt->fetchColumn();

        if ($overdue > 0) {
            $recommendations[] = [
                'entity_type' => 'store',
                'entity_id' => $storeId,
                'category' => 'health_improvement',
                'priority' => $overdue > 10 ? 'urgent' : ($overdue > 5 ? 'high' : 'medium'),
                'title' => "Complete {$overdue} overdue tasks",
                'description' => "Store has {$overdue} overdue tasks dragging down health score. Prioritize completion to improve operational status.",
                'actions' => [
                    ['action' => 'review_overdue', 'label' => "Review and prioritize {$overdue} overdue tasks"],
                    ['action' => 'reassign_blocked', 'label' => 'Reassign blocked tasks to available members'],
                    ['action' => 'cancel_obsolete', 'label' => 'Cancel tasks that are no longer relevant'],
                ],
                'expected_impact' => ['health_improvement' => min(30, $overdue * 2), 'metric' => 'store_health_score'],
            ];
        }

        // Analyze bill compliance
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as unpaid FROM bills 
            WHERE store_id = ? AND status = 'pending' AND due_date < ?
        ");
        $stmt->execute([$storeId, $this->today]);
        $unpaidBills = (int)$stmt->fetchColumn();

        if ($unpaidBills > 0) {
            $recommendations[] = [
                'entity_type' => 'store',
                'entity_id' => $storeId,
                'category' => 'compliance',
                'priority' => $unpaidBills > 3 ? 'urgent' : 'high',
                'title' => "Resolve {$unpaidBills} overdue bills",
                'description' => "Overdue bills create financial risk and compliance issues.",
                'actions' => [
                    ['action' => 'pay_bills', 'label' => "Process {$unpaidBills} overdue bill payments"],
                    ['action' => 'review_vendors', 'label' => 'Review vendor payment terms'],
                    ['action' => 'setup_autopay', 'label' => 'Consider automatic payment scheduling'],
                ],
                'expected_impact' => ['health_improvement' => min(20, $unpaidBills * 5), 'metric' => 'compliance_score'],
            ];
        }

        // Analyze team training gaps
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as incomplete FROM tasks 
            WHERE store_id = ? AND title LIKE '%training%' AND status NOT IN ('done','cancelled')
        ");
        $stmt->execute([$storeId]);
        $trainingGaps = (int)$stmt->fetchColumn();

        if ($trainingGaps > 0) {
            $recommendations[] = [
                'entity_type' => 'store',
                'entity_id' => $storeId,
                'category' => 'efficiency',
                'priority' => 'medium',
                'title' => "Complete {$trainingGaps} pending training tasks",
                'description' => "Incomplete training reduces team capability and increases incident risk.",
                'actions' => [
                    ['action' => 'schedule_training', 'label' => 'Schedule dedicated training time'],
                    ['action' => 'assign_mentor', 'label' => 'Assign mentors for hands-on training'],
                ],
                'expected_impact' => ['health_improvement' => 10, 'metric' => 'training_score'],
            ];
        }

        // Persist recommendations
        foreach ($recommendations as $rec) {
            $this->storeRecommendation($rec);
        }

        return $recommendations;
    }

    /**
     * Generate recommendations for all stores
     */
    public function generateAllRecommendations(): array
    {
        $stmt = $this->db->prepare("SELECT id FROM stores WHERE is_active = 1");
        $stmt->execute();
        $storeIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $all = [];
        foreach ($storeIds as $storeId) {
            $all = array_merge($all, $this->generateStoreRecommendations($storeId));
        }
        return $all;
    }

    /**
     * Get pending recommendations for an entity
     */
    public function getRecommendations(?string $entityType = null, ?int $entityId = null, ?string $status = 'pending', int $limit = 20): array
    {
        $sql = "SELECT * FROM recommendations WHERE 1=1";
        $params = [];

        if ($entityType) { $sql .= " AND entity_type = ?"; $params[] = $entityType; }
        if ($entityId) { $sql .= " AND entity_id = ?"; $params[] = $entityId; }
        if ($status) { $sql .= " AND status = ?"; $params[] = $status; }

        $sql .= " ORDER BY FIELD(priority,'urgent','high','medium','low'), created_at DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            $row['actions'] = json_decode($row['actions'] ?? '[]', true);
            $row['expected_impact'] = json_decode($row['expected_impact'] ?? '{}', true);
            return $row;
        }, $rows);
    }

    /**
     * Accept a recommendation
     */
    public function accept(int $id, int $userId): bool
    {
        $stmt = $this->db->prepare("UPDATE recommendations SET status = 'accepted', accepted_by = ?, accepted_at = NOW() WHERE id = ?");
        return $stmt->execute([$userId, $id]);
    }

    /**
     * Reject a recommendation
     */
    public function reject(int $id): bool
    {
        $stmt = $this->db->prepare("UPDATE recommendations SET status = 'rejected' WHERE id = ?");
        return $stmt->execute([$id]);
    }

    /**
     * Mark recommendation as completed with outcome
     */
    public function complete(int $id, ?float $outcomeScore = null): bool
    {
        $stmt = $this->db->prepare("UPDATE recommendations SET status = 'completed', completed_at = NOW(), outcome_score = ? WHERE id = ?");
        return $stmt->execute([$outcomeScore, $id]);
    }

    /**
     * Get recommendation effectiveness stats
     */
    public function getEffectivenessStats(int $days = 30): array
    {
        $since = date('Y-m-d', strtotime("-{$days} days"));
        $stmt = $this->db->prepare("
            SELECT 
                category,
                COUNT(*) as total,
                SUM(status = 'completed') as completed,
                SUM(status = 'accepted') as accepted,
                SUM(status = 'rejected') as rejected,
                AVG(outcome_score) as avg_outcome
            FROM recommendations
            WHERE created_at >= ?
            GROUP BY category
        ");
        $stmt->execute([$since]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ─── PERSISTENCE ──────────────────────────────────────────────

    private function storeRecommendation(array $rec): void
    {
        // Avoid duplicates
        $stmt = $this->db->prepare("
            SELECT id FROM recommendations 
            WHERE entity_type = ? AND entity_id = ? AND title = ? AND status = 'pending'
            LIMIT 1
        ");
        $stmt->execute([$rec['entity_type'], $rec['entity_id'], $rec['title']]);
        if ($stmt->fetch()) return;

        $expiresAt = date('Y-m-d H:i:s', strtotime("+14 days"));

        $stmt = $this->db->prepare("
            INSERT INTO recommendations (entity_type, entity_id, category, priority, title, description, actions, expected_impact, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $rec['entity_type'],
            $rec['entity_id'],
            $rec['category'],
            $rec['priority'],
            $rec['title'],
            $rec['description'],
            json_encode($rec['actions']),
            json_encode($rec['expected_impact']),
            $expiresAt,
        ]);
    }
}
