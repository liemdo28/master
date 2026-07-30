<?php
/**
 * Phase 11.5 — Module 8: Dashboard Customization
 * Save/load widget layouts per user per role
 */

class DashboardCustomizationController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /api/dashboard/layout — Get user's saved layout
     */
    public function getLayout(): void
    {
        header('Content-Type: application/json');
        $userId = $_SESSION['user_id'];

        try {
            $layout = $this->db->fetch(
                "SELECT layout_json FROM user_dashboard_layouts WHERE user_id = ?",
                [$userId]
            );
            echo json_encode(['layout' => $layout ? json_decode($layout['layout_json'], true) : null]);
        } catch (\Throwable $e) {
            echo json_encode(['layout' => null]);
        }
    }

    /**
     * POST /api/dashboard/layout — Save user's layout
     */
    public function saveLayout(): void
    {
        header('Content-Type: application/json');
        $userId = $_SESSION['user_id'];
        $input = json_decode(file_get_contents('php://input'), true);
        $layout = $input['layout'] ?? [];

        if (empty($layout)) {
            http_response_code(422);
            echo json_encode(['error' => 'No layout data']);
            return;
        }

        $layoutJson = json_encode($layout);

        try {
            $existing = $this->db->fetch(
                "SELECT id FROM user_dashboard_layouts WHERE user_id = ?",
                [$userId]
            );

            if ($existing) {
                $this->db->execute(
                    "UPDATE user_dashboard_layouts SET layout_json = ?, updated_at = NOW() WHERE user_id = ?",
                    [$layoutJson, $userId]
                );
            } else {
                $this->db->execute(
                    "INSERT INTO user_dashboard_layouts (user_id, layout_json, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
                    [$userId, $layoutJson]
                );
            }

            echo json_encode(['success' => true]);
        } catch (\Throwable $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save layout']);
        }
    }

    /**
     * DELETE /api/dashboard/layout — Reset to default
     */
    public function resetLayout(): void
    {
        header('Content-Type: application/json');
        $userId = $_SESSION['user_id'];

        try {
            $this->db->execute(
                "DELETE FROM user_dashboard_layouts WHERE user_id = ?",
                [$userId]
            );
            echo json_encode(['success' => true]);
        } catch (\Throwable $e) {
            echo json_encode(['success' => true]); // OK even if table doesn't exist
        }
    }
}
