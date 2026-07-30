<?php
/**
 * Phase 11.5 — Module 9: Release Artifacts
 * Store walkthrough videos, QA reports, screenshots, release notes, rollback plans
 */

class ReleaseArtifactsController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /admin/releases/{id}/artifacts — List artifacts for a release
     */
    public function index(int $releaseId): void
    {
        if (!canAdmin()) { redirect('/dashboard'); return; }

        $release = $this->db->fetch("SELECT * FROM releases WHERE id = ?", [$releaseId]);
        if (!$release) { redirect('/admin/releases'); return; }

        $artifacts = $this->db->fetchAll(
            "SELECT ra.*, u.name as uploader_name
             FROM release_artifacts ra
             LEFT JOIN users u ON ra.uploaded_by = u.id
             WHERE ra.release_id = ?
             ORDER BY ra.type, ra.created_at DESC",
            [$releaseId]
        );

        UsageTracker::log('release_artifacts_view', ['release_id' => $releaseId]);

        $pageTitle = 'Release Artifacts — ' . ($release['name'] ?? 'Release');
        $currentPage = 'admin-releases';

        ob_start();
        include __DIR__ . '/../views/releases/artifacts.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /admin/releases/{id}/artifacts — Upload/add artifact
     */
    public function store(int $releaseId): void
    {
        if (!canAdmin()) { redirect('/dashboard'); return; }

        $type = $_POST['type'] ?? 'screenshot';
        $title = trim($_POST['title'] ?? '');
        $url = trim($_POST['url'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $filePath = null;

        if (!$title) {
            $_SESSION['flash_error'] = 'Title is required';
            redirect("/admin/releases/{$releaseId}/artifacts");
            return;
        }

        // Handle file upload
        if (!empty($_FILES['file']['name'])) {
            $uploadDir = __DIR__ . '/../uploads/artifacts/' . $releaseId;
            if (!is_dir($uploadDir)) { mkdir($uploadDir, 0755, true); }

            $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
            $allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov', 'md', 'txt', 'doc', 'docx'];

            if (!in_array($ext, $allowed)) {
                $_SESSION['flash_error'] = 'File type not allowed';
                redirect("/admin/releases/{$releaseId}/artifacts");
                return;
            }

            $filename = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', $_FILES['file']['name']);
            $dest = $uploadDir . '/' . $filename;

            if (move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
                $filePath = "/uploads/artifacts/{$releaseId}/{$filename}";
            }
        }

        $this->db->execute(
            "INSERT INTO release_artifacts (release_id, type, title, file_path, url, description, uploaded_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
            [$releaseId, $type, $title, $filePath, $url ?: null, $description ?: null, $_SESSION['user_id']]
        );

        $_SESSION['flash_success'] = 'Artifact added successfully';
        redirect("/admin/releases/{$releaseId}/artifacts");
    }

    /**
     * DELETE /admin/releases/artifacts/{id} — Remove artifact
     */
    public function destroy(int $artifactId): void
    {
        if (!canAdmin()) { redirect('/dashboard'); return; }

        $artifact = $this->db->fetch("SELECT * FROM release_artifacts WHERE id = ?", [$artifactId]);
        if (!$artifact) { redirect('/admin/releases'); return; }

        // Delete file if exists
        if ($artifact['file_path']) {
            $fullPath = __DIR__ . '/../' . ltrim($artifact['file_path'], '/');
            if (file_exists($fullPath)) { unlink($fullPath); }
        }

        $this->db->execute("DELETE FROM release_artifacts WHERE id = ?", [$artifactId]);

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true]);
            return;
        }

        $_SESSION['flash_success'] = 'Artifact removed';
        redirect("/admin/releases/{$artifact['release_id']}/artifacts");
    }
}
