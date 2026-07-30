<?php
/**
 * Phase 8 — Module 13: Organizational Memory
 * 
 * Stores incidents, fixes, playbooks, decisions, lessons learned.
 * Prevents knowledge loss when people leave.
 */
class OrgMemory
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    /**
     * Add a memory entry
     */
    public function add(array $data): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO org_memory (memory_type, title, content, tags, store_id, related_entity_type, related_entity_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['memory_type'],
            $data['title'],
            $data['content'],
            json_encode($data['tags'] ?? []),
            $data['store_id'] ?? null,
            $data['related_entity_type'] ?? null,
            $data['related_entity_id'] ?? null,
            $data['created_by'],
        ]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Search memories
     */
    public function search(string $query, ?string $type = null, ?int $storeId = null, int $limit = 20): array
    {
        $sql = "SELECT * FROM org_memory WHERE is_archived = 0 AND (title LIKE ? OR content LIKE ?)";
        $params = ["%{$query}%", "%{$query}%"];

        if ($type) { $sql .= " AND memory_type = ?"; $params[] = $type; }
        if ($storeId) { $sql .= " AND store_id = ?"; $params[] = $storeId; }

        $sql .= " ORDER BY usefulness_score DESC, view_count DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Increment view counts
        foreach ($rows as $row) {
            $this->db->prepare("UPDATE org_memory SET view_count = view_count + 1 WHERE id = ?")->execute([$row['id']]);
        }

        return array_map(function ($row) {
            $row['tags'] = json_decode($row['tags'] ?? '[]', true);
            return $row;
        }, $rows);
    }

    /**
     * Get memories by type
     */
    public function getByType(string $type, ?int $storeId = null, int $limit = 50): array
    {
        $sql = "SELECT * FROM org_memory WHERE memory_type = ? AND is_archived = 0";
        $params = [$type];
        if ($storeId) { $sql .= " AND store_id = ?"; $params[] = $storeId; }
        $sql .= " ORDER BY created_at DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Get related memories
     */
    public function getRelated(string $entityType, int $entityId): array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM org_memory 
            WHERE related_entity_type = ? AND related_entity_id = ? AND is_archived = 0
            ORDER BY created_at DESC
        ");
        $stmt->execute([$entityType, $entityId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Rate usefulness
     */
    public function rate(int $id, float $score): bool
    {
        $stmt = $this->db->prepare("UPDATE org_memory SET usefulness_score = ? WHERE id = ?");
        return $stmt->execute([$score, $id]);
    }

    /**
     * Archive memory
     */
    public function archive(int $id): bool
    {
        $stmt = $this->db->prepare("UPDATE org_memory SET is_archived = 1 WHERE id = ?");
        return $stmt->execute([$id]);
    }

    /**
     * Get playbooks
     */
    public function getPlaybooks(?int $storeId = null): array
    {
        return $this->getByType('playbook', $storeId);
    }

    /**
     * Get lessons learned
     */
    public function getLessonsLearned(?int $storeId = null): array
    {
        return $this->getByType('lesson_learned', $storeId);
    }

    /**
     * Get recent memories
     */
    public function getRecent(int $limit = 20): array
    {
        $stmt = $this->db->prepare("SELECT * FROM org_memory WHERE is_archived = 0 ORDER BY created_at DESC LIMIT ?");
        $stmt->execute([$limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
