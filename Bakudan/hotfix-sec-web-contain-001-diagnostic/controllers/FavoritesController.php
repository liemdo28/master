<?php
/**
 * Phase 11.5 — Module 4: Favorites / Pinned Items
 * Quick access pinned items for CEO and managers
 */

class FavoritesController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /api/favorites — Get user's pinned items
     */
    public function index(): void
    {
        header('Content-Type: application/json');
        $userId = $_SESSION['user_id'];

        $favorites = $this->db->fetchAll(
            "SELECT * FROM user_favorites WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC",
            [$userId]
        );

        echo json_encode(['favorites' => $favorites]);
    }

    /**
     * POST /api/favorites — Pin an item
     */
    public function store(): void
    {
        header('Content-Type: application/json');
        $userId = $_SESSION['user_id'];

        $type = $_POST['type'] ?? ''; // store, report, release, employee, page
        $refId = $_POST['ref_id'] ?? null;
        $title = $_POST['title'] ?? '';
        $url = $_POST['url'] ?? '';

        if (!$type || !$title || !$url) {
            http_response_code(422);
            echo json_encode(['error' => 'Missing required fields']);
            return;
        }

        // Check if already pinned
        $existing = $this->db->fetch(
            "SELECT id FROM user_favorites WHERE user_id = ? AND type = ? AND ref_id = ?",
            [$userId, $type, $refId]
        );

        if ($existing) {
            echo json_encode(['success' => true, 'message' => 'Already pinned']);
            return;
        }

        $maxOrder = $this->db->fetch(
            "SELECT MAX(sort_order) as max_order FROM user_favorites WHERE user_id = ?",
            [$userId]
        );

        $this->db->execute(
            "INSERT INTO user_favorites (user_id, type, ref_id, title, url, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [$userId, $type, $refId, $title, $url, ($maxOrder['max_order'] ?? 0) + 1]
        );

        echo json_encode(['success' => true]);
    }

    /**
     * DELETE /api/favorites/{id} — Unpin an item
     */
    public function destroy(int $id): void
    {
        header('Content-Type: application/json');
        $userId = $_SESSION['user_id'];

        $this->db->execute(
            "DELETE FROM user_favorites WHERE id = ? AND user_id = ?",
            [$id, $userId]
        );

        echo json_encode(['success' => true]);
    }

    /**
     * POST /api/favorites/reorder — Reorder pinned items
     */
    public function reorder(): void
    {
        header('Content-Type: application/json');
        $userId = $_SESSION['user_id'];
        $order = json_decode(file_get_contents('php://input'), true)['order'] ?? [];

        foreach ($order as $i => $favId) {
            $this->db->execute(
                "UPDATE user_favorites SET sort_order = ? WHERE id = ? AND user_id = ?",
                [$i + 1, $favId, $userId]
            );
        }

        echo json_encode(['success' => true]);
    }
}
